import csv
import io
import json
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    StockAudit, StockAuditLine, ItemVariant, InventoryStock,
    AssetUnit, AssetStatusEnum, StockTransaction, TxnTypeEnum,
    User, Location, RoleEnum
)
from ..auth import get_current_user, require_manager_or_above, require_regional_or_super_admin
from ..audit import log_audit

router = APIRouter(prefix="/api/audits", tags=["Stock Audits & Cycle Counts"])


class AuditCreatePayload(BaseModel):
    scope_type: str = "CITY" # CENTRAL, CITY
    location_id: Optional[int] = None
    variance_threshold_pct: float = 2.0
    notes: Optional[str] = None


class AuditLineUpdatePayload(BaseModel):
    counted_quantity: int
    scanned_serials: Optional[List[str]] = None
    reason: Optional[str] = None


def _audit_out(a: StockAudit) -> dict:
    return {
        "audit_id": a.audit_id,
        "audit_code": a.audit_code,
        "scope_type": a.scope_type,
        "location_id": a.location_id,
        "location_name": a.location.name if a.location else "Central Warehouse",
        "region_id": a.region_id,
        "status": a.status,
        "started_by": a.started_by,
        "starter_name": a.starter.name if a.starter else "",
        "approved_by": a.approved_by,
        "approver_name": a.approver.name if a.approver else None,
        "variance_threshold_pct": a.variance_threshold_pct,
        "notes": a.notes,
        "submitted_at": a.submitted_at,
        "approved_at": a.approved_at,
        "created_at": a.created_at,
    }


def _line_out(line: StockAuditLine) -> dict:
    var = line.variant
    item = var.item if var else None
    return {
        "line_id": line.line_id,
        "variant_id": line.variant_id,
        "item_name": item.name if item else "",
        "variant_name": var.variant_name if var else "",
        "is_serialized": bool(item.is_serialized) if item else False,
        "system_quantity": line.system_quantity,
        "counted_quantity": line.counted_quantity,
        "variance": line.variance,
        "reason": line.reason,
        "scanned_serials": json.loads(line.scanned_serials_json) if line.scanned_serials_json else [],
        "missing_serials": json.loads(line.missing_serials_json) if line.missing_serials_json else [],
    }


