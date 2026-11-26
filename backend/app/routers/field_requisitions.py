import json
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import get_db
from ..models import (
    FieldRequisition, FieldConsumableAssignment, ItemVariant, Item,
    InventoryStock, AssetUnit, AssetStatusEnum, AssetLifecycleEvent,
    StockTransaction, TxnTypeEnum, User, RoleEnum, Location, Region,
    IdempotencyRecord, RequestModel, RequestStatusEnum
)
from ..schemas import (
    FieldRequisitionCreate, FieldRequisitionAction, FieldRequisitionOut,
    BulkFieldAssignRequest, BulkFieldAssignResponse, BulkFieldAssignResultItem,
    FieldConsumableAssignmentOut
)
from ..auth import get_current_user, require_manager_or_above
from ..engine import check_and_update_threshold_alerts
from ..websocket_manager import ws_manager
from ..audit import log_audit

router = APIRouter(prefix="/api/field-requisitions", tags=["Field Requisitions & Bulk Assignment"])


def _to_requisition_out(r: FieldRequisition, db: Session) -> FieldRequisitionOut:
    requester = r.requester
    reviewer = r.reviewer
    variant = r.variant
    item = variant.item if variant else None
    loc = r.location
    reg = r.region or (loc.region if loc else None)

    return FieldRequisitionOut(
        requisition_id=r.requisition_id,
        requested_by=r.requested_by,
        requester_name=requester.name if requester else "Field Technician",
        requester_email=requester.email if requester else "",
        location_id=r.location_id,
        location_name=loc.name if loc else "City Hub",
        city=loc.city if loc else "City",
        region_id=r.region_id or (loc.region_id if loc else None),
        region_name=reg.name if reg else "Region",
        variant_id=r.variant_id,
        item_name=item.name if item else "Item",
        variant_name=variant.variant_name if variant else "",
        category=item.category if item else "General",
        is_serialized=item.is_serialized if item else False,
        quantity_requested=r.quantity_requested,
        quantity_fulfilled=getattr(r, "quantity_fulfilled", 0) or 0,
        urgency=r.urgency,
        target_approver=r.target_approver,
        status=r.status,
        notes=r.notes,
        reviewed_by=r.reviewed_by,
        reviewer_name=reviewer.name if reviewer else None,
        reviewer_role=reviewer.role if reviewer else None,
        review_notes=r.review_notes,
        reviewed_at=r.reviewed_at,
        fulfilled_at=r.fulfilled_at,
        created_at=r.created_at,
    )


def _verify_reviewer_scope(current_user: User, location_id: int, region_id: Optional[int], db: Session):
    if current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        return
    if current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        loc = db.query(Location).filter(Location.location_id == location_id).first()
        eff_region = region_id or (loc.region_id if loc else None)
        if eff_region != current_user.region_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Requisition is outside your assigned region."
            )
        return
    if current_user.role in [RoleEnum.MANAGER.value, "MANAGER", "LOCATION_MANAGER"]:
        if location_id not in current_user.territory_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Requisition is outside your assigned city hub."
            )
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager or Regional Admin role required.")


def _find_available_serials(
    db: Session,
    variant_id: int,
    needed: int,
    preferred_location_id: Optional[int] = None,
    preferred_region_id: Optional[int] = None,
    explicit_asset_ids: Optional[List[int]] = None,
) -> List[AssetUnit]:
    if explicit_asset_ids:
        assets = db.query(AssetUnit).filter(
            AssetUnit.asset_id.in_(explicit_asset_ids),
            AssetUnit.variant_id == variant_id,
            AssetUnit.current_holder_id.is_(None),
            AssetUnit.status.in_([AssetStatusEnum.IN_WAREHOUSE.value, AssetStatusEnum.DISPATCHED.value])
        ).all()
        if len(assets) < needed:
            raise HTTPException(
                status_code=400,
                detail=f"Only {len(assets)} of the selected serials are available for assignment (needed {needed})."
            )
        return assets[:needed]

    candidates = db.query(AssetUnit).filter(
        AssetUnit.variant_id == variant_id,
        AssetUnit.current_holder_id.is_(None),
        AssetUnit.status.in_([AssetStatusEnum.IN_WAREHOUSE.value, AssetStatusEnum.DISPATCHED.value])
    ).order_by(AssetUnit.asset_id.asc()).all()

    if len(candidates) < needed:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient unassigned serial units available ({len(candidates)} available, {needed} requested)."
        )

    # Prioritize units already at target city hub, then same region, then central warehouse
    def _priority(a: AssetUnit):
        if preferred_location_id and a.current_location_id == preferred_location_id:
            return (0, a.asset_id)
        if preferred_region_id and a.location and a.location.region_id == preferred_region_id:
            return (1, a.asset_id)
        if a.current_location_id is None:
            return (2, a.asset_id)
        return (3, a.asset_id)

    candidates.sort(key=_priority)
    return candidates[:needed]


