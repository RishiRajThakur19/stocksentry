from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
import random

from ..database import get_db
from ..models import (
    RequestModel, RequestStatusEnum, InventoryStock, ItemVariant, AssetUnit, 
    AssetStatusEnum, StockTransaction, TxnTypeEnum, User, RoleEnum, Location, Region
)
from ..schemas import RequestCreatePayload, RequestDispatchPayload, RequestOut
from ..auth import get_current_user, require_admin, require_super_admin, require_regional_or_super_admin, verify_user_scope_for_location
from ..engine import check_and_update_threshold_alerts
from ..websocket_manager import ws_manager
from ..audit import log_audit

router = APIRouter(prefix="/api/requests", tags=["City Requests"])

def to_request_out(r: RequestModel, db: Session) -> RequestOut:
    requester = db.query(User).filter(User.user_id == r.requested_by).first() if r.requested_by else None
    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == r.variant_id).first()
    item = variant.item if variant else None
    loc = db.query(Location).filter(Location.location_id == r.location_id).first() if r.location_id else None
    region = loc.region if loc else None

    return RequestOut(
        request_id=r.request_id,
        requested_by=r.requested_by,
        location_id=r.location_id,
        variant_id=r.variant_id,
        quantity_requested=r.quantity_requested,
        status=r.status,
        created_at=r.created_at,
        approved_by=r.approved_by,
        approved_at=r.approved_at,
        dispatched_by=r.dispatched_by,
        dispatched_at=r.dispatched_at,
        delivered_at=r.delivered_at,
        carrier_name=r.carrier_name,
        tracking_number=r.tracking_number,
        estimated_delivery=r.estimated_delivery,
        requester_name=requester.name if requester else "City Manager",
        location_name=loc.name if loc else "City Hub",
        city=loc.city if loc else "Regional City",
        region_id=loc.region_id if loc else None,
        region_name=region.name if region else "Central Region",
        source_location_name="Central Warehouse (Main Hub)",
        source_latitude=28.6139,
        source_longitude=77.2090,
        destination_latitude=loc.latitude if loc else 28.6139,
        destination_longitude=loc.longitude if loc else 77.2090,
        variant_name=variant.variant_name if variant else "",
        item_name=item.name if item else "Item SKU",
        is_serialized=item.is_serialized if item else False,
        unit_cost=variant.unit_cost if variant else 0.0
    )

