from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    LossReport, AssetUnit, AssetStatusEnum, AssetLifecycleEvent,
    User, Location, RoleEnum
)
from ..auth import get_current_user, require_regional_or_super_admin
from ..audit import log_audit

router = APIRouter(prefix="/api/loss-reports", tags=["Lost & Stolen Assets"])


class LossReportCreate(BaseModel):
    asset_id: int
    loss_type: str = "LOST" # LOST, STOLEN
    circumstances: str
    date_last_seen: Optional[str] = None
    police_report_ref: Optional[str] = None


class LossReportReview(BaseModel):
    review_notes: Optional[str] = None
    return_city_id: Optional[int] = None


def _to_out(r: LossReport) -> dict:
    asset = r.asset
    var = asset.variant if asset else None
    item = var.item if var else None
    loc = asset.location if asset else None
    return {
        "loss_id": r.loss_id,
        "asset_id": r.asset_id,
        "serial_number": asset.serial_number if asset else "",
        "item_name": item.name if item else "",
        "variant_name": var.variant_name if var else "",
        "unit_cost": var.unit_cost if var else 0.0,
        "city_id": asset.current_location_id if asset else None,
        "city_name": loc.name if loc else "Central Warehouse",
        "region_id": loc.region_id if loc else None,
        "reported_by": r.reported_by,
        "reporter_name": r.reporter.name if r.reporter else "",
        "loss_type": r.loss_type,
        "circumstances": r.circumstances,
        "date_last_seen": r.date_last_seen,
        "police_report_ref": r.police_report_ref,
        "status": r.status,
        "reviewed_by": r.reviewed_by,
        "reviewer_name": r.reviewer.name if r.reviewer else None,
        "review_notes": r.review_notes,
        "reviewed_at": r.reviewed_at,
        "created_at": r.created_at,
    }


