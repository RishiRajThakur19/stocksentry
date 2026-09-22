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
from ..auth import get_current_user
from ..models import User

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

