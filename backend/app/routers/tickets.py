import os
import uuid
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Ticket, TicketComment, TicketAttachment, TicketEvent,
    AssetUnit, User, Location, RoleEnum
)
from ..auth import get_current_user, require_manager_or_above
from ..websocket_manager import ws_manager
from ..audit import log_audit

router = APIRouter(prefix="/api/tickets", tags=["Support Tickets"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "tickets"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

SLA_HOURS = {
    "URGENT": int(os.getenv("SLA_URGENT_HOURS", "4")),
    "HIGH": int(os.getenv("SLA_HIGH_HOURS", "24")),
    "NORMAL": int(os.getenv("SLA_NORMAL_HOURS", "48")),
    "LOW": int(os.getenv("SLA_LOW_HOURS", "120")),
}


class TicketCreatePayload(BaseModel):
    category: str = "OTHER"
    priority: str = "NORMAL"
    subject: str
    description: str
    related_asset_id: Optional[int] = None
    related_request_id: Optional[int] = None


class TicketCommentPayload(BaseModel):
    body: str
    is_internal: bool = False


class TicketActionPayload(BaseModel):
    action: str # IN_PROGRESS, WAITING_ON_REQUESTER, RESOLVE, CONFIRM_CLOSE, REOPEN, ESCALATE, REASSIGN
    assignee_id: Optional[int] = None
    note: Optional[str] = None


def _pick_initial_assignee(creator: User, city_id: Optional[int], region_id: Optional[int], db: Session) -> Optional[int]:
    if creator.role == RoleEnum.FIELD_WORKER.value and city_id:
        mgr = db.query(User).filter(
            User.role == RoleEnum.MANAGER.value,
            User.city_id == city_id,
            User.is_active == 1
        ).first()
        if mgr:
            return mgr.user_id
    if region_id:
        reg = db.query(User).filter(
            User.role == RoleEnum.REGIONAL_ADMIN.value,
            User.region_id == region_id,
            User.is_active == 1
        ).first()
        if reg:
            return reg.user_id
    sup = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN.value, User.is_active == 1).first()
    return sup.user_id if sup else None


def _ticket_out(t: Ticket, db: Session) -> dict:
    return {
        "ticket_id": t.ticket_id,
        "ticket_code": t.ticket_code,
        "created_by": t.created_by,
        "creator_name": t.creator.name if t.creator else "User",
        "creator_role": t.creator.role if t.creator else "",
        "city_id": t.city_id,
        "city_name": t.city.name if t.city else "Headquarters",
        "region_id": t.region_id,
        "region_name": t.region.name if t.region else "National",
        "category": t.category,
        "priority": t.priority,
        "status": t.status,
        "subject": t.subject,
        "description": t.description,
        "related_asset_id": t.related_asset_id,
        "related_serial": t.related_asset.serial_number if t.related_asset else None,
        "related_request_id": t.related_request_id,
        "related_repair_id": t.related_repair_id,
        "assignee_id": t.assignee_id,
        "assignee_name": t.assignee.name if t.assignee else "Unassigned",
        "escalation_level": t.escalation_level,
        "sla_due_at": t.sla_due_at,
        "sla_breached": t.sla_breached,
        "resolved_at": t.resolved_at,
        "closed_at": t.closed_at,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


def _verify_ticket_access(t: Ticket, user: User):
    if user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        return
    if user.role == RoleEnum.REGIONAL_ADMIN.value:
        if t.region_id != user.region_id and t.created_by != user.user_id:
            raise HTTPException(status_code=403, detail="Access forbidden: Ticket is outside your region.")
        return
    if user.role == RoleEnum.MANAGER.value:
        if t.city_id not in user.territory_ids and t.created_by != user.user_id and t.assignee_id != user.user_id:
            raise HTTPException(status_code=403, detail="Access forbidden: Ticket is outside your city.")
        return
    if t.created_by != user.user_id:
        raise HTTPException(status_code=403, detail="Access forbidden: You can only view your own tickets.")


def create_ticket_record(
    db: Session,
    creator: User,
    category: str,
    priority: str,
    subject: str,
    description: str,
    related_asset_id: Optional[int] = None,
    related_request_id: Optional[int] = None,
    related_repair_id: Optional[int] = None,
) -> Ticket:
    city_id = creator.city_id or creator.location_id
    loc = db.query(Location).filter(Location.location_id == city_id).first() if city_id else None
    region_id = creator.region_id or (loc.region_id if loc else None)
    prio = priority.upper() if priority.upper() in SLA_HOURS else "NORMAL"
    cat = category.upper() if category.upper() in {"ASSET_FAULT", "STOCK_ISSUE", "ACCESS_ACCOUNT", "REQUEST_QUERY", "OTHER"} else "OTHER"

    assignee_id = _pick_initial_assignee(creator, city_id, region_id, db)
    now = datetime.utcnow()
    sla_due = now + timedelta(hours=SLA_HOURS[prio])
    temp_code = f"TKT-{now.year}-{uuid.uuid4().hex[:6].upper()}"

    t = Ticket(
        ticket_code=temp_code,
        created_by=creator.user_id,
        city_id=city_id,
        region_id=region_id,
        category=cat,
        priority=prio,
        status="OPEN",
        subject=subject.strip(),
        description=description.strip(),
        related_asset_id=related_asset_id,
        related_request_id=related_request_id,
        related_repair_id=related_repair_id,
        assignee_id=assignee_id,
        escalation_level=1 if creator.role == RoleEnum.MANAGER.value else 0,
        sla_due_at=sla_due,
        created_at=now,
        updated_at=now,
    )
    db.add(t)
    db.flush()
    t.ticket_code = f"TKT-{now.year}-{t.ticket_id:06d}"

    db.add(TicketEvent(
        ticket_id=t.ticket_id,
        actor_id=creator.user_id,
        event_type="CREATED",
        details=f"Ticket created ({cat}, {prio}) and routed to assignee #{assignee_id}.",
        created_at=now,
    ))
    return t


@router.post("")
async def create_ticket(
    payload: TicketCreatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    t = create_ticket_record(
        db=db,
        creator=current_user,
        category=payload.category,
        priority=payload.priority,
        subject=payload.subject,
        description=payload.description,
        related_asset_id=payload.related_asset_id,
        related_request_id=payload.related_request_id,
    )
    db.commit()
    db.refresh(t)
    log_audit(db, "TICKET_CREATED", f"{t.ticket_code}: {t.subject}", current_user.user_id, current_user.name, current_user.role)
    await ws_manager.broadcast({
        "type": "TICKET_CREATED",
        "region_id": t.region_id,
        "location_id": t.city_id,
        "target_user_id": t.assignee_id,
        "data": {"ticket_id": t.ticket_id, "ticket_code": t.ticket_code, "subject": t.subject, "priority": t.priority},
    })
    return _ticket_out(t, db)


@router.get("")
def list_tickets(
    tab: str = Query("scope"),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Ticket)
    if current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        pass
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        query = query.filter((Ticket.region_id == current_user.region_id) | (Ticket.created_by == current_user.user_id))
    elif current_user.role == RoleEnum.MANAGER.value:
        query = query.filter(
            (Ticket.city_id.in_(current_user.territory_ids)) |
            (Ticket.created_by == current_user.user_id) |
            (Ticket.assignee_id == current_user.user_id)
        )
    else:
        query = query.filter(Ticket.created_by == current_user.user_id)

    if tab == "assigned":
        query = query.filter(Ticket.assignee_id == current_user.user_id)
    elif tab == "escalated":
        query = query.filter(Ticket.escalation_level >= 1)
    elif tab == "breached":
        query = query.filter(Ticket.sla_breached.is_(True))
    elif tab == "closed":
        query = query.filter(Ticket.status == "CLOSED")

    if category and category != "ALL":
        query = query.filter(Ticket.category == category)
    if priority and priority != "ALL":
        query = query.filter(Ticket.priority == priority)
    if status_filter and status_filter != "ALL":
        query = query.filter(Ticket.status == status_filter)

    rows = query.order_by(Ticket.created_at.desc()).all()
    if q:
        ql = q.strip().lower()
        rows = [
            t for t in rows
            if ql in t.ticket_code.lower()
            or ql in t.subject.lower()
            or (t.related_asset and ql in t.related_asset.serial_number.lower())
        ]
    return [_ticket_out(t, db) for t in rows]


@router.get("/metrics")
def get_ticket_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    items = list_tickets(tab="scope", category=None, priority=None, status_filter=None, q=None, current_user=current_user, db=db)
    open_count = sum(1 for t in items if t["status"] not in ("RESOLVED", "CLOSED"))
    breached_count = sum(1 for t in items if t["sla_breached"] and t["status"] != "CLOSED")
    res_hours = []
    by_cat = {}
    for t in items:
        by_cat[t["category"]] = by_cat.get(t["category"], 0) + 1
        if t["resolved_at"] and t["created_at"]:
            res_hours.append((t["resolved_at"] - t["created_at"]).total_seconds() / 3600.0)
    avg_res = round(sum(res_hours) / len(res_hours), 2) if res_hours else 0.0
    return {
        "total": len(items),
        "open": open_count,
        "sla_breached": breached_count,
        "avg_resolution_hours": avg_res,
        "by_category": [{"category": k, "count": v} for k, v in by_cat.items()],
    }


@router.get("/{ticket_id}")
def get_ticket_detail(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    t = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    _verify_ticket_access(t, current_user)

    is_staff = current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN", RoleEnum.REGIONAL_ADMIN.value, RoleEnum.MANAGER.value]
    comments_q = db.query(TicketComment).filter(TicketComment.ticket_id == ticket_id)
    if not is_staff:
        comments_q = comments_q.filter(TicketComment.is_internal.is_(False))
    comments = comments_q.order_by(TicketComment.created_at.asc()).all()

    attachments = db.query(TicketAttachment).filter(TicketAttachment.ticket_id == ticket_id).all()
    events = db.query(TicketEvent).filter(TicketEvent.ticket_id == ticket_id).order_by(TicketEvent.created_at.asc()).all()

    return {
        "ticket": _ticket_out(t, db),
        "comments": [
            {
                "comment_id": c.comment_id,
                "author_id": c.author_id,
                "author_name": c.author.name if c.author else "User",
                "author_role": c.author.role if c.author else "",
                "body": c.body,
                "is_internal": c.is_internal,
                "created_at": c.created_at,
            }
            for c in comments
        ],
        "attachments": [
            {
                "attachment_id": a.attachment_id,
                "comment_id": a.comment_id,
                "original_filename": a.original_filename,
                "content_type": a.content_type,
                "size_bytes": a.size_bytes,
                "created_at": a.created_at,
            }
            for a in attachments
        ],
        "events": [
            {
                "event_id": e.event_id,
                "event_type": e.event_type,
                "details": e.details,
                "actor_name": e.actor.name if e.actor else "System",
                "created_at": e.created_at,
            }
            for e in events
        ],
    }


@router.post("/{ticket_id}/comments")
async def add_ticket_comment(
    ticket_id: int,
    payload: TicketCommentPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    t = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    _verify_ticket_access(t, current_user)

    is_staff = current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN", RoleEnum.REGIONAL_ADMIN.value, RoleEnum.MANAGER.value]
    is_internal = bool(payload.is_internal and is_staff)

    c = TicketComment(
        ticket_id=ticket_id,
        author_id=current_user.user_id,
        body=payload.body.strip(),
        is_internal=is_internal,
        created_at=datetime.utcnow(),
    )
    t.updated_at = datetime.utcnow()
    db.add(c)
    db.commit()
    db.refresh(c)

    await ws_manager.broadcast({
        "type": "TICKET_COMMENT",
        "region_id": t.region_id,
        "location_id": t.city_id,
        "target_user_id": t.created_by if current_user.user_id != t.created_by else t.assignee_id,
        "data": {"ticket_id": t.ticket_id, "ticket_code": t.ticket_code, "author": current_user.name},
    })
    return {
        "comment_id": c.comment_id,
        "author_id": c.author_id,
        "author_name": current_user.name,
        "body": c.body,
        "is_internal": c.is_internal,
        "created_at": c.created_at,
    }


@router.post("/{ticket_id}/attachments")
async def upload_ticket_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    comment_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    t = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    _verify_ticket_access(t, current_user)

    if comment_id:
        existing_count = db.query(TicketAttachment).filter(TicketAttachment.comment_id == comment_id).count()
        if existing_count >= 5:
            raise HTTPException(status_code=400, detail="Maximum 5 attachments per comment.")

    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Attachment exceeds 5 MB limit.")

    # Verify magic bytes (not just filename extension)
    ext = None
    mime = None
    if data.startswith(b"\xff\xd8\xff"):
        ext, mime = ".jpg", "image/jpeg"
    elif data.startswith(b"\x89PNG\r\n\x1a\n"):
        ext, mime = ".png", "image/png"
    elif data.startswith(b"%PDF-"):
        ext, mime = ".pdf", "application/pdf"
    else:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, or PDF files are permitted.")

    stored_name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(data)

    att = TicketAttachment(
        ticket_id=ticket_id,
        comment_id=comment_id,
        uploaded_by=current_user.user_id,
        original_filename=file.filename or f"attachment{ext}",
        stored_filename=stored_name,
        content_type=mime,
        size_bytes=len(data),
        created_at=datetime.utcnow(),
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return {
        "attachment_id": att.attachment_id,
        "original_filename": att.original_filename,
        "content_type": att.content_type,
        "size_bytes": att.size_bytes,
    }


@router.get("/attachments/{attachment_id}")
def download_ticket_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    att = db.query(TicketAttachment).filter(TicketAttachment.attachment_id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    t = db.query(Ticket).filter(Ticket.ticket_id == att.ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    _verify_ticket_access(t, current_user)

    file_path = UPLOAD_DIR / att.stored_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Attachment file missing on disk.")
    return FileResponse(path=str(file_path), media_type=att.content_type, filename=att.original_filename)


@router.put("/{ticket_id}/action")
async def perform_ticket_action(
    ticket_id: int,
    payload: TicketActionPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    t = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    _verify_ticket_access(t, current_user)

    act = payload.action.upper()
    now = datetime.utcnow()
    is_staff = current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN", RoleEnum.REGIONAL_ADMIN.value, RoleEnum.MANAGER.value]

    if act in ("IN_PROGRESS", "WAITING_ON_REQUESTER", "RESOLVE", "ESCALATE", "REASSIGN") and not is_staff:
        raise HTTPException(status_code=403, detail="Staff role required for this ticket action.")

    if act == "IN_PROGRESS":
        t.status = "IN_PROGRESS"
    elif act == "WAITING_ON_REQUESTER":
        t.status = "WAITING_ON_REQUESTER"
    elif act == "RESOLVE":
        t.status = "RESOLVED"
        t.resolved_at = now
    elif act == "CONFIRM_CLOSE":
        if current_user.user_id != t.created_by and not is_staff:
            raise HTTPException(status_code=403, detail="Only requester or staff can close ticket.")
        t.status = "CLOSED"
        t.closed_at = now
    elif act == "REOPEN":
        if t.resolved_at and (now - t.resolved_at).days > 7:
            raise HTTPException(status_code=400, detail="Tickets can only be reopened within 7 days of resolution.")
        t.status = "REOPENED"
        t.resolved_at = None
        t.closed_at = None
    elif act == "ESCALATE":
        t.escalation_level = min(2, (t.escalation_level or 0) + 1)
        if t.escalation_level == 1 and t.region_id:
            reg = db.query(User).filter(User.role == RoleEnum.REGIONAL_ADMIN.value, User.region_id == t.region_id, User.is_active == 1).first()
            if reg:
                t.assignee_id = reg.user_id
        else:
            sup = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN.value, User.is_active == 1).first()
            if sup:
                t.assignee_id = sup.user_id
    elif act == "REASSIGN" and payload.assignee_id:
        t.assignee_id = payload.assignee_id
    else:
        raise HTTPException(status_code=400, detail="Invalid ticket action.")

    t.updated_at = now
    db.add(TicketEvent(
        ticket_id=t.ticket_id,
        actor_id=current_user.user_id,
        event_type=act,
        details=payload.note or f"Ticket action: {act}",
        created_at=now,
    ))
    db.commit()
    db.refresh(t)

    await ws_manager.broadcast({
        "type": "TICKET_UPDATED",
        "region_id": t.region_id,
        "location_id": t.city_id,
        "target_user_id": t.created_by,
        "data": {"ticket_id": t.ticket_id, "ticket_code": t.ticket_code, "status": t.status, "action": act},
    })
    return _ticket_out(t, db)


@router.post("/run-sla-check")
def run_sla_check(
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    breached_tickets = db.query(Ticket).filter(
        Ticket.status.notin_(["RESOLVED", "CLOSED"]),
        Ticket.sla_breached.is_(False),
        Ticket.sla_due_at < now,
    ).all()
    for t in breached_tickets:
        t.sla_breached = True
        t.escalation_level = min(2, (t.escalation_level or 0) + 1)
        db.add(TicketEvent(
            ticket_id=t.ticket_id,
            actor_id=current_user.user_id,
            event_type="SLA_BREACHED",
            details="SLA due time exceeded; auto-escalated.",
            created_at=now,
        ))

    auto_close_cutoff = now - timedelta(days=7)
    to_close = db.query(Ticket).filter(
        Ticket.status == "RESOLVED",
        Ticket.resolved_at.isnot(None),
        Ticket.resolved_at < auto_close_cutoff,
    ).all()
    for t in to_close:
        t.status = "CLOSED"
        t.closed_at = now
        db.add(TicketEvent(
            ticket_id=t.ticket_id,
            actor_id=current_user.user_id,
            event_type="AUTO_CLOSED",
            details="Auto-closed 7 days after resolution.",
            created_at=now,
        ))
    db.commit()
    return {"sla_breached_flagged": len(breached_tickets), "auto_closed": len(to_close)}
