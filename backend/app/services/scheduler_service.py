from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import SessionLocal, engine
from ..models import FieldRequisition, User, RoleEnum, RequestModel, RequestStatusEnum, Ticket, Alert, AlertStatusEnum
from .email_service import notify_user_email


def _try_acquire_scheduler_lock(db: Session, lock_id: int = 9042026) -> bool:
    if engine.dialect.name == "postgresql":
        row = db.execute(text("SELECT pg_try_advisory_lock(:id)"), {"id": lock_id}).fetchone()
        return bool(row and row[0])
    return True


def escalate_overdue_field_requisitions(db: Session) -> int:
    """
    48-hour field requisition auto-escalation:
    Any PENDING field requisition older than 48 hours targeted at CITY_MANAGER
    is escalated to BOTH (City Manager + Regional Admin) with urgency bumped to URGENT.
    """
    cutoff = datetime.utcnow() - timedelta(hours=48)
    overdue = db.query(FieldRequisition).filter(
        FieldRequisition.status == "PENDING",
        FieldRequisition.created_at < cutoff,
        FieldRequisition.target_approver == "CITY_MANAGER",
    ).all()
    for r in overdue:
        r.target_approver = "BOTH"
        if r.urgency == "NORMAL":
            r.urgency = "URGENT"
    if overdue:
        db.commit()
    return len(overdue)


def build_weekly_digest_for_user(user: User, db: Session) -> dict:
    pending_reqs = db.query(RequestModel).filter(RequestModel.status == RequestStatusEnum.PENDING.value)
    breached_tickets = db.query(Ticket).filter(Ticket.sla_breached.is_(True), Ticket.status != "CLOSED")
    open_alerts = db.query(Alert).filter(Alert.status == AlertStatusEnum.OPEN.value).count()

    if user.role == RoleEnum.REGIONAL_ADMIN.value:
        from ..models import Location
        city_ids = [l.location_id for l in db.query(Location).filter(Location.region_id == user.region_id).all()]
        pending_reqs = pending_reqs.filter(RequestModel.location_id.in_(city_ids))
        breached_tickets = breached_tickets.filter(Ticket.region_id == user.region_id)
    elif user.role == RoleEnum.MANAGER.value:
        pending_reqs = pending_reqs.filter(RequestModel.location_id.in_(user.territory_ids))
        breached_tickets = breached_tickets.filter(Ticket.city_id.in_(user.territory_ids))

    return {
        "user_id": user.user_id,
        "role": user.role,
        "pending_requests": pending_reqs.count(),
        "sla_breached_tickets": breached_tickets.count(),
        "open_low_stock_alerts": open_alerts,
    }


def run_scheduled_jobs():
    db = SessionLocal()
    try:
        if not _try_acquire_scheduler_lock(db):
            return {"skipped": "lock held by another worker"}
        escalated = escalate_overdue_field_requisitions(db)
        return {"escalated_requisitions": escalated}
    finally:
        db.close()
