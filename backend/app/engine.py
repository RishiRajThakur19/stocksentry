import logging
from sqlalchemy.orm import Session
from datetime import datetime
from .models import InventoryStock, ItemVariant, AssetUnit, AssetStatusEnum, Alert, AlertStatusEnum
from .websocket_manager import ws_manager

logger = logging.getLogger("stocksentry.engine")

async def check_and_update_threshold_alerts(db: Session, variant_id: int):
    """
    Checks if single central warehouse stock current_quantity <= reorder_threshold.
    If true, creates an OPEN alert if one doesn't already exist.
    If false, auto-resolves existing OPEN or ACKNOWLEDGED alert.
    """
    variant = db.query(ItemVariant).filter(ItemVariant.variant_id == variant_id).first()
    if not variant:
        return None

    item = variant.item
    if item and item.is_serialized:
        current_quantity = db.query(AssetUnit).filter(
            AssetUnit.variant_id == variant_id,
            AssetUnit.status == AssetStatusEnum.IN_WAREHOUSE.value
        ).count()
    else:
        stock = db.query(InventoryStock).filter(InventoryStock.variant_id == variant_id).first()
        current_quantity = stock.current_quantity if stock else 0

    is_low_stock = current_quantity <= variant.reorder_threshold


    existing_alert = db.query(Alert).filter(
        Alert.variant_id == variant_id,
        Alert.status.in_([AlertStatusEnum.OPEN.value, AlertStatusEnum.ACKNOWLEDGED.value])
    ).first()

    if is_low_stock:
        if not existing_alert:
            new_alert = Alert(
                variant_id=variant_id,
                threshold_at_trigger=variant.reorder_threshold,
                current_qty_at_trigger=current_quantity,
                status=AlertStatusEnum.OPEN.value,
                created_at=datetime.utcnow()
            )
            db.add(new_alert)
            db.commit()
            db.refresh(new_alert)

            alert_payload = {
                "alert_id": new_alert.alert_id,
                "variant_id": variant_id,
                "variant_name": variant.variant_name,
                "item_name": variant.item.name if variant.item else "Item",
                "current_quantity": current_quantity,
                "reorder_threshold": variant.reorder_threshold,
                "status": new_alert.status,
                "created_at": new_alert.created_at.isoformat()
            }

            logger.info(f"CENTRAL LOW STOCK ALERT: {variant.variant_name} down to {current_quantity} (Threshold: {variant.reorder_threshold})")

            await ws_manager.broadcast({
                "type": "LOW_STOCK_ALERT",
                "payload": alert_payload
            })

            # Multi-Channel Email, SMS & WhatsApp Dispatch
            try:
                import asyncio
                from .services.notification_service import dispatch_low_stock_notification
                item_name = variant.item.name if variant.item else "Item SKU"
                asyncio.get_event_loop().run_in_executor(
                    None,
                    dispatch_low_stock_notification,
                    item_name,
                    variant.variant_name,
                    current_quantity,
                    variant.reorder_threshold
                )
            except Exception as notify_err:
                logger.error(f"Error triggering background notifications: {notify_err}")

            return new_alert
        else:
            existing_alert.current_qty_at_trigger = current_quantity
            db.commit()
            db.refresh(existing_alert)
            return existing_alert
    else:
        if existing_alert:
            existing_alert.status = AlertStatusEnum.RESOLVED.value
            db.commit()
            db.refresh(existing_alert)

            resolve_payload = {
                "alert_id": existing_alert.alert_id,
                "variant_id": variant_id,
                "variant_name": variant.variant_name,
                "item_name": variant.item.name if variant.item else "Item",
                "current_quantity": current_quantity,
                "reorder_threshold": variant.reorder_threshold,
                "status": AlertStatusEnum.RESOLVED.value
            }

            await ws_manager.broadcast({
                "type": "ALERT_RESOLVED",
                "payload": resolve_payload
            })
            return existing_alert

    return None
