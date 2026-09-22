from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Alert, AlertStatusEnum, User, RoleEnum, ItemVariant, InventoryStock
from ..schemas import AlertOut, AlertStatusUpdate
from ..auth import get_current_user
from ..websocket_manager import ws_manager

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])

@router.get("", response_model=List[AlertOut])
def get_alerts(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Alert)

    if status_filter:
        query = query.filter(Alert.status == status_filter.upper())

    alerts = query.order_by(Alert.created_at.desc()).all()

    result = []
    for a in alerts:
        variant = db.query(ItemVariant).filter(ItemVariant.variant_id == a.variant_id).first()
        stock = db.query(InventoryStock).filter(
            InventoryStock.variant_id == a.variant_id
        ).first()

        result.append(AlertOut(
            alert_id=a.alert_id,
            variant_id=a.variant_id,
            threshold_at_trigger=a.threshold_at_trigger,
            current_qty_at_trigger=a.current_qty_at_trigger,
            status=a.status,
            created_at=a.created_at,
            variant_name=variant.variant_name if variant else "",
            item_name=variant.item.name if variant and variant.item else "",
            current_quantity=stock.current_quantity if stock else 0
        ))

    return result

@router.put("/{alert_id}/status", response_model=AlertOut)
async def update_alert_status(
    alert_id: int,
    req: AlertStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    new_status = req.status.upper()
    if new_status not in [AlertStatusEnum.OPEN.value, AlertStatusEnum.ACKNOWLEDGED.value, AlertStatusEnum.RESOLVED.value]:
        raise HTTPException(status_code=400, detail="Invalid status value")

    alert.status = new_status
    db.commit()
    db.refresh(alert)

    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == alert.variant_id).first()
    stock = db.query(InventoryStock).filter(
        InventoryStock.variant_id == alert.variant_id
    ).first()

    await ws_manager.broadcast({
        "type": "ALERT_STATUS_UPDATED",
        "payload": {
            "alert_id": alert.alert_id,
            "status": alert.status
        }
    })

    return AlertOut(
        alert_id=alert.alert_id,
        variant_id=alert.variant_id,
        threshold_at_trigger=alert.threshold_at_trigger,
        current_qty_at_trigger=alert.current_qty_at_trigger,
        status=alert.status,
        created_at=alert.created_at,
        variant_name=variant.variant_name if variant else "",
        item_name=variant.item.name if variant and variant.item else "",
        current_quantity=stock.current_quantity if stock else 0
    )