@router.post("")
def start_stock_audit(
    payload: AuditCreatePayload,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    scope = payload.scope_type.upper()
    if scope == "CENTRAL":
        if current_user.role not in (RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"):
            raise HTTPException(status_code=403, detail="Only Super Admin can start a Central Warehouse audit.")
        loc_id = None
        reg_id = None
    else:
        scope = "CITY"
        loc_id = payload.location_id or current_user.city_id
        if not loc_id:
            raise HTTPException(status_code=400, detail="location_id is required for a city audit.")
        loc = db.query(Location).filter(Location.location_id == loc_id).first()
        if not loc:
            raise HTTPException(status_code=404, detail="Location not found.")
        if current_user.role == RoleEnum.MANAGER.value and loc_id not in current_user.territory_ids:
            raise HTTPException(status_code=403, detail="Location is outside your city hub.")
        reg_id = loc.region_id

    now = datetime.utcnow()
    audit = StockAudit(
        audit_code=f"AUD-{now.year}-{uuid.uuid4().hex[:6].upper()}",
        scope_type=scope,
        location_id=loc_id,
        region_id=reg_id,
        status="COUNTING",
        started_by=current_user.user_id,
        variance_threshold_pct=payload.variance_threshold_pct,
        notes=payload.notes,
        created_at=now,
    )
    db.add(audit)
    db.flush()
    audit.audit_code = f"AUD-{now.year}-{audit.audit_id:05d}"

    variants = db.query(ItemVariant).all()
    for v in variants:
        if v.item and v.item.is_serialized:
            q = db.query(AssetUnit).filter(
                AssetUnit.variant_id == v.variant_id,
                AssetUnit.status.in_([AssetStatusEnum.IN_WAREHOUSE.value, AssetStatusEnum.ASSIGNED.value])
            )
            if scope == "CITY":
                q = q.filter(AssetUnit.current_location_id == loc_id)
            else:
                q = q.filter(AssetUnit.current_location_id.is_(None))
            sys_qty = q.count()
        else:
            st = db.query(InventoryStock).filter(InventoryStock.variant_id == v.variant_id).first()
            sys_qty = st.current_quantity if st else 0

        db.add(StockAuditLine(
            audit_id=audit.audit_id,
            variant_id=v.variant_id,
            system_quantity=sys_qty,
            counted_quantity=sys_qty,
            variance=0,
        ))

    db.commit()
    db.refresh(audit)
    log_audit(db, "STOCK_AUDIT_STARTED", f"Started {audit.audit_code} ({scope})", current_user.user_id, current_user.name, current_user.role)
    return _audit_out(audit)


@router.get("")
def list_audits(
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    q = db.query(StockAudit)
    if current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        q = q.filter(StockAudit.region_id == current_user.region_id)
    elif current_user.role == RoleEnum.MANAGER.value:
        q = q.filter(StockAudit.location_id.in_(current_user.territory_ids))
    return [_audit_out(a) for a in q.order_by(StockAudit.created_at.desc()).all()]


@router.get("/{audit_id}")
def get_audit_detail(
    audit_id: int,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    audit = db.query(StockAudit).filter(StockAudit.audit_id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found.")
    lines = db.query(StockAuditLine).filter(StockAuditLine.audit_id == audit_id).all()
    return {"audit": _audit_out(audit), "lines": [_line_out(l) for l in lines]}


@router.put("/{audit_id}/lines/{line_id}")
def update_audit_line(
    audit_id: int,
    line_id: int,
    payload: AuditLineUpdatePayload,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    audit = db.query(StockAudit).filter(StockAudit.audit_id == audit_id).first()
    if not audit or audit.status not in ("DRAFT", "COUNTING"):
        raise HTTPException(status_code=400, detail="Audit is not editable.")
    line = db.query(StockAuditLine).filter(StockAuditLine.line_id == line_id, StockAuditLine.audit_id == audit_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Audit line not found.")

    line.counted_quantity = max(0, payload.counted_quantity)
    line.variance = line.counted_quantity - line.system_quantity
    line.reason = payload.reason

    if payload.scanned_serials is not None:
        scanned_set = {s.strip() for s in payload.scanned_serials if s.strip()}
        line.scanned_serials_json = json.dumps(sorted(scanned_set))
        q = db.query(AssetUnit).filter(
            AssetUnit.variant_id == line.variant_id,
            AssetUnit.status.in_([AssetStatusEnum.IN_WAREHOUSE.value, AssetStatusEnum.ASSIGNED.value])
        )
        if audit.scope_type == "CITY":
            q = q.filter(AssetUnit.current_location_id == audit.location_id)
        else:
            q = q.filter(AssetUnit.current_location_id.is_(None))
        expected = {u.serial_number for u in q.all()}
        missing = sorted(expected - scanned_set)
        line.missing_serials_json = json.dumps(missing)
        line.counted_quantity = len(scanned_set)
        line.variance = line.counted_quantity - line.system_quantity

    db.commit()
    db.refresh(line)
    return _line_out(line)


@router.post("/{audit_id}/submit")
def submit_audit(
    audit_id: int,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    audit = db.query(StockAudit).filter(StockAudit.audit_id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found.")
    audit.status = "SUBMITTED"
    audit.submitted_at = datetime.utcnow()
    db.commit()
    db.refresh(audit)
    return _audit_out(audit)


@router.post("/{audit_id}/approve")
def approve_audit(
    audit_id: int,
    current_user: User = Depends(require_regional_or_super_admin),
    db: Session = Depends(get_db)
):
    audit = db.query(StockAudit).filter(StockAudit.audit_id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found.")
    if audit.scope_type == "CENTRAL" and current_user.role not in (RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"):
        raise HTTPException(status_code=403, detail="Super Admin approval required for Central audits.")
    if audit.scope_type == "CITY" and current_user.role == RoleEnum.REGIONAL_ADMIN.value and audit.region_id != current_user.region_id:
        raise HTTPException(status_code=403, detail="City audit is outside your region.")

    lines = db.query(StockAuditLine).filter(StockAuditLine.audit_id == audit_id).all()
    now = datetime.utcnow()
    for line in lines:
        if line.variance != 0 and line.variant and line.variant.item and not line.variant.item.is_serialized:
            st = db.query(InventoryStock).filter(InventoryStock.variant_id == line.variant_id).with_for_update().first()
            if st:
                st.current_quantity = max(0, st.current_quantity + line.variance)
            db.add(StockTransaction(
                variant_id=line.variant_id,
                txn_type=TxnTypeEnum.ADJUSTMENT.value,
                quantity=line.variance,
                performed_by=current_user.user_id,
                timestamp=now,
            ))

    audit.status = "APPROVED"
    audit.approved_by = current_user.user_id
    audit.approved_at = now
    db.commit()
    db.refresh(audit)
    log_audit(db, "STOCK_AUDIT_APPROVED", f"Approved {audit.audit_code}", current_user.user_id, current_user.name, current_user.role)
    return _audit_out(audit)


@router.get("/{audit_id}/export")
def export_audit_csv(
    audit_id: int,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    audit = db.query(StockAudit).filter(StockAudit.audit_id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found.")
    lines = db.query(StockAuditLine).filter(StockAuditLine.audit_id == audit_id).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Audit Code", "Item", "Variant", "System Qty", "Counted Qty", "Variance", "Missing Serials", "Reason"])
    for l in lines:
        lo = _line_out(l)
        writer.writerow([
            audit.audit_code, lo["item_name"], lo["variant_name"],
            lo["system_quantity"], lo["counted_quantity"], lo["variance"],
            ";".join(lo["missing_serials"]), lo["reason"] or ""
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={audit.audit_code}_variance.csv"}
    )