@router.post("", response_model=RequestOut)
async def create_request(
    payload: RequestCreatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == payload.variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Item Variant not found")

    user_city_id = current_user.city_id or current_user.location_id

    # Determine target location with strict scope validation
    if current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        target_location_id = payload.location_id or user_city_id or 1
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        target_location_id = payload.location_id or user_city_id or 1
        loc = db.query(Location).filter(Location.location_id == target_location_id).first()
        if not loc or loc.region_id != current_user.region_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You can only create requests for locations within your assigned region."
            )
    elif current_user.role == RoleEnum.FIELD_WORKER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Field Technicians handle installation and subscriber repairs and are not authorized to create warehouse stock or procurement orders. Replenishment is managed by City Hub Managers."
        )
    elif current_user.role in [RoleEnum.MANAGER.value, "MANAGER", "LOCATION_MANAGER"]:
        if payload.location_id and payload.location_id != user_city_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Managers can only create requests for their assigned city hub."
            )
        target_location_id = user_city_id
        if not target_location_id:
            raise HTTPException(status_code=400, detail="User does not have an assigned city location.")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: Insufficient permissions")

    req = RequestModel(
        requested_by=current_user.user_id,
        location_id=target_location_id,
        variant_id=payload.variant_id,
        quantity_requested=payload.quantity_requested,
        status=RequestStatusEnum.PENDING.value,
        created_at=datetime.utcnow()
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    log_audit(db, "CREATE_REQUEST", f"{current_user.name} ({current_user.role}) requested {req.quantity_requested}x '{variant.item.name} - {variant.variant_name}'", current_user.user_id, current_user.name, current_user.role)

    await ws_manager.broadcast({
        "type": "ORDER_CREATED",
        "payload": {
            "order_id": req.request_id,
            "request_id": req.request_id,
            "requester_id": current_user.user_id,
            "requester_name": current_user.name,
            "location_name": req.location.name if req.location else "City Hub",
            "item_name": variant.item.name if variant.item else "",
            "variant_name": variant.variant_name,
            "quantity_requested": req.quantity_requested,
            "status": req.status
        }
    })

    return to_request_out(req, db)

@router.get("", response_model=List[RequestOut])
def list_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Role-Scoped Requests List:
    - SUPER_ADMIN: all requests across India.
    - REGIONAL_ADMIN: only requests from cities within their region.
    - MANAGER: only requests for their assigned city.
    - FIELD_WORKER: only requests requested by themselves.
    """
    query = db.query(RequestModel)

    if current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        pass # All requests
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        query = query.join(Location, RequestModel.location_id == Location.location_id).filter(
            Location.region_id == current_user.region_id
        )
    elif current_user.role == RoleEnum.MANAGER.value:
        user_city_id = current_user.city_id or current_user.location_id
        query = query.filter(RequestModel.location_id == user_city_id)
    elif current_user.role == RoleEnum.FIELD_WORKER.value:
        query = query.filter(RequestModel.requested_by == current_user.user_id)
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: Insufficient permissions")

    requests = query.order_by(RequestModel.created_at.desc()).all()
    return [to_request_out(r, db) for r in requests]

@router.get("/{request_id}", response_model=RequestOut)
def get_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.query(RequestModel).filter(RequestModel.request_id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Scope verification
    if current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        pass
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        loc = req.location
        if not loc or loc.region_id != current_user.region_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: Request is outside your assigned region.")
    elif current_user.role == RoleEnum.MANAGER.value:
        user_city_id = current_user.city_id or current_user.location_id
        if req.location_id != user_city_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: Request is outside your assigned city.")
    elif current_user.role == RoleEnum.FIELD_WORKER.value:
        if req.requested_by != current_user.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: You can only view your own requests.")

    return to_request_out(req, db)

@router.put("/{request_id}/approve", response_model=RequestOut)
async def approve_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Regional Admin approves stock requests for Managers within their region.
    Returns 403 if out-of-scope or unauthorized.
    """
    if current_user.role not in [RoleEnum.REGIONAL_ADMIN.value, RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: Regional Admin role required to approve requests.")

    req = db.query(RequestModel).filter(RequestModel.request_id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # If Regional Admin, verify request belongs to their region
    if current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        loc = req.location
        if not loc or loc.region_id != current_user.region_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: You can only approve requests for your assigned region."
            )

    if req.status != RequestStatusEnum.PENDING.value:
        raise HTTPException(status_code=400, detail=f"Request is already in {req.status} status")

    req.status = RequestStatusEnum.APPROVED.value
    req.approved_by = current_user.user_id
    req.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(req)

    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == req.variant_id).first()
    item = variant.item if variant else None

    log_audit(db, "APPROVE_REQUEST", f"{current_user.name} ({current_user.role}) approved Request #{req.request_id} ({req.quantity_requested}x {item.name if item else ''})", current_user.user_id, current_user.name, current_user.role)

    await ws_manager.broadcast({
        "type": "ORDER_APPROVED",
        "payload": {
            "order_id": req.request_id,
            "request_id": req.request_id,
            "location_name": req.location.name if req.location else "",
            "item_name": item.name if item else "",
            "variant_name": variant.variant_name if variant else "",
            "quantity_requested": req.quantity_requested,
            "status": req.status
        }
    })

    return to_request_out(req, db)

@router.put("/{request_id}/reject", response_model=RequestOut)
async def reject_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Regional Admin rejects stock requests for their region.
    """
    if current_user.role not in [RoleEnum.REGIONAL_ADMIN.value, RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: Regional Admin role required to reject requests.")

    req = db.query(RequestModel).filter(RequestModel.request_id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        loc = req.location
        if not loc or loc.region_id != current_user.region_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You can only reject requests for your assigned region."
            )

    req.status = RequestStatusEnum.REJECTED.value
    db.commit()
    db.refresh(req)

    log_audit(db, "REJECT_REQUEST", f"{current_user.name} ({current_user.role}) rejected Request #{req.request_id}", current_user.user_id, current_user.name, current_user.role)
    return to_request_out(req, db)

@router.put("/{request_id}/dispatch", response_model=RequestOut)
async def dispatch_request(
    request_id: int,
    payload: RequestDispatchPayload,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin dispatches approved city request from Central Warehouse.
    If item is serialized, transitions AssetUnit rows from IN_WAREHOUSE to DISPATCHED.
    """
    req = db.query(RequestModel).filter(RequestModel.request_id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if req.status != RequestStatusEnum.APPROVED.value:
        raise HTTPException(status_code=400, detail=f"Request must be APPROVED to be dispatched (Current: {req.status})")

    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == req.variant_id).first()
    item = variant.item if variant else None
    is_serialized = item.is_serialized if item else False

    if is_serialized:
        # Fetch available units in warehouse
        available_units = db.query(AssetUnit).filter(
            AssetUnit.variant_id == req.variant_id,
            AssetUnit.status == AssetStatusEnum.IN_WAREHOUSE.value
        ).limit(req.quantity_requested).all()

        if len(available_units) < req.quantity_requested:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient serialized units in Central Warehouse. Available: {len(available_units)}, Requested: {req.quantity_requested}"
            )

        for unit in available_units:
            unit.status = AssetStatusEnum.DISPATCHED.value
            unit.current_location_id = req.location_id
    else:
        # Check and decrement consumable stock
        stock = db.query(InventoryStock).filter(InventoryStock.variant_id == req.variant_id).first()
        if not stock or stock.current_quantity < req.quantity_requested:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient central stock. Available: {stock.current_quantity if stock else 0}, Requested: {req.quantity_requested}"
            )
        stock.current_quantity -= req.quantity_requested

    # Log Stock Transaction
    txn = StockTransaction(
        variant_id=req.variant_id,
        txn_type=TxnTypeEnum.DISPATCHED.value,
        quantity=-req.quantity_requested,
        performed_by=current_user.user_id,
        timestamp=datetime.utcnow(),
        reference_request_id=req.request_id
    )
    db.add(txn)

    req.status = RequestStatusEnum.DISPATCHED.value
    req.dispatched_by = current_user.user_id
    req.dispatched_at = datetime.utcnow()
    req.carrier_name = payload.carrier_name or "Tata Play Express Logistics"
    req.tracking_number = payload.tracking_number or f"TPF-TRK-{req.request_id:04d}-{random.randint(100, 999)}"
    req.estimated_delivery = payload.estimated_delivery or "2 Business Days"

    db.commit()
    db.refresh(req)

    # Re-evaluate central threshold alerts
    await check_and_update_threshold_alerts(db, req.variant_id)

    log_audit(db, "DISPATCH_REQUEST", f"Dispatched Request #{req.request_id} via {req.carrier_name} (Tracking: {req.tracking_number}).", current_user.user_id, current_user.name, current_user.role)

    await ws_manager.broadcast({
        "type": "ORDER_DISPATCHED",
        "payload": {
            "order_id": req.request_id,
            "request_id": req.request_id,
            "carrier_name": req.carrier_name,
            "tracking_number": req.tracking_number,
            "status": req.status
        }
    })

    return to_request_out(req, db)