@router.post("")
def create_loss_report(
    payload: LossReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    asset = db.query(AssetUnit).filter(AssetUnit.asset_id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    if current_user.role == RoleEnum.FIELD_WORKER.value and asset.current_holder_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only report loss for assets assigned to you.")
    elif current_user.role == RoleEnum.MANAGER.value and asset.current_location_id not in current_user.territory_ids:
        raise HTTPException(status_code=403, detail="Asset is outside your city hub.")

    ltype = payload.loss_type.upper()
    if ltype not in ("LOST", "STOLEN"):
        ltype = "LOST"

    rec = LossReport(
        asset_id=asset.asset_id,
        reported_by=current_user.user_id,
        loss_type=ltype,
        circumstances=payload.circumstances.strip(),
        date_last_seen=payload.date_last_seen,
        police_report_ref=payload.police_report_ref,
        status="PENDING_REGIONAL",
        created_at=datetime.utcnow(),
    )
    db.add(rec)
    db.add(AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type=f"{ltype}_REPORTED",
        from_holder_id=asset.current_holder_id,
        from_location_id=asset.current_location_id,
        performed_by=current_user.user_id,
        notes=f"{ltype} report filed: {payload.circumstances}",
        timestamp=datetime.utcnow(),
    ))
    db.commit()
    db.refresh(rec)
    log_audit(db, "LOSS_REPORT_CREATED", f"Loss #{rec.loss_id} for {asset.serial_number} ({ltype})", current_user.user_id, current_user.name, current_user.role)
    return _to_out(rec)


@router.get("")
def list_loss_reports(
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rows = db.query(LossReport).order_by(LossReport.created_at.desc()).all()
    out = []
    for r in rows:
        if status_filter and status_filter != "ALL" and r.status != status_filter:
            continue
        loc = r.asset.location if r.asset else None
        if current_user.role in (RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"):
            pass
        elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
            if not loc or loc.region_id != current_user.region_id:
                continue
        elif current_user.role == RoleEnum.MANAGER.value:
            if not r.asset or r.asset.current_location_id not in current_user.territory_ids:
                continue
        else:
            if r.reported_by != current_user.user_id:
                continue
        out.append(_to_out(r))
    return out


@router.get("/summary")
def loss_reports_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    items = list_loss_reports(status_filter=None, current_user=current_user, db=db)
    summary = {}
    for it in items:
        if it["status"] != "APPROVED":
            continue
        month = it["created_at"].strftime("%Y-%m") if it["created_at"] else "Unknown"
        key = (it["city_name"], month)
        if key not in summary:
            summary[key] = {"city_name": it["city_name"], "month": month, "count": 0, "total_value": 0.0}
        summary[key]["count"] += 1
        summary[key]["total_value"] += float(it["unit_cost"] or 0.0)
    return list(summary.values())


@router.put("/{loss_id}/approve")
def approve_loss_writeoff(
    loss_id: int,
    payload: LossReportReview = LossReportReview(),
    current_user: User = Depends(require_regional_or_super_admin),
    db: Session = Depends(get_db)
):
    rec = db.query(LossReport).filter(LossReport.loss_id == loss_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Loss report not found.")
    asset = rec.asset
    if current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        loc = asset.location if asset else None
        if loc and loc.region_id != current_user.region_id:
            raise HTTPException(status_code=403, detail="Loss report is outside your region.")

    if rec.status != "PENDING_REGIONAL":
        raise HTTPException(status_code=400, detail=f"Cannot approve loss report in '{rec.status}' status.")

    now = datetime.utcnow()
    old_holder = asset.current_holder_id
    asset.status = AssetStatusEnum.STOLEN.value if rec.loss_type == "STOLEN" else AssetStatusEnum.LOST.value
    asset.current_holder_id = None

    rec.status = "APPROVED"
    rec.reviewed_by = current_user.user_id
    rec.review_notes = payload.review_notes or "Write-off approved"
    rec.reviewed_at = now

    db.add(AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type="WRITTEN_OFF_" + rec.loss_type,
        from_holder_id=old_holder,
        from_location_id=asset.current_location_id,
        performed_by=current_user.user_id,
        notes=f"Write-off approved (Loss #{rec.loss_id}). Holder cleared. {rec.review_notes}",
        timestamp=now,
    ))
    db.commit()
    db.refresh(rec)
    log_audit(db, "LOSS_WRITEOFF_APPROVED", f"Approved write-off #{rec.loss_id} for {asset.serial_number}", current_user.user_id, current_user.name, current_user.role)
    return _to_out(rec)


@router.put("/{loss_id}/reject")
def reject_loss_report(
    loss_id: int,
    payload: LossReportReview = LossReportReview(),
    current_user: User = Depends(require_regional_or_super_admin),
    db: Session = Depends(get_db)
):
    rec = db.query(LossReport).filter(LossReport.loss_id == loss_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Loss report not found.")
    rec.status = "REJECTED"
    rec.reviewed_by = current_user.user_id
    rec.review_notes = payload.review_notes or "Rejected"
    rec.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(rec)
    return _to_out(rec)


@router.put("/{loss_id}/recover")
def recover_lost_asset(
    loss_id: int,
    payload: LossReportReview = LossReportReview(),
    current_user: User = Depends(require_regional_or_super_admin),
    db: Session = Depends(get_db)
):
    rec = db.query(LossReport).filter(LossReport.loss_id == loss_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Loss report not found.")
    asset = rec.asset
    now = datetime.utcnow()

    asset.status = AssetStatusEnum.IN_WAREHOUSE.value
    asset.current_holder_id = None
    asset.current_location_id = payload.return_city_id

    rec.status = "RECOVERED"
    rec.reviewed_by = current_user.user_id
    rec.review_notes = payload.review_notes or "Asset recovered and returned to stock"
    rec.reviewed_at = now

    db.add(AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type="ASSET_RECOVERED",
        to_location_id=payload.return_city_id,
        performed_by=current_user.user_id,
        notes=f"Recovered from Loss #{rec.loss_id}. {rec.review_notes}",
        timestamp=now,
    ))
    db.commit()
    db.refresh(rec)
    log_audit(db, "LOSS_ASSET_RECOVERED", f"Recovered {asset.serial_number} (Loss #{rec.loss_id})", current_user.user_id, current_user.name, current_user.role)
    return _to_out(rec)
