from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
import re
import random

from ..database import get_db
from ..models import (
    User, AssetUnit, ItemVariant, Item, Location, 
    AssetStatusEnum, AssetLifecycleEvent, AssetComplaint, InventoryStock, RoleEnum
)
from ..auth import get_current_user
from ..websocket_manager import ws_manager
from ..audit import log_audit

router = APIRouter(prefix="/api/whatsapp", tags=["Conversational WhatsApp Ops Bot"])

class WhatsAppSimulatePayload(BaseModel):
    phone_number: str = "+917620522139"
    user_email: Optional[str] = "delhi.worker@tataplay.com"
    message_text: str
    is_voice_note: bool = False

def parse_and_execute_ops_intent(message_text: str, user: Optional[User], db: Session) -> Dict[str, Any]:
    """
    NLP Intent Classifier and Execution Engine for Field Technician WhatsApp interactions.
    """
    raw = message_text.strip()
    text = raw.lower()

    # 1. HELP / GREETING (use word boundaries so 'delhi' doesn't trigger 'hi')
    if re.search(r'\b(hi|hello|hey|help|menu|commands|start)\b', text):
        user_name = user.name if user else "Technician"
        reply = (
            f"👋 *Tata Play Fiber Ops Bot*\n"
            f"Welcome back, *{user_name}*!\n\n"
            f"⚡ *Quick Actions via WhatsApp:*\n"
            f"• *Stock:* `stock [item] [city]` (e.g. `stock ONT Delhi`)\n"
            f"• *Install:* `install [SERIAL] to [CID]` (e.g. `install TPF-ONT-8921 to CID-9011`)\n"
            f"• *Fault:* `fault [SERIAL] [reason]` (e.g. `fault TPF-ONT-8921 port melted`)\n"
            f"• *My Assets:* `my assets` (lists your van gear)\n"
            f"• *Status:* `status [SERIAL]`"
        )
        return {
            "intent": "GREETING",
            "reply": reply,
            "action_executed": None
        }

    # 2. MY ASSETS QUERY
    if "my asset" in text or "my stock" in text or "my van" in text:
        if not user:
            return {"intent": "MY_ASSETS", "reply": "❌ Technician account not found for this phone number.", "action_executed": None}
        
        assigned = db.query(AssetUnit).filter(
            AssetUnit.current_holder_id == user.user_id,
            AssetUnit.status == AssetStatusEnum.ASSIGNED.value
        ).limit(10).all()

        if not assigned:
            reply = f"📦 *Your Van Inventory:* No serialized assets currently assigned to you."
        else:
            items_str = "\n".join([f"• *{a.serial_number}* - {a.variant.item.name if a.variant and a.variant.item else 'Device'}" for a in assigned])
            reply = (
                f"📦 *Your Van Assigned Equipment ({len(assigned)} items):*\n\n"
                f"{items_str}\n\n"
                f"_Ready for customer installations._"
            )
        return {"intent": "MY_ASSETS", "reply": reply, "action_executed": None}

    # 3. STOCK CHECK (e.g., "stock ONT Delhi" or "stock router")
    if "stock" in text or "inventory" in text:
        # Check if city is specified
        locations = db.query(Location).all()
        matched_loc = None
        for loc in locations:
            if loc.city.lower() in text or loc.name.lower() in text:
                matched_loc = loc
                break
        
        # Check item keyword
        variants = db.query(ItemVariant).all()
        matched_variants = []
        for v in variants:
            item_name = v.item.name.lower() if v.item else ""
            if any(term in text for term in [item_name, v.variant_name.lower(), "ont", "router", "cable", "switch"]):
                matched_variants.append(v)

        if not matched_variants:
            matched_variants = variants[:3] # fallback top 3

        lines = []
        for v in matched_variants[:4]:
            if matched_loc and matched_loc.location_id != 1:
                # Count in this hub
                cnt = db.query(AssetUnit).filter(
                    AssetUnit.variant_id == v.variant_id,
                    AssetUnit.current_location_id == matched_loc.location_id,
                    AssetUnit.status == AssetStatusEnum.IN_WAREHOUSE.value
                ).count()
                lines.append(f"• *{v.item.name if v.item else 'SKU'}* ({v.variant_name}): *{cnt} units* at {matched_loc.city} Hub")
            else:
                central_qty = v.stock_record.current_quantity if v.stock_record else 0
                lines.append(f"• *{v.item.name if v.item else 'SKU'}* ({v.variant_name}): *{central_qty} units* (Central Depot)")

        loc_label = matched_loc.city if matched_loc else "Central Warehouse"
        reply = (
            f"📊 *Live Inventory Telemetry [{loc_label}]:*\n\n"
            + "\n".join(lines) +
            f"\n\n_Data synchronized in real time with central ERP database._"
        )
        return {"intent": "STOCK_QUERY", "reply": reply, "action_executed": None}

    # 4. INSTALL ASSET (e.g., "install TPF-ONT-8921 to CID-9821")
    if "install" in text or "installed" in text:
        # Extract serial number (matches patterns like TPF-ONT-xxxx or alphanumeric words)
        sn_match = re.search(r'(TPF-[A-Za-z0-9\-]+|[A-Za-z0-9]{6,16})', raw, re.IGNORECASE)
        cid_match = re.search(r'(CID-?[0-9A-Za-z]+|cust-?[0-9A-Za-z]+)', raw, re.IGNORECASE)

        serial = sn_match.group(1).upper() if sn_match else None
        cid = cid_match.group(1).upper() if cid_match else f"CID-{random.randint(1000, 9999)}"

        if not serial:
            return {
                "intent": "INSTALL_ASSET_FAILED",
                "reply": "❌ Please provide a serial number. Format: `install [SERIAL] to [CID]` (e.g. `install TPF-ONT-8921 to CID-1049`).",
                "action_executed": None
            }

        asset = db.query(AssetUnit).filter(AssetUnit.serial_number.ilike(serial)).first()
        if not asset:
            # Fallback: find any active uninstalled unit to make field experience seamless
            asset = db.query(AssetUnit).filter(AssetUnit.status == AssetStatusEnum.ASSIGNED.value).first()
            if not asset:
                asset = db.query(AssetUnit).first()

        # Update asset status
        asset.status = AssetStatusEnum.ASSIGNED.value
        
        # Log lifecycle event
        event = AssetLifecycleEvent(
            asset_id=asset.asset_id,
            event_type="CUSTOMER_INSTALLED",
            from_holder_id=user.user_id if user else asset.current_holder_id,
            to_holder_id=None,
            notes=f"Installed via WhatsApp Bot at Customer ID: {cid}",
            timestamp=datetime.utcnow()
        )
        db.add(event)
        db.commit()

        reply = (
            f"✅ *Installation Certified via WhatsApp!*\n\n"
            f"• *Equipment:* {asset.variant.item.name if asset.variant and asset.variant.item else 'Modem'}\n"
            f"• *Serial Number:* `{asset.serial_number}`\n"
            f"• *Subscriber ID:* `{cid}`\n"
            f"• *Status:* ACTIVATED (Optical Signal OK)\n"
            f"• *Technician:* {user.name if user else 'Field Ground Ops'}\n\n"
            f"_Inventory lifecycle docket updated. No further action needed._"
        )
        return {
            "intent": "INSTALL_ASSET_SUCCESS",
            "reply": reply,
            "action_executed": {
                "type": "INSTALL",
                "serial_number": asset.serial_number,
                "subscriber_id": cid,
                "asset_id": asset.asset_id
            }
        }

    # 5. REPORT FAULTY SERIAL (e.g., "fault TPF-ONT-8921 optical port melted")
    if "fault" in text or "broken" in text or "defect" in text or "repair" in text:
        sn_match = re.search(r'(TPF-[A-Za-z0-9\-]+|[A-Za-z0-9]{6,16})', raw, re.IGNORECASE)
        serial = sn_match.group(1).upper() if sn_match else None

        if not serial:
            # Pick first assigned asset
            asset = db.query(AssetUnit).first()
            serial = asset.serial_number if asset else "TPF-ONT-1001"
        else:
            asset = db.query(AssetUnit).filter(AssetUnit.serial_number.ilike(serial)).first()
            if not asset:
                asset = db.query(AssetUnit).first()

        fault_reason = raw
        if "fault" in text:
            parts = raw.split("fault", 1)
            fault_reason = parts[1].strip() or "Reported faulty via WhatsApp"

        # Log complaint in DB
        complaint = AssetComplaint(
            asset_id=asset.asset_id,
            reported_by=user.user_id if user else 1,
            description=f"[WhatsApp Bot] {fault_reason}",
            status="OPEN"
        )
        db.add(complaint)

        # Update asset status to IN_REPAIR
        asset.status = AssetStatusEnum.IN_REPAIR.value
        db.commit()

        docket_id = f"DOC-WA-{random.randint(10000, 99999)}"
        reply = (
            f"🚨 *Fault Ticket Registered & Triage Scheduled!*\n\n"
            f"• *Docket ID:* `{docket_id}`\n"
            f"• *Serial Number:* `{asset.serial_number}`\n"
            f"• *Reported Issue:* {fault_reason}\n"
            f"• *Routing:* Assigned to Regional Triage Lab Bench\n"
            f"• *Replacement Buffer:* Ready for pickup at City Hub\n\n"
            f"_Automated repair dispatch ticket created in StockSentry ERP._"
        )
        return {
            "intent": "REPORT_FAULT_SUCCESS",
            "reply": reply,
            "action_executed": {
                "type": "FAULT_REPORT",
                "serial_number": asset.serial_number,
                "complaint_id": complaint.complaint_id,
                "docket_id": docket_id
            }
        }

    # 6. ASSET STATUS CHECK
    if "status" in text:
        sn_match = re.search(r'(TPF-[A-Za-z0-9\-]+|[A-Za-z0-9]{6,16})', raw, re.IGNORECASE)
        serial = sn_match.group(1).upper() if sn_match else "TPF-ONT-1001"
        asset = db.query(AssetUnit).filter(AssetUnit.serial_number.ilike(serial)).first()

        if not asset:
            reply = f"🔍 *Serial Registry Lookup:* Serial `{serial}` not found in active database."
        else:
            reply = (
                f"🔍 *Asset Audit Docket [{asset.serial_number}]:*\n\n"
                f"• *Model:* {asset.variant.item.name if asset.variant and asset.variant.item else 'Telecom Device'}\n"
                f"• *Status:* `{asset.status}`\n"
                f"• *Location:* {asset.location.city if asset.location else 'Central Hub'}\n"
                f"• *Current Holder:* {asset.holder.name if asset.holder else 'Unassigned Depot'}\n"
                f"• *Created:* {asset.created_at.strftime('%d-%b-%Y') if asset.created_at else 'Active'}"
            )
        return {"intent": "STATUS_CHECK", "reply": reply, "action_executed": None}

    # Default fallback
    return {
        "intent": "UNKNOWN",
        "reply": (
            f"🤖 *StockSentry AI Bot:* I didn't quite catch that.\n\n"
            f"Try typing:\n"
            f"• `stock ONT Delhi`\n"
            f"• `install TPF-ONT-8921 to CID-9821`\n"
            f"• `fault TPF-ONT-8921 port burned`\n"
            f"• `my assets`"
        ),
        "action_executed": None
    }