@router.put("/{request_id}/confirm-delivery", response_model=RequestOut)
async def confirm_delivery(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    City Manager confirms receipt of dispatched stock for their city.
    """
    req = db.query(RequestModel).filter(RequestModel.request_id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    user_city_id = current_user.city_id or current_user.location_id
    if current_user.role not in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"] and req.location_id != user_city_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: You can only confirm delivery for your assigned city.")

    if req.status != RequestStatusEnum.DISPATCHED.value:
        raise HTTPException(status_code=400, detail=f"Request must be DISPATCHED before confirming delivery (Current: {req.status})")

    req.status = RequestStatusEnum.DELIVERED.value
    req.delivered_at = datetime.utcnow()

    # Update any dispatched serialized asset units for this request/location
    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == req.variant_id).first()
    if variant and variant.item and variant.item.is_serialized:
        dispatched_units = db.query(AssetUnit).filter(
            AssetUnit.variant_id == req.variant_id,
            AssetUnit.status == AssetStatusEnum.DISPATCHED.value,
            AssetUnit.current_location_id == req.location_id
        ).limit(req.quantity_requested).all()
        for unit in dispatched_units:
            unit.status = AssetStatusEnum.ASSIGNED.value

    db.commit()
    db.refresh(req)

    log_audit(db, "DELIVERY_CONFIRMED", f"Delivery confirmed for Request #{req.request_id} by {current_user.name}", current_user.user_id, current_user.name, current_user.role)

    await ws_manager.broadcast({
        "type": "ORDER_FULFILLED",
        "payload": {
            "order_id": req.request_id,
            "request_id": req.request_id,
            "status": req.status
        }
    })

    return to_request_out(req, db)

