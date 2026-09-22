import random
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Order, OrderStatusEnum, User, RoleEnum, InventoryStock, ItemVariant, StockTransaction, TxnTypeEnum
from ..schemas import OrderCreateRequest, OrderOut, OrderDispatchPayload
from ..auth import get_current_user, require_admin
from ..engine import check_and_update_threshold_alerts
from ..websocket_manager import ws_manager
from ..audit import log_audit

router = APIRouter(prefix="/api/orders", tags=["Orders"])


def to_order_out(o: Order, db: Session) -> OrderOut:
    requester = db.query(User).filter(User.user_id == o.requested_by).first() if o.requested_by else None
    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == o.variant_id).first()
    item = variant.item if variant else None
    dest_loc = o.location
    
    # Coordinates mapping (Delhi: 28.6139, 77.2090, Mumbai: 19.0760, 72.8777, Bangalore: 12.9716, 77.5946)
    dest_lat = getattr(dest_loc, 'latitude', 28.6139) if dest_loc else 28.6139
    dest_lng = getattr(dest_loc, 'longitude', 77.2090) if dest_loc else 77.2090
    if dest_loc and not dest_lat:
        if 'mumbai' in dest_loc.name.lower():
            dest_lat, dest_lng = 19.0760, 72.8777
        elif 'bangalore' in dest_loc.name.lower():
            dest_lat, dest_lng = 12.9716, 77.5946
        else:
            dest_lat, dest_lng = 28.6139, 77.2090

    return OrderOut(
        order_id=o.order_id,
        requested_by=o.requested_by,
        location_id=o.location_id,
        variant_id=o.variant_id,
        quantity_requested=o.quantity_requested,
        status=o.status,
        created_at=o.created_at,
        approved_by=o.approved_by,
        approved_at=o.approved_at,
        dispatched_by=o.dispatched_by,
        dispatched_at=o.dispatched_at,
        fulfilled_at=o.fulfilled_at,
        carrier_name=o.carrier_name,
        tracking_number=o.tracking_number,
        estimated_delivery=o.estimated_delivery,
        requester_name=requester.name if requester else "Unknown",
        location_name=dest_loc.name if dest_loc else "",
        source_location_name="Central Admin Main Hub (Delhi)",
        source_latitude=28.6139,
        source_longitude=77.2090,
        destination_latitude=dest_lat,
        destination_longitude=dest_lng,
        variant_name=variant.variant_name if variant else "",
        item_name=item.name if item else "",
        unit_cost=variant.unit_cost if variant else 0.0
    )

@router.get("", response_model=List[OrderOut])
def get_orders(
    status_filter: Optional[str] = None,
    location_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Order)

    if current_user.role == RoleEnum.MANAGER.value:
        query = query.filter(Order.location_id == current_user.location_id)
    elif location_id:
        query = query.filter(Order.location_id == location_id)

    if status_filter:
        query = query.filter(Order.status == status_filter.upper())

    orders = query.order_by(Order.created_at.desc()).all()
    return [to_order_out(o, db) for o in orders]