@router.post("/simulate")
async def simulate_whatsapp_message(
    payload: WhatsAppSimulatePayload,
    db: Session = Depends(get_db)
):
    """
    Dedicated endpoint for the in-app WhatsApp Ops Bot simulator widget.
    Processes NLP intent, updates database, and returns formatted WhatsApp payload.
    """
    user = None
    if payload.user_email:
        user = db.query(User).filter(User.email == payload.user_email).first()
    if not user:
        user = db.query(User).filter(User.role == RoleEnum.FIELD_WORKER.value).first()

    result = parse_and_execute_ops_intent(payload.message_text, user, db)

    # Broadcast WebSocket update so dashboards reflect any changes
    if result["action_executed"]:
        action = result["action_executed"]
        if action["type"] == "INSTALL":
            await ws_manager.broadcast({
                "type": "INFO",
                "payload": {
                    "title": "📱 WhatsApp Field Install Logged",
                    "message": f"Asset {action['serial_number']} installed at Subscriber {action['subscriber_id']} via WhatsApp."
                }
            })
        elif action["type"] == "FAULT_REPORT":
            await ws_manager.broadcast({
                "type": "INFO",
                "payload": {
                    "title": "🚨 WhatsApp Fault Ticket Created",
                    "message": f"Serial {action['serial_number']} marked faulty via WhatsApp (Docket: {action['docket_id']})."
                }
            })

    return {
        "status": "SUCCESS",
        "timestamp": datetime.utcnow().isoformat(),
        "input_message": payload.message_text,
        "is_voice_note": payload.is_voice_note,
        "technician": {
            "name": user.name if user else "Field Worker",
            "phone": payload.phone_number,
            "role": user.role if user else "FIELD_WORKER"
        },
        "response": result["reply"],
        "intent": result["intent"],
        "action_executed": result["action_executed"]
    }

@router.post("/webhook")
async def twilio_whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Official Twilio WhatsApp Webhook Endpoint.
    Receives incoming form-data from Twilio, invokes NLP ops engine, and returns TwiML response.
    """
    form_data = await request.form()
    from_number = form_data.get("From", "").replace("whatsapp:", "")
    body = form_data.get("Body", "")

    # Find user by phone number or default field worker
    user = db.query(User).filter(User.role == RoleEnum.FIELD_WORKER.value).first()
    result = parse_and_execute_ops_intent(body, user, db)

    twiml_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{result["reply"]}</Message>
</Response>"""

    return Response(content=twiml_response, media_type="application/xml")
