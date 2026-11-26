from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
from datetime import datetime
from ..services.notification_service import (
    send_alert_email,
    send_alert_sms,
    send_alert_whatsapp,
    dispatch_low_stock_notification,
    clean_phone_number
)
from ..auth import get_current_user, require_super_admin
from ..database import get_db
from ..models import User, NotificationPreference
from ..services.scheduler_service import run_scheduled_jobs, build_weekly_digest_for_user
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/notifications", tags=["Notifications & Alerts Dispatcher"])

class TestNotificationRequest(BaseModel):
    recipient_email: Optional[str] = "admin@tataplay.com"
    recipient_phone: Optional[str] = "+917620522139"
    item_name: Optional[str] = "Fiber Modem - Nokia"
    variant_name: Optional[str] = "Dual-Band Wi-Fi 6"
    current_quantity: Optional[int] = 12
    threshold: Optional[int] = 80
    channel: Optional[str] = "ALL" # ALL, EMAIL, SMS, WHATSAPP

@router.get("/status")
def get_notification_service_status(
    current_user: User = Depends(get_current_user)
):
    """Returns the live status of SMTP and SMS/WhatsApp API channels."""
    has_smtp = bool(os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))
    has_twilio = bool(os.getenv("TWILIO_ACCOUNT_SID") and os.getenv("TWILIO_AUTH_TOKEN"))
    
    return {
        "email_channel": {
            "configured": has_smtp,
            "provider": "SMTP (" + (os.getenv("SMTP_HOST", "smtp.gmail.com")) + ")",
            "sender": os.getenv("SMTP_USER") or "alerts@tataplayfiber.com (Simulator)"
        },
        "sms_channel": {
            "configured": has_twilio,
            "provider": "Twilio SMS Gateway" if has_twilio else "SMS Telemetry Dispatcher (Simulator)",
            "default_phone": os.getenv("ALERT_RECIPIENT_PHONE", "+9176520522139")
        },
        "whatsapp_channel": {
            "configured": has_twilio,
            "provider": "Twilio WhatsApp Sandbox" if has_twilio else "WhatsApp Telemetry Dispatcher (Simulator)"
        }
    }

@router.post("/test-dispatch")
def test_dispatch_notification(
    req: TestNotificationRequest,
    current_user: User = Depends(get_current_user)
):
    target_email = req.recipient_email or "admin@tataplay.com"
    target_phone = req.recipient_phone or "+9176520522139"
    item = req.item_name or "Fiber Modem - Nokia"
    variant = req.variant_name or "Dual-Band Wi-Fi 6"
    qty = req.current_quantity if req.current_quantity is not None else 12
    thresh = req.threshold if req.threshold is not None else 80

    result = dispatch_low_stock_notification(
        item_name=item,
        variant_name=variant,
        current_quantity=qty,
        reorder_threshold=thresh,
        recipient_email=target_email,
        recipient_phone=target_phone
    )

    return {
        "status": "DISPATCH_PROCESSED",
        "recipient_email": target_email,
        "recipient_phone": clean_phone_number(target_phone),
        "item": f"{item} - {variant}",
        "current_stock": qty,
        "threshold": thresh,
        "results": result
    }


class NotificationPrefsPayload(BaseModel):
    email_requests: bool = True
    email_requisitions: bool = True
    email_tickets: bool = True
    email_low_stock: bool = True
    email_noc: bool = True
    email_weekly_digest: bool = True


@router.get("/preferences")
def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == current_user.user_id).first()
    if not pref:
        return NotificationPrefsPayload().model_dump()
    return {
        "email_requests": pref.email_requests,
        "email_requisitions": pref.email_requisitions,
        "email_tickets": pref.email_tickets,
        "email_low_stock": pref.email_low_stock,
        "email_noc": pref.email_noc,
        "email_weekly_digest": pref.email_weekly_digest,
    }


@router.put("/preferences")
def update_notification_preferences(
    payload: NotificationPrefsPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == current_user.user_id).first()
    if not pref:
        pref = NotificationPreference(user_id=current_user.user_id)
        db.add(pref)
    pref.email_requests = payload.email_requests
    pref.email_requisitions = payload.email_requisitions
    pref.email_tickets = payload.email_tickets
    pref.email_low_stock = payload.email_low_stock
    pref.email_noc = payload.email_noc
    pref.email_weekly_digest = payload.email_weekly_digest
    pref.updated_at = datetime.utcnow()
    db.commit()
    return payload.model_dump()


@router.get("/weekly-digest-preview")
def preview_weekly_digest(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return build_weekly_digest_for_user(current_user, db)


@router.post("/run-scheduled")
def trigger_scheduled_jobs(
    current_user: User = Depends(require_super_admin)
):
    return run_scheduled_jobs()