@router.post("", response_model=OrderOut)
async def create_order(
    req: OrderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    location_id = current_user.location_id if current_user.role == RoleEnum.MANAGER.value else (req.location_id or 1)

    order = Order(
        requested_by=current_user.user_id,
        location_id=location_id,
        variant_id=req.variant_id,
        quantity_requested=req.quantity_requested,
        status=OrderStatusEnum.PENDING.value,
        created_at=datetime.utcnow()
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == req.variant_id).first()
    item = variant.item if variant else None

    # Broadcast WebSocket notification about new PENDING order
    await ws_manager.broadcast({
        "type": "ORDER_CREATED",
        "payload": {
            "order_id": order.order_id,
            "location_name": order.location.name if order.location else "",
            "item_name": item.name if item else "",
            "variant_name": variant.variant_name if variant else "",
            "quantity_requested": order.quantity_requested,
            "status": order.status
        }
    })

    return to_order_out(order, db)

@router.put("/{order_id}/approve", response_model=OrderOut)
async def approve_order(
    order_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != OrderStatusEnum.PENDING.value:
        raise HTTPException(status_code=400, detail=f"Order is in '{order.status}' status, cannot approve.")

    order.status = OrderStatusEnum.APPROVED.value
    order.approved_by = current_user.user_id
    order.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(order)

    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == order.variant_id).first()
    item = variant.item if variant else None

    log_audit(db, "APPROVE_ORDER", f"Approved Order #{order.order_id} ({order.quantity_requested}x {item.name if item else 'SKU'}) for {order.location.name if order.location else ''}", current_user.user_id, current_user.name, current_user.role)

    await ws_manager.broadcast({
        "type": "ORDER_APPROVED",
        "payload": {
            "order_id": order.order_id,
            "location_id": order.location_id,
            "location_name": order.location.name if order.location else "",
            "item_name": item.name if item else "",
            "variant_name": variant.variant_name if variant else "",
            "quantity_requested": order.quantity_requested,
            "status": order.status
        }
    })

    return to_order_out(order, db)

@router.put("/{order_id}/dispatch", response_model=OrderOut)
async def dispatch_order(
    order_id: int,
    payload: OrderDispatchPayload,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Central Admin dispatches approved procurement order -> Status moves to IN_TRANSIT with tracking & carrier info.
    """
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != OrderStatusEnum.APPROVED.value:
        raise HTTPException(status_code=400, detail=f"Order must be in APPROVED status to be dispatched (Current: {order.status}).")

    order.status = OrderStatusEnum.IN_TRANSIT.value
    order.dispatched_by = current_user.user_id
    order.dispatched_at = datetime.utcnow()
    order.carrier_name = payload.carrier_name or "Tata Play Express Logistics"
    order.tracking_number = payload.tracking_number or f"TPF-TRK-{order_id:04d}-{random.randint(100, 999)}"
    order.estimated_delivery = payload.estimated_delivery or "2 Business Days"

    db.commit()
    db.refresh(order)

    log_audit(db, "DISPATCH_ORDER", f"Dispatched Order #{order.order_id} via {order.carrier_name} (Tracking: {order.tracking_number})", current_user.user_id, current_user.name, current_user.role)

    await ws_manager.broadcast({
        "type": "ORDER_DISPATCHED",
        "payload": {
            "order_id": order.order_id,
            "location_id": order.location_id,
            "carrier_name": order.carrier_name,
            "tracking_number": order.tracking_number,
            "status": order.status
        }
    })

    return to_order_out(order, db)


@router.put("/{order_id}/reject", response_model=OrderOut)
async def reject_order(
    order_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != OrderStatusEnum.PENDING.value:
        raise HTTPException(status_code=400, detail=f"Order is in '{order.status}' status, cannot reject.")

    order.status = OrderStatusEnum.REJECTED.value
    db.commit()
    db.refresh(order)

    await ws_manager.broadcast({
        "type": "ORDER_REJECTED",
        "payload": {
            "order_id": order.order_id,
            "location_id": order.location_id,
            "status": order.status
        }
    })

    return to_order_out(order, db)

@router.put("/{order_id}/fulfill", response_model=OrderOut)
async def fulfill_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manager confirms delivery -> order becomes FULFILLED -> local stock incremented -> transaction logged -> threshold checked.
    """
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == RoleEnum.MANAGER.value and current_user.location_id != order.location_id:
        raise HTTPException(status_code=403, detail="Managers can only fulfill orders for their assigned location.")

    if order.status not in [OrderStatusEnum.IN_TRANSIT.value, OrderStatusEnum.APPROVED.value]:
        raise HTTPException(status_code=400, detail=f"Order must be IN_TRANSIT to confirm delivery (Current: {order.status}).")

    order.status = OrderStatusEnum.FULFILLED.value
    order.fulfilled_at = datetime.utcnow()

    # Update Stock
    stock = db.query(InventoryStock).filter(
        InventoryStock.variant_id == order.variant_id,
        InventoryStock.location_id == order.location_id
    ).first()

    if not stock:
        stock = InventoryStock(
            variant_id=order.variant_id,
            location_id=order.location_id,
            current_quantity=0,
            last_updated=datetime.utcnow()
        )
        db.add(stock)

    stock.current_quantity += order.quantity_requested
    stock.last_updated = datetime.utcnow()

    # Log Stock Transaction
    txn = StockTransaction(
        variant_id=order.variant_id,
        location_id=order.location_id,
        txn_type=TxnTypeEnum.ORDER_FULFILLED.value,
        quantity=order.quantity_requested,
        performed_by=current_user.user_id,
        timestamp=datetime.utcnow(),
        reference_order_id=order.order_id
    )
    db.add(txn)
    db.commit()
    db.refresh(order)

    # Threshold engine check
    await check_and_update_threshold_alerts(db, order.variant_id, order.location_id)

    await ws_manager.broadcast({
        "type": "ORDER_FULFILLED",
        "payload": {
            "order_id": order.order_id,
            "location_id": order.location_id,
            "quantity_added": order.quantity_requested,
            "new_stock": stock.current_quantity,
            "status": order.status
        }
    })

    return to_order_out(order, db)

