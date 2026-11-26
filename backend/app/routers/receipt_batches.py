import csv
import io
import re
import uuid
from datetime import datetime
from typing import List, Optional
import openpyxl
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    ReceiptBatch, AssetUnit, AssetStatusEnum, AssetLifecycleEvent,
    ItemVariant, InventoryStock, StockTransaction, TxnTypeEnum, User
)
from ..auth import require_super_admin
from ..audit import log_audit

router = APIRouter(prefix="/api/inventory", tags=["Bulk Serial Intake & Receipt Batches"])

SERIAL_RE = re.compile(r"^[A-Za-z0-9._-]{3,100}$")


class BulkSerialCommitPayload(BaseModel):
    variant_id: int
    serials: List[str]
    reference_note: Optional[str] = None


def _classify_serials(raw_serials: List[str], db: Session) -> dict:
    seen = set()
    valid = []
    duplicate_in_file = []
    invalid = []
    cleaned_candidates = []

    for raw in raw_serials:
        s = (raw or "").strip()
        if not s:
            continue
        if not SERIAL_RE.match(s):
            invalid.append(s)
            continue
        if s in seen:
            duplicate_in_file.append(s)
            continue
        seen.add(s)
        cleaned_candidates.append(s)

    existing_in_db = set()
    if cleaned_candidates:
        # Query in chunks of 500 to stay SQLite-safe
        for i in range(0, len(cleaned_candidates), 500):
            chunk = cleaned_candidates[i : i + 500]
            rows = db.query(AssetUnit.serial_number).filter(AssetUnit.serial_number.in_(chunk)).all()
            existing_in_db.update(r[0] for r in rows)

    duplicate_in_db = []
    for s in cleaned_candidates:
        if s in existing_in_db:
            duplicate_in_db.append(s)
        else:
            valid.append(s)

    return {
        "total_submitted": len(raw_serials),
        "valid": valid,
        "duplicate_in_file": duplicate_in_file,
        "duplicate_in_db": duplicate_in_db,
        "invalid": invalid,
    }


def _extract_serials_from_file(filename: str, contents: bytes) -> List[str]:
    lower = (filename or "").lower()
    if lower.endswith(".csv"):
        text = contents.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        if reader.fieldnames and any(f.strip().lower() == "serial_number" for f in reader.fieldnames):
            col = next(f for f in reader.fieldnames if f.strip().lower() == "serial_number")
            return [str(row.get(col) or "").strip() for row in reader]
        return [line.strip() for line in text.splitlines() if line.strip() and line.strip().lower() != "serial_number"]

    if lower.endswith(".xlsx"):
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File exceeds 5 MB limit.")
        wb = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=False)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(c).strip().lower() if c else "" for c in rows[0]]
        col_idx = next((i for i, h in enumerate(headers) if h == "serial_number"), 0)
        start_row = 1 if headers[col_idx] == "serial_number" else 0
        out = []
        for r in rows[start_row:]:
            if col_idx < len(r) and r[col_idx] is not None:
                val = str(r[col_idx]).strip()
                if val.startswith(("=", "+", "-", "@")):
                    raise HTTPException(status_code=400, detail="Formula cells are not permitted.")
                out.append(val)
        return out

    raise HTTPException(status_code=400, detail="Only .csv or .xlsx files are supported.")


@router.post("/bulk-serials/preview")
async def preview_bulk_serials(
    variant_id: int = Form(...),
    serials_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == variant_id).first()
    if not variant or not variant.item or not variant.item.is_serialized:
        raise HTTPException(status_code=400, detail="Selected variant is not a serialized item.")

    raw_serials: List[str] = []
    if file is not None:
        contents = await file.read()
        raw_serials.extend(_extract_serials_from_file(file.filename, contents))
    if serials_text:
        raw_serials.extend([line.strip() for line in serials_text.splitlines() if line.strip()])

    if not raw_serials:
        raise HTTPException(status_code=400, detail="No serial numbers provided.")

    return _classify_serials(raw_serials, db)