@router.post("", response_model=FieldRequisitionOut)
async def create_field_requisition(
    payload: FieldRequisitionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if payload.quantity_requested < 1:
        raise HTTPException(status_code=400, detail="Quantity requested must be at least 1.")

    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == payload.variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Item variant not found.")

    loc_id = current_user.city_id or current_user.location_id or 1
    loc = db.query(Location).filter(Location.location_id == loc_id).first()
    reg_id = current_user.region_id or (loc.region_id if loc else None)

    urgency = payload.urgency.upper() if payload.urgency else "NORMAL"
    if urgency not in ["NORMAL", "URGENT", "CRITICAL"]:
        urgency = "NORMAL"

    target = payload.target_approver.upper() if payload.target_approver else "BOTH"
    if target not in ["BOTH", "CITY_MANAGER", "REGIONAL_ADMIN"]:
        target = "BOTH"

    req = FieldRequisition(
        requested_by=current_user.user_id,
        location_id=loc_id,
        region_id=reg_id,
        variant_id=payload.variant_id,
        quantity_requested=payload.quantity_requested,
        urgency=urgency,
        target_approver=target,
        status="PENDING",
        notes=payload.notes,
        created_at=datetime.utcnow()
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    log_audit(
        db,
        action="FIELD_REQUISITION_CREATED",
        details=f"Tech {current_user.name} requested {payload.quantity_requested}x {variant.item.name} ({variant.variant_name}) -> {target}",
        user_id=current_user.user_id,
        user_name=current_user.name,
        user_role=current_user.role,
    )

    await ws_manager.broadcast({
        "type": "FIELD_REQUISITION_CREATED",
        "event": "FIELD_REQUISITION_CREATED",
        "region_id": req.region_id,
        "location_id": req.location_id,
        "data": {
            "requisition_id": req.requisition_id,
            "requester_name": current_user.name,
            "location_name": loc.name if loc else "City Hub",
            "item_name": variant.item.name if variant.item else "",
            "quantity_requested": req.quantity_requested,
            "urgency": req.urgency,
            "target_approver": req.target_approver,
        }
    })

    return _to_requisition_out(req, db)


@router.get("", response_model=List[FieldRequisitionOut])
def list_field_requisitions(
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(FieldRequisition)

    if current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        pass
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        query = query.filter(FieldRequisition.region_id == current_user.region_id)
    elif current_user.role in [RoleEnum.MANAGER.value, "MANAGER", "LOCATION_MANAGER"]:
        query = query.filter(FieldRequisition.location_id.in_(current_user.territory_ids))
    else:
        query = query.filter(FieldRequisition.requested_by == current_user.user_id)

    if status_filter and status_filter != "ALL":
        query = query.filter(FieldRequisition.status == status_filter)

    rows = query.order_by(FieldRequisition.created_at.desc()).all()
    return [_to_requisition_out(r, db) for r in rows]


@router.put("/{requisition_id}/approve", response_model=FieldRequisitionOut)
async def approve_field_requisition(
    requisition_id: int,
    payload: FieldRequisitionAction = FieldRequisitionAction(),
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    req = db.query(FieldRequisition).filter(FieldRequisition.requisition_id == requisition_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Field requisition not found.")
    _verify_reviewer_scope(current_user, req.location_id, req.region_id, db)

    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot approve requisition in '{req.status}' status.")

    req.status = "APPROVED"
    req.reviewed_by = current_user.user_id
    req.review_notes = payload.review_notes or "Approved for hub/field dispatch"
    req.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(req)

    log_audit(db, action="FIELD_REQUISITION_APPROVED", details=f"Approved requisition #{req.requisition_id}", user_id=current_user.user_id, user_name=current_user.name, user_role=current_user.role)
    await ws_manager.broadcast({
        "type": "FIELD_REQUISITION_UPDATED",
        "region_id": req.region_id,
        "location_id": req.location_id,
        "target_user_id": req.requested_by,
        "data": {
            "requisition_id": req.requisition_id,
            "status": req.status,
            "reviewer_name": current_user.name,
            "item_name": req.variant.item.name if req.variant and req.variant.item else "Gear",
        },
    })
    return _to_requisition_out(req, db)


@router.put("/{requisition_id}/fulfill", response_model=FieldRequisitionOut)
async def fulfill_field_requisition(
    requisition_id: int,
    payload: FieldRequisitionAction = FieldRequisitionAction(),
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    req = db.query(FieldRequisition).filter(FieldRequisition.requisition_id == requisition_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Field requisition not found.")
    _verify_reviewer_scope(current_user, req.location_id, req.region_id, db)

    if req.status not in ["PENDING", "APPROVED", "PARTIALLY_FULFILLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot fulfill requisition in '{req.status}' status.")

    remaining_needed = max(1, req.quantity_requested - (getattr(req, "quantity_fulfilled", 0) or 0))
    qty_to_fulfill = payload.fulfill_quantity if payload.fulfill_quantity is not None else remaining_needed
    if qty_to_fulfill < 1 or qty_to_fulfill > remaining_needed:
        raise HTTPException(status_code=400, detail=f"fulfill_quantity must be between 1 and {remaining_needed}.")

    variant = req.variant
    is_serialized = variant.item.is_serialized if variant and variant.item else False

    if is_serialized:
        assets = _find_available_serials(
            db,
            variant_id=req.variant_id,
            needed=qty_to_fulfill,
            preferred_location_id=req.location_id,
            preferred_region_id=req.region_id,
            explicit_asset_ids=payload.asset_ids,
        )
        for asset in assets:
            old_holder_id = asset.current_holder_id
            old_loc_id = asset.current_location_id
            asset.current_holder_id = req.requested_by
            asset.current_location_id = req.location_id
            asset.status = AssetStatusEnum.ASSIGNED.value
            asset.tech_delivery_status = "DISPATCHED"
            db.add(AssetLifecycleEvent(
                asset_id=asset.asset_id,
                event_type="ASSIGNED",
                from_holder_id=old_holder_id,
                to_holder_id=req.requested_by,
                from_location_id=old_loc_id,
                to_location_id=req.location_id,
                performed_by=current_user.user_id,
                notes=f"Fulfilled {qty_to_fulfill}x for Field Requisition #{req.requisition_id}. {payload.review_notes or ''}".strip(),
                timestamp=datetime.utcnow()
            ))
    else:
        stock = db.query(InventoryStock).filter(InventoryStock.variant_id == req.variant_id).with_for_update().first()
        available = (stock.current_quantity - (stock.reserved_quantity or 0)) if stock else 0
        if available < qty_to_fulfill:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {variant.item.name} ({variant.variant_name}): {available} available, {qty_to_fulfill} requested."
            )
        stock.current_quantity -= qty_to_fulfill
        stock.last_updated = datetime.utcnow()

        db.add(StockTransaction(
            variant_id=req.variant_id,
            txn_type=TxnTypeEnum.DISPATCHED.value,
            quantity=-qty_to_fulfill,
            performed_by=current_user.user_id,
            timestamp=datetime.utcnow()
        ))
        db.add(FieldConsumableAssignment(
            user_id=req.requested_by,
            variant_id=req.variant_id,
            location_id=req.location_id,
            quantity=qty_to_fulfill,
            assigned_by=current_user.user_id,
            notes=payload.review_notes or f"Fulfilled Requisition #{req.requisition_id}",
            delivery_status="DISPATCHED",
            assigned_at=datetime.utcnow()
        ))
        check_and_update_threshold_alerts(db, req.variant_id)

    now = datetime.utcnow()
    req.quantity_fulfilled = (getattr(req, "quantity_fulfilled", 0) or 0) + qty_to_fulfill
    shortage = max(0, req.quantity_requested - req.quantity_fulfilled)
    if shortage == 0:
        req.status = "FULFILLED"
        req.fulfilled_at = now
    else:
        req.status = "PARTIALLY_FULFILLED"
        if payload.create_hub_refill_for_shortage:
            db.add(RequestModel(
                variant_id=req.variant_id,
                location_id=req.location_id,
                quantity_requested=shortage,
                status=RequestStatusEnum.PENDING.value,
                requested_by=current_user.user_id,
            ))

    req.reviewed_by = current_user.user_id
    req.review_notes = payload.review_notes or (
        f"Partially fulfilled {req.quantity_fulfilled}/{req.quantity_requested}" if shortage > 0 else "Fulfilled and assigned to technician"
    )
    req.reviewed_at = req.reviewed_at or now
    db.commit()
    db.refresh(req)

    log_audit(db, action="FIELD_REQUISITION_FULFILLED", details=f"Fulfilled {qty_to_fulfill}x for requisition #{req.requisition_id} ({variant.item.name})", user_id=current_user.user_id, user_name=current_user.name, user_role=current_user.role)
    await ws_manager.broadcast({
        "type": "FIELD_REQUISITION_UPDATED",
        "region_id": req.region_id,
        "location_id": req.location_id,
        "target_user_id": req.requested_by,
        "data": {
            "requisition_id": req.requisition_id,
            "status": req.status,
            "reviewer_name": current_user.name,
            "item_name": variant.item.name if variant and variant.item else "Gear",
        },
    })
    return _to_requisition_out(req, db)


@router.put("/{requisition_id}/reject", response_model=FieldRequisitionOut)
async def reject_field_requisition(
    requisition_id: int,
    payload: FieldRequisitionAction = FieldRequisitionAction(),
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    req = db.query(FieldRequisition).filter(FieldRequisition.requisition_id == requisition_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Field requisition not found.")
    _verify_reviewer_scope(current_user, req.location_id, req.region_id, db)

    if req.status not in ["PENDING", "APPROVED"]:
        raise HTTPException(status_code=400, detail=f"Cannot reject requisition in '{req.status}' status.")

    req.status = "REJECTED"
    req.reviewed_by = current_user.user_id
    req.review_notes = payload.review_notes or "Rejected by supervisor"
    req.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(req)

    log_audit(db, action="FIELD_REQUISITION_REJECTED", details=f"Rejected requisition #{req.requisition_id}", user_id=current_user.user_id, user_name=current_user.name, user_role=current_user.role)
    await ws_manager.broadcast({
        "type": "FIELD_REQUISITION_UPDATED",
        "region_id": req.region_id,
        "location_id": req.location_id,
        "target_user_id": req.requested_by,
        "data": {
            "requisition_id": req.requisition_id,
            "status": req.status,
            "reviewer_name": current_user.name,
            "item_name": req.variant.item.name if req.variant and req.variant.item else "Gear",
        },
    })
    return _to_requisition_out(req, db)


@router.get("/technicians")
def list_scoped_technicians(
    city_id: Optional[int] = Query(None),
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    query = db.query(User).filter(User.role == RoleEnum.FIELD_WORKER.value, User.is_active == 1)

    if current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        if city_id:
            query = query.filter(User.city_id == city_id)
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        query = query.join(Location, User.city_id == Location.location_id).filter(
            Location.region_id == current_user.region_id
        )
        if city_id:
            query = query.filter(User.city_id == city_id)
    else:
        query = query.filter(User.city_id.in_(current_user.territory_ids))

    techs = query.order_by(User.name.asc()).all()
    results = []
    for t in techs:
        serial_count = db.query(AssetUnit).filter(AssetUnit.current_holder_id == t.user_id).count()
        consumable_rows = db.query(FieldConsumableAssignment).filter(FieldConsumableAssignment.user_id == t.user_id).all()
        consumable_qty = sum(c.quantity for c in consumable_rows)
        results.append({
            "user_id": t.user_id,
            "name": t.name,
            "email": t.email,
            "city_id": t.city_id,
            "location_name": t.city_location.name if t.city_location else "City Hub",
            "city": t.city_location.city if t.city_location else "City",
            "assigned_assets_count": serial_count,
            "assigned_consumables_count": consumable_qty,
        })
    return results


@router.get("/technicians/{user_id}/holdings")
def get_technician_holdings(
    user_id: int,
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    tech = db.query(User).filter(User.user_id == user_id).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found.")
    tech_loc_id = tech.city_id or 1
    tech_loc = db.query(Location).filter(Location.location_id == tech_loc_id).first()
    _verify_reviewer_scope(current_user, tech_loc_id, tech_loc.region_id if tech_loc else None, db)

    serials = db.query(AssetUnit).filter(AssetUnit.current_holder_id == user_id).all()
    consumables = db.query(FieldConsumableAssignment).filter(FieldConsumableAssignment.user_id == user_id).order_by(FieldConsumableAssignment.assigned_at.desc()).all()

    return {
        "user_id": tech.user_id,
        "name": tech.name,
        "serialized_assets": [
            {
                "asset_id": a.asset_id,
                "serial_number": a.serial_number,
                "item_name": a.variant.item.name if a.variant and a.variant.item else "Item",
                "variant_name": a.variant.variant_name if a.variant else "",
                "status": a.status,
                "tech_delivery_status": getattr(a, "tech_delivery_status", "DELIVERED") or "DELIVERED",
            }
            for a in serials
        ],
        "consumables": [
            {
                "assignment_id": c.assignment_id,
                "item_name": c.variant.item.name if c.variant and c.variant.item else "Item",
                "variant_name": c.variant.variant_name if c.variant else "",
                "quantity": c.quantity,
                "delivery_status": getattr(c, "delivery_status", "DISPATCHED") or "DISPATCHED",
                "assigned_at": c.assigned_at,
            }
            for c in consumables
        ],
    }


@router.put("/{requisition_id}/cancel", response_model=FieldRequisitionOut)
def cancel_field_requisition(
    requisition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.query(FieldRequisition).filter(FieldRequisition.requisition_id == requisition_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Field requisition not found.")
    if req.requested_by != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the requester can cancel this requisition.")
    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Only PENDING requisitions can be cancelled (current: {req.status}).")
    req.status = "CANCELLED"
    req.reviewed_at = datetime.utcnow()
    req.review_notes = "Cancelled by requester"
    db.commit()
    db.refresh(req)
    log_audit(db, action="FIELD_REQUISITION_CANCELLED", details=f"Cancelled requisition #{req.requisition_id}", user_id=current_user.user_id, user_name=current_user.name, user_role=current_user.role)
    return _to_requisition_out(req, db)


@router.post("/return-asset/{asset_id}")
def return_asset_to_hub(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    asset = db.query(AssetUnit).filter(AssetUnit.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
    is_staff = current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN", RoleEnum.REGIONAL_ADMIN.value, RoleEnum.MANAGER.value, "LOCATION_MANAGER"]
    if not is_staff and asset.current_holder_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to return this asset.")
    old_holder_id = asset.current_holder_id
    asset.current_holder_id = None
    asset.status = AssetStatusEnum.IN_WAREHOUSE.value
    asset.tech_delivery_status = "DELIVERED"
    db.add(AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type="RETURNED_TO_HUB",
        from_holder_id=old_holder_id,
        from_location_id=asset.current_location_id,
        to_location_id=asset.current_location_id,
        performed_by=current_user.user_id,
        notes=f"Returned to hub stock by {current_user.name}.",
        timestamp=datetime.utcnow(),
    ))
    db.commit()
    log_audit(db, action="ASSET_RETURNED_TO_HUB", details=f"Returned {asset.serial_number} to hub", user_id=current_user.user_id, user_name=current_user.name, user_role=current_user.role)
    return {"message": f"Asset {asset.serial_number} returned to hub.", "asset_id": asset_id}


@router.post("/return-consumable/{assignment_id}")
def return_consumable_to_hub(
    assignment_id: int,
    quantity: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(FieldConsumableAssignment).filter(FieldConsumableAssignment.assignment_id == assignment_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    is_staff = current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN", RoleEnum.REGIONAL_ADMIN.value, RoleEnum.MANAGER.value, "LOCATION_MANAGER"]
    if not is_staff and rec.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to return this item.")
    qty = quantity if quantity is not None else rec.quantity
    if qty < 1 or qty > rec.quantity:
        raise HTTPException(status_code=400, detail=f"Return quantity must be between 1 and {rec.quantity}.")

    stock = db.query(InventoryStock).filter(InventoryStock.variant_id == rec.variant_id).with_for_update().first()
    if stock:
        stock.current_quantity += qty
        stock.last_updated = datetime.utcnow()
    db.add(StockTransaction(
        variant_id=rec.variant_id,
        txn_type=TxnTypeEnum.RECEIVED.value,
        quantity=qty,
        performed_by=current_user.user_id,
        timestamp=datetime.utcnow(),
    ))
    rec.quantity -= qty
    if rec.quantity <= 0:
        db.delete(rec)
    db.commit()
    log_audit(db, action="CONSUMABLE_RETURNED_TO_HUB", details=f"Returned {qty}x variant #{rec.variant_id} to hub", user_id=current_user.user_id, user_name=current_user.name, user_role=current_user.role)
    return {"message": f"Returned {qty} unit(s) to hub stock."}


@router.post("/consume-consumable/{assignment_id}")
def consume_consumable_on_job(
    assignment_id: int,
    quantity: int = Query(1, ge=1),
    work_order_no: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(FieldConsumableAssignment).filter(FieldConsumableAssignment.assignment_id == assignment_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if rec.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the assigned technician can mark gear as used.")
    if quantity > rec.quantity:
        raise HTTPException(status_code=400, detail=f"Cannot consume {quantity}; only {rec.quantity} remaining.")
    rec.quantity -= quantity
    if rec.quantity <= 0:
        db.delete(rec)
    db.commit()
    log_audit(db, action="CONSUMABLE_USED_ON_JOB", details=f"{current_user.name} used {quantity}x variant #{rec.variant_id} on {work_order_no or 'field job'}", user_id=current_user.user_id, user_name=current_user.name, user_role=current_user.role)
    return {"message": f"Marked {quantity} unit(s) used on job."}


@router.get("/my-consumables", response_model=List[FieldConsumableAssignmentOut])
def list_consumable_assignments(
    user_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(FieldConsumableAssignment)
    if current_user.role == RoleEnum.FIELD_WORKER.value:
        query = query.filter(FieldConsumableAssignment.user_id == current_user.user_id)
    elif current_user.role in [RoleEnum.MANAGER.value, "MANAGER", "LOCATION_MANAGER"]:
        query = query.filter(FieldConsumableAssignment.location_id.in_(current_user.territory_ids))
        if user_id:
            query = query.filter(FieldConsumableAssignment.user_id == user_id)
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        query = query.join(Location, FieldConsumableAssignment.location_id == Location.location_id).filter(
            Location.region_id == current_user.region_id
        )
        if user_id:
            query = query.filter(FieldConsumableAssignment.user_id == user_id)
    elif user_id:
        query = query.filter(FieldConsumableAssignment.user_id == user_id)

    rows = query.order_by(FieldConsumableAssignment.assigned_at.desc()).limit(100).all()
    return [
        FieldConsumableAssignmentOut(
            assignment_id=r.assignment_id,
            user_id=r.user_id,
            technician_name=r.technician.name if r.technician else "Technician",
            variant_id=r.variant_id,
            item_name=r.variant.item.name if r.variant and r.variant.item else "Item",
            variant_name=r.variant.variant_name if r.variant else "",
            category=r.variant.item.category if r.variant and r.variant.item else "General",
            location_id=r.location_id,
            location_name=r.location.name if r.location else "City Hub",
            quantity=r.quantity,
            assigned_by=r.assigned_by,
            assigner_name=r.assigner.name if r.assigner else "Supervisor",
            notes=r.notes,
            image_url=r.variant.item.image_url if r.variant and r.variant.item else None,
            delivery_status=getattr(r, "delivery_status", "DISPATCHED") or "DISPATCHED",
            delivered_at=getattr(r, "delivered_at", None),
            assigned_at=r.assigned_at,
        )
        for r in rows
    ]


@router.post("/confirm-consumable/{assignment_id}")
def confirm_consumable_delivery(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(FieldConsumableAssignment).filter(FieldConsumableAssignment.assignment_id == assignment_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if rec.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the assigned technician can confirm delivery.")
    rec.delivery_status = "DELIVERED"
    rec.delivered_at = datetime.utcnow()
    db.commit()
    log_audit(db, "TECH_CONFIRMED_CONSUMABLE", f"{current_user.name} confirmed receipt of assignment #{assignment_id}", current_user.user_id, current_user.name, current_user.role)
    return {"message": "Delivery confirmed.", "assignment_id": assignment_id, "delivery_status": "DELIVERED"}


@router.post("/confirm-asset/{asset_id}")
def confirm_asset_delivery(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    asset = db.query(AssetUnit).filter(AssetUnit.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
    if asset.current_holder_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the assigned technician can confirm delivery.")
    asset.tech_delivery_status = "DELIVERED"
    db.add(AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type="DELIVERY_CONFIRMED_BY_TECH",
        to_holder_id=current_user.user_id,
        to_location_id=asset.current_location_id,
        performed_by=current_user.user_id,
        notes=f"{current_user.name} confirmed physical receipt of {asset.serial_number}.",
        timestamp=datetime.utcnow(),
    ))
    db.commit()
    log_audit(db, "TECH_CONFIRMED_ASSET", f"{current_user.name} confirmed receipt of {asset.serial_number}", current_user.user_id, current_user.name, current_user.role)
    return {"message": "Delivery confirmed.", "asset_id": asset_id, "tech_delivery_status": "DELIVERED"}


@router.post("/bulk-assign", response_model=BulkFieldAssignResponse)
async def bulk_assign_to_field(
    payload: BulkFieldAssignRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(require_manager_or_above),
    db: Session = Depends(get_db)
):
    """
    Optimized bulk distribution of consumables (e.g. 50 T-shirts) or batch auto-assignment
    of serialized machines/devices across multiple field technicians in a single transaction.
    Supports Idempotency-Key header to prevent duplicate assignments on retry.
    """
    if idempotency_key:
        existing = db.query(IdempotencyRecord).filter(
            IdempotencyRecord.idempotency_key == idempotency_key,
            IdempotencyRecord.endpoint == "/api/field-requisitions/bulk-assign",
            IdempotencyRecord.user_id == current_user.user_id,
        ).first()
        if existing:
            return BulkFieldAssignResponse(**json.loads(existing.response_json))
    allocations = [a for a in payload.allocations if a.quantity > 0]
    if not allocations:
        raise HTTPException(status_code=400, detail="Specify at least one technician with quantity > 0.")

    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == payload.variant_id).first()
    if not variant or not variant.item:
        raise HTTPException(status_code=404, detail="Item variant not found.")

    total_needed = sum(a.quantity for a in allocations)
    is_serialized = bool(variant.item.is_serialized)

    # Validate all target technicians and scope
    tech_map = {}
    for alloc in allocations:
        tech = db.query(User).filter(User.user_id == alloc.user_id).first()
        if not tech:
            raise HTTPException(status_code=404, detail=f"Technician #{alloc.user_id} not found.")
        tech_loc_id = tech.city_id or 1
        tech_loc = db.query(Location).filter(Location.location_id == tech_loc_id).first()
        _verify_reviewer_scope(current_user, tech_loc_id, tech_loc.region_id if tech_loc else None, db)
        tech_map[alloc.user_id] = (tech, tech_loc_id, tech_loc)

    results: List[BulkFieldAssignResultItem] = []
    remaining_stock: Optional[int] = None
    now = datetime.utcnow()

    if is_serialized:
        serial_pool = _find_available_serials(
            db,
            variant_id=variant.variant_id,
            needed=total_needed,
            preferred_location_id=current_user.city_id,
            preferred_region_id=current_user.region_id,
            explicit_asset_ids=payload.asset_ids if not payload.auto_assign_serials else None,
        )
        cursor = 0
        for alloc in allocations:
            tech, tech_loc_id, tech_loc = tech_map[alloc.user_id]
            slice_units = serial_pool[cursor : cursor + alloc.quantity]
            cursor += alloc.quantity
            assigned_serials = []
            for asset in slice_units:
                old_holder_id = asset.current_holder_id
                old_loc_id = asset.current_location_id
                asset.current_holder_id = tech.user_id
                asset.current_location_id = tech_loc_id
                asset.status = AssetStatusEnum.ASSIGNED.value
                asset.tech_delivery_status = "DISPATCHED"
                assigned_serials.append(asset.serial_number)
                db.add(AssetLifecycleEvent(
                    asset_id=asset.asset_id,
                    event_type="ASSIGNED",
                    from_holder_id=old_holder_id,
                    to_holder_id=tech.user_id,
                    from_location_id=old_loc_id,
                    to_location_id=tech_loc_id,
                    performed_by=current_user.user_id,
                    notes=f"Bulk field assignment to {tech.name}. {payload.notes or ''}".strip(),
                    timestamp=now
                ))
            results.append(BulkFieldAssignResultItem(
                user_id=tech.user_id,
                user_name=tech.name,
                city_name=tech_loc.name if tech_loc else "City Hub",
                quantity_assigned=len(assigned_serials),
                assigned_serials=assigned_serials,
            ))

        remaining_stock = db.query(AssetUnit).filter(
            AssetUnit.variant_id == variant.variant_id,
            AssetUnit.current_holder_id.is_(None),
            AssetUnit.status.in_([AssetStatusEnum.IN_WAREHOUSE.value, AssetStatusEnum.DISPATCHED.value])
        ).count()
    else:
        stock = db.query(InventoryStock).filter(InventoryStock.variant_id == variant.variant_id).with_for_update().first()
        available = (stock.current_quantity - (stock.reserved_quantity or 0)) if stock else 0
        if available < total_needed:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient unreserved stock: {available} units available for {variant.item.name} ({variant.variant_name}), but {total_needed} requested for assignment."
            )
        stock.current_quantity -= total_needed
        stock.last_updated = now
        remaining_stock = stock.current_quantity

        db.add(StockTransaction(
            variant_id=variant.variant_id,
            txn_type=TxnTypeEnum.DISPATCHED.value,
            quantity=-total_needed,
            performed_by=current_user.user_id,
            timestamp=now
        ))

        for alloc in allocations:
            tech, tech_loc_id, tech_loc = tech_map[alloc.user_id]
            db.add(FieldConsumableAssignment(
                user_id=tech.user_id,
                variant_id=variant.variant_id,
                location_id=tech_loc_id,
                quantity=alloc.quantity,
                assigned_by=current_user.user_id,
                notes=payload.notes or "Bulk field gear distribution",
                delivery_status="DISPATCHED",
                assigned_at=now
            ))
            results.append(BulkFieldAssignResultItem(
                user_id=tech.user_id,
                user_name=tech.name,
                city_name=tech_loc.name if tech_loc else "City Hub",
                quantity_assigned=alloc.quantity,
                assigned_serials=[],
            ))
        check_and_update_threshold_alerts(db, variant.variant_id)

    fulfilled_count = 0
    if payload.auto_fulfill_requisitions:
        target_user_ids = [a.user_id for a in allocations]
        pending_reqs = db.query(FieldRequisition).filter(
            FieldRequisition.requested_by.in_(target_user_ids),
            FieldRequisition.variant_id == variant.variant_id,
            FieldRequisition.status.in_(["PENDING", "APPROVED"])
        ).all()
        for r in pending_reqs:
            r.status = "FULFILLED"
            r.reviewed_by = current_user.user_id
            r.review_notes = "Auto-fulfilled via bulk field assignment"
            r.reviewed_at = r.reviewed_at or now
            r.fulfilled_at = now
            fulfilled_count += 1

    db.commit()

    log_audit(
        db,
        action="BULK_FIELD_ASSIGNMENT",
        details=f"Assigned {total_needed}x {variant.item.name} ({variant.variant_name}) across {len(results)} technicians.",
        user_id=current_user.user_id,
        user_name=current_user.name,
        user_role=current_user.role,
    )

    resp = BulkFieldAssignResponse(
        message=f"Successfully assigned {total_needed}x {variant.item.name} ({variant.variant_name}) to {len(results)} field technician(s).",
        variant_id=variant.variant_id,
        item_name=variant.item.name,
        variant_name=variant.variant_name,
        is_serialized=is_serialized,
        total_assigned=total_needed,
        remaining_stock=remaining_stock,
        fulfilled_requisitions_count=fulfilled_count,
        results=results,
    )
    if idempotency_key:
        db.add(IdempotencyRecord(
            idempotency_key=idempotency_key,
            endpoint="/api/field-requisitions/bulk-assign",
            user_id=current_user.user_id,
            response_json=resp.model_dump_json(),
        ))
        db.commit()
    for r in results:
        await ws_manager.broadcast({
            "type": "FIELD_ASSIGNMENT_COMPLETED",
            "target_user_id": r.user_id,
            "data": {
                "item_name": variant.item.name,
                "variant_name": variant.variant_name,
                "quantity": r.quantity_assigned,
                "assigner_name": current_user.name,
            },
        })
    return resp
