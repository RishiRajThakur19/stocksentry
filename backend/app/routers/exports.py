import csv
import io
from typing import Optional
import openpyxl
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    InventoryStock, ItemVariant, RequestModel, FieldRequisition,
    Ticket, AssetUnit, AuditLog, LossReport, User, RoleEnum, Location
)
from ..auth import get_current_user
from ..audit import log_audit

router = APIRouter(prefix="/api/exports", tags=["Scoped Data Exports"])


def _stream_export(rows: list, headers: list, filename: str, fmt: str):
    if fmt == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(headers)
        for r in rows:
            ws.append(r)
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}.xlsx"}
        )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    for r in rows:
        writer.writerow(r)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}.csv"}
    )


@router.get("/{dataset}")
def export_dataset(
    dataset: str,
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    is_super = current_user.role in (RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN")
    is_reg = current_user.role == RoleEnum.REGIONAL_ADMIN.value
    is_mgr = current_user.role == RoleEnum.MANAGER.value

    headers = []
    rows = []

    if dataset == "central_stock":
        headers = ["Variant ID", "Item", "Variant", "On Hand", "Reserved", "Available"]
        for s in db.query(InventoryStock).all():
            v = s.variant
            it = v.item if v else None
            avail = max(0, s.current_quantity - (s.reserved_quantity or 0))
            rows.append([s.variant_id, it.name if it else "", v.variant_name if v else "", s.current_quantity, s.reserved_quantity or 0, avail])

    elif dataset == "requests":
        q = db.query(RequestModel)
        if is_reg:
            q = q.join(Location, RequestModel.location_id == Location.location_id).filter(Location.region_id == current_user.region_id)
        elif is_mgr:
            q = q.filter(RequestModel.location_id.in_(current_user.territory_ids))
        elif not is_super:
            q = q.filter(RequestModel.requested_by == current_user.user_id)
        headers = ["Request ID", "Location ID", "Variant ID", "Qty", "Status", "Created At"]
        for r in q.all():
            rows.append([r.request_id, r.location_id, r.variant_id, r.quantity_requested, r.status, str(r.created_at)])

    elif dataset == "requisitions":
        q = db.query(FieldRequisition)
        if is_reg:
            q = q.filter(FieldRequisition.region_id == current_user.region_id)
        elif is_mgr:
            q = q.filter(FieldRequisition.location_id.in_(current_user.territory_ids))
        elif not is_super:
            q = q.filter(FieldRequisition.requested_by == current_user.user_id)
        headers = ["Requisition ID", "Requester ID", "Variant ID", "Qty", "Urgency", "Status", "Created At"]
        for r in q.all():
            rows.append([r.requisition_id, r.requested_by, r.variant_id, r.quantity_requested, r.urgency, r.status, str(r.created_at)])

    elif dataset == "tickets":
        q = db.query(Ticket)
        if is_reg:
            q = q.filter(Ticket.region_id == current_user.region_id)
        elif is_mgr:
            q = q.filter(Ticket.city_id.in_(current_user.territory_ids))
        elif not is_super:
            q = q.filter(Ticket.created_by == current_user.user_id)
        headers = ["Ticket Code", "Category", "Priority", "Status", "Subject", "SLA Breached", "Created At"]
        for t in q.all():
            rows.append([t.ticket_code, t.category, t.priority, t.status, t.subject, t.sla_breached, str(t.created_at)])

    elif dataset == "assets":
        q = db.query(AssetUnit)
        if is_reg:
            q = q.join(Location, AssetUnit.current_location_id == Location.location_id).filter(Location.region_id == current_user.region_id)
        elif is_mgr:
            q = q.filter(AssetUnit.current_location_id.in_(current_user.territory_ids))
        elif not is_super:
            q = q.filter(AssetUnit.current_holder_id == current_user.user_id)
        headers = ["Asset ID", "Serial Number", "Status", "Location ID", "Holder ID"]
        for a in q.all():
            rows.append([a.asset_id, a.serial_number, a.status, a.current_location_id, a.current_holder_id])

    elif dataset == "lost_assets":
        q = db.query(LossReport)
        if not is_super and not is_reg and not is_mgr:
            q = q.filter(LossReport.reported_by == current_user.user_id)
        headers = ["Loss ID", "Asset ID", "Type", "Status", "Reported By", "Created At"]
        for lr in q.all():
            rows.append([lr.loss_id, lr.asset_id, lr.loss_type, lr.status, lr.reported_by, str(lr.created_at)])

    elif dataset == "audit_logs":
        if not is_super:
            raise HTTPException(status_code=403, detail="Super Admin required to export system audit logs.")
        headers = ["Log ID", "User", "Role", "Action", "Details", "Timestamp"]
        for l in db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(1000).all():
            rows.append([l.log_id, l.user_name, l.user_role, l.action, l.details, str(l.timestamp)])
    else:
        raise HTTPException(status_code=400, detail=f"Unknown export dataset '{dataset}'.")

    log_audit(db, "DATA_EXPORT", f"Exported {dataset} ({format}) - {len(rows)} rows", current_user.user_id, current_user.name, current_user.role)
    return _stream_export(rows, headers, f"stocksentry_{dataset}", format)