@router.post("/bulk-serials/commit")
def commit_bulk_serials(
    payload: BulkSerialCommitPayload,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == payload.variant_id).first()
    if not variant or not variant.item or not variant.item.is_serialized:
        raise HTTPException(status_code=400, detail="Selected variant is not a serialized item.")

    check = _classify_serials(payload.serials, db)
    if check["duplicate_in_file"] or check["duplicate_in_db"] or check["invalid"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Cannot commit batch with duplicates or invalid serials.",
                "duplicate_in_file": check["duplicate_in_file"][:10],
                "duplicate_in_db": check["duplicate_in_db"][:10],
                "invalid": check["invalid"][:10],
            }
        )

    valid_serials = check["valid"]
    if not valid_serials:
        raise HTTPException(status_code=400, detail="No valid serial numbers to commit.")

    now = datetime.utcnow()
    batch = ReceiptBatch(
        batch_code=f"RCV-{now.year}-{uuid.uuid4().hex[:6].upper()}",
        variant_id=variant.variant_id,
        received_by=current_user.user_id,
        reference_note=payload.reference_note,
        unit_count=len(valid_serials),
        created_at=now,
    )
    db.add(batch)
    db.flush()
    batch.batch_code = f"RCV-{now.year}-{batch.batch_id:05d}"

    for sn in valid_serials:
        unit = AssetUnit(
            variant_id=variant.variant_id,
            serial_number=sn,
            status=AssetStatusEnum.IN_WAREHOUSE.value,
            current_location_id=None,
            receipt_batch_id=batch.batch_id,
            created_at=now,
        )
        db.add(unit)
        db.flush()
        db.add(AssetLifecycleEvent(
            asset_id=unit.asset_id,
            event_type="REGISTERED",
            performed_by=current_user.user_id,
            notes=f"Registered via Receipt Batch {batch.batch_code}. {payload.reference_note or ''}".strip(),
            timestamp=now,
        ))

    stock = db.query(InventoryStock).filter(InventoryStock.variant_id == variant.variant_id).with_for_update().first()
    if not stock:
        stock = InventoryStock(variant_id=variant.variant_id, current_quantity=0, reserved_quantity=0)
        db.add(stock)
    stock.current_quantity += len(valid_serials)
    stock.last_updated = now

    db.add(StockTransaction(
        variant_id=variant.variant_id,
        txn_type=TxnTypeEnum.RECEIVED.value,
        quantity=len(valid_serials),
        performed_by=current_user.user_id,
        timestamp=now,
    ))
    db.commit()
    db.refresh(batch)

    log_audit(
        db,
        action="BULK_SERIAL_INTAKE",
        details=f"Batch {batch.batch_code}: {len(valid_serials)}x {variant.item.name} ({variant.variant_name})",
        user_id=current_user.user_id,
        user_name=current_user.name,
        user_role=current_user.role,
    )

    return {
        "batch_id": batch.batch_id,
        "batch_code": batch.batch_code,
        "unit_count": batch.unit_count,
        "serials": valid_serials,
    }


@router.get("/receipt-batches")
def list_receipt_batches(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    batches = db.query(ReceiptBatch).order_by(ReceiptBatch.created_at.desc()).limit(50).all()
    return [
        {
            "batch_id": b.batch_id,
            "batch_code": b.batch_code,
            "variant_id": b.variant_id,
            "item_name": b.variant.item.name if b.variant and b.variant.item else "",
            "variant_name": b.variant.variant_name if b.variant else "",
            "received_by_name": b.receiver.name if b.receiver else "",
            "reference_note": b.reference_note,
            "unit_count": b.unit_count,
            "created_at": b.created_at,
        }
        for b in batches
    ]


@router.get("/receipt-batches/{batch_id}")
def get_receipt_batch_detail(
    batch_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    b = db.query(ReceiptBatch).filter(ReceiptBatch.batch_id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Receipt batch not found.")
    units = db.query(AssetUnit).filter(AssetUnit.receipt_batch_id == batch_id).order_by(AssetUnit.asset_id.asc()).all()
    return {
        "batch_id": b.batch_id,
        "batch_code": b.batch_code,
        "item_name": b.variant.item.name if b.variant and b.variant.item else "",
        "variant_name": b.variant.variant_name if b.variant else "",
        "reference_note": b.reference_note,
        "unit_count": b.unit_count,
        "created_at": b.created_at,
        "serials": [u.serial_number for u in units],
    }
