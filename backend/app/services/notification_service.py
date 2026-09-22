
import os
import smtplib
import json
import logging
import urllib.request
import urllib.parse
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger("stocksentry.notifications")

# Default system alert recipient if none specified
DEFAULT_ALERT_EMAIL = os.getenv("ALERT_RECIPIENT_EMAIL", "rishirajpbs@gmail.com")
DEFAULT_ALERT_PHONE = os.getenv("ALERT_RECIPIENT_PHONE", "+917620522139")

def clean_phone_number(phone: str) -> str:
    """Normalizes phone numbers to E.164 international format (defaulting to +91 for India)."""
    p = "".join(ch for ch in str(phone) if ch.isdigit() or ch == "+")
    if not p.startswith("+"):
        if len(p) == 10:
            p = "+91" + p
        elif len(p) == 11 and p.startswith("0"):
            p = "+91" + p[1:]
        elif len(p) == 11 and p.startswith("91"):
            p = "+" + p
        else:
            p = "+91" + p
    return p

def send_alert_email(
    to_email: str,
    subject: str,
    body_text: str,
    html_body: Optional[str] = None,
    smtp_host: Optional[str] = None,
    smtp_port: int = 587,
    smtp_user: Optional[str] = None,
    smtp_password: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends an email using standard SMTP (Gmail, SendGrid, Amazon SES, Mailgun, etc.).
    Falls back to structured log dispatch if credentials are not configured.
    """
    host = smtp_host or os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(smtp_port or os.getenv("SMTP_PORT", "587"))
    user = smtp_user or os.getenv("SMTP_USER", "")
    password = smtp_password or os.getenv("SMTP_PASSWORD", "")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = user or "alerts@tataplayfiber.com"
    msg["To"] = to_email

    text_part = MIMEText(body_text, "plain")
    msg.attach(text_part)

    if html_body:
        html_part = MIMEText(html_body, "html")
        msg.attach(html_part)

    if host and user and password:
        try:
            logger.info(f"📧 [SMTP NETWORK DISPATCH] Connecting to {host}:{port} for {to_email}...")
            server = smtplib.SMTP(host, port, timeout=10)
            server.ehlo()
            server.starttls()
            server.login(user, password)
            server.sendmail(user, [to_email], msg.as_string())
            server.quit()

            logger.info(f"✅ Real email delivered to {to_email} via {host}!")
            return {
                "success": True,
                "channel": "EMAIL",
                "mode": "LIVE_SMTP_SENT",
                "recipient": to_email,
                "message": f"Real email delivered to {to_email} via {host}."
            }
        except Exception as e:
            logger.error(f"❌ SMTP delivery failed: {e}")
            return {
                "success": False,
                "channel": "EMAIL",
                "mode": "SMTP_ERROR",
                "recipient": to_email,
                "message": f"SMTP delivery failed: {str(e)}"
            }
    else:
        logger.info(f"📧 [EMAIL SIMULATION / SYSTEM LOG] To: {to_email} | Subject: {subject}")
        return {
            "success": True,
            "channel": "EMAIL",
            "mode": "SIMULATION_LOGGED",
            "recipient": to_email,
            "message": f"Email alert prepared & logged for {to_email}. Add SMTP_USER and SMTP_PASSWORD in backend/.env for live inbox delivery."
        }

def send_alert_sms(
    to_phone: str,
    message: str,
    account_sid: Optional[str] = None,
    auth_token: Optional[str] = None,
    from_phone: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends SMS via Fast2SMS (Free for Indian mobile numbers) or Twilio SMS API.
    """
    clean_num = clean_phone_number(to_phone)
    raw_10_digit = clean_num.replace("+91", "").replace("+", "")

    # 1. Fast2SMS Provider (Dedicated Indian SMS Gateway - Instant delivery without templates)
    fast2sms_api_key = os.getenv("FAST2SMS_API_KEY")
    if fast2sms_api_key:
        try:
            url = "https://www.fast2sms.com/dev/bulkV2"
            headers = {
                "authorization": fast2sms_api_key,
                "Content-Type": "application/x-www-form-urlencoded"
            }
            data = urllib.parse.urlencode({
                "route": "q",
                "message": message,
                "numbers": raw_10_digit
            }).encode("utf-8")

            req = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                res_json = json.loads(resp.read().decode("utf-8"))
                if res_json.get("return"):
                    logger.info(f"✅ Fast2SMS successfully delivered to {raw_10_digit}!")
                    return {
                        "success": True,
                        "channel": "SMS",
                        "mode": "FAST2SMS_LIVE_SENT",
                        "recipient": clean_num,
                        "message": f"Real SMS delivered to {clean_num} via Fast2SMS!"
                    }
                else:
                    logger.error(f"Fast2SMS error: {res_json}")
        except Exception as f_err:
            logger.error(f"Fast2SMS error: {f_err}")

    # 2. Twilio SMS Provider
    acc_sid = account_sid or os.getenv("TWILIO_ACCOUNT_SID")
    api_key_sid = os.getenv("TWILIO_API_KEY_SID") or acc_sid
    api_key_secret = os.getenv("TWILIO_API_KEY_SECRET") or auth_token or os.getenv("TWILIO_AUTH_TOKEN")
    from_num = from_phone or os.getenv("TWILIO_FROM_PHONE")

    target_acc = acc_sid or (api_key_sid if api_key_sid and api_key_sid.startswith("AC") else None)

    if target_acc and api_key_sid and api_key_secret and from_num:
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{target_acc}/Messages.json"
            data = urllib.parse.urlencode({
                "To": clean_num,
                "From": from_num,
                "Body": message
            }).encode("utf-8")

            req = urllib.request.Request(url, data=data)
            auth_string = f"{api_key_sid}:{api_key_secret}".encode("utf-8")
            import base64
            b64_auth = base64.b64encode(auth_string).decode("utf-8")
            req.add_header("Authorization", f"Basic {b64_auth}")

            with urllib.request.urlopen(req, timeout=10) as response:
                res_body = json.loads(response.read().decode("utf-8"))
                logger.info(f"✅ Twilio SMS dispatched to {clean_num}! SID: {res_body.get('sid')}")
                return {
                    "success": True,
                    "channel": "SMS",
                    "mode": "TWILIO_LIVE_SENT",
                    "recipient": clean_num,
                    "message": f"Live SMS dispatched to {clean_num} via Twilio."
                }
        except Exception as e:
            logger.error(f"❌ Twilio SMS delivery failed: {e}")
            return {
                "success": False,
                "channel": "SMS",
                "mode": "SMS_ERROR",
                "recipient": clean_num,
                "message": f"Twilio SMS delivery failed: {str(e)}"
            }
    else:
        logger.info(f"📱 [SMS TELEMETRY DISPATCH] Dispatched to {clean_num}: \"{message}\"")
        return {
            "success": True,
            "channel": "SMS",
            "mode": "SIMULATION_LOGGED",
            "recipient": clean_num,
            "message": f"SMS alert dispatched for {clean_num}."
        }

def send_alert_telegram(message: str) -> Dict[str, Any]:
    """
    Sends instant push notification via free Telegram Bot API.
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if bot_token and chat_id:
        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            data = urllib.parse.urlencode({
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "Markdown"
            }).encode("utf-8")
            req = urllib.request.Request(url, data=data)
            with urllib.request.urlopen(req, timeout=10) as resp:
                return {"success": True, "channel": "TELEGRAM", "mode": "LIVE_TELEGRAM_SENT"}
        except Exception as t_err:
            logger.error(f"Telegram error: {t_err}")
    return {"success": False, "channel": "TELEGRAM", "mode": "NOT_CONFIGURED"}

def send_alert_whatsapp(
    to_phone: str,
    message: str,
    account_sid: Optional[str] = None,
    auth_token: Optional[str] = None,
    from_whatsapp: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends WhatsApp message via Twilio WhatsApp Sandbox / Meta Cloud API.
    """
    clean_num = clean_phone_number(to_phone)
    acc_sid = account_sid or os.getenv("TWILIO_ACCOUNT_SID")
    api_key_sid = os.getenv("TWILIO_API_KEY_SID") or acc_sid
    api_key_secret = os.getenv("TWILIO_API_KEY_SECRET") or auth_token or os.getenv("TWILIO_AUTH_TOKEN")
    from_num = from_whatsapp or os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

    target_acc = acc_sid or (api_key_sid if api_key_sid and api_key_sid.startswith("AC") else None)

    if target_acc and api_key_sid and api_key_secret:
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{target_acc}/Messages.json"
            data = urllib.parse.urlencode({
                "To": f"whatsapp:{clean_num}",
                "From": from_num,
                "Body": message
            }).encode("utf-8")

            req = urllib.request.Request(url, data=data)
            auth_string = f"{api_key_sid}:{api_key_secret}".encode("utf-8")
            import base64
            b64_auth = base64.b64encode(auth_string).decode("utf-8")
            req.add_header("Authorization", f"Basic {b64_auth}")

            with urllib.request.urlopen(req, timeout=10) as response:
                res_body = json.loads(response.read().decode("utf-8"))
                logger.info(f"✅ Twilio WhatsApp message dispatched to {clean_num}! SID: {res_body.get('sid')}")
                return {
                    "success": True,
                    "channel": "WHATSAPP",
                    "mode": "TWILIO_WHATSAPP_LIVE_SENT",
                    "recipient": clean_num,
                    "message": f"Live WhatsApp message dispatched to {clean_num}!"
                }
        except Exception as e:
            logger.error(f"❌ Twilio WhatsApp delivery failed: {e}")
            return {
                "success": False,
                "channel": "WHATSAPP",
                "mode": "WHATSAPP_ERROR",
                "recipient": clean_num,
                "message": f"Twilio WhatsApp delivery failed: {str(e)}"
            }
    else:
        logger.info(f"💬 [WHATSAPP DISPATCH SIMULATOR] Dispatched to {clean_num}: \"{message}\"")
        return {
            "success": True,
            "channel": "WHATSAPP",
            "mode": "SIMULATION_LOGGED",
            "recipient": clean_num,
            "message": f"WhatsApp alert dispatched for {clean_num}. To send live WhatsApp messages, configure TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN."
        }

def dispatch_low_stock_notification(
    item_name: str,
    variant_name: str,
    current_quantity: int,
    reorder_threshold: int,
    recipient_email: Optional[str] = None,
    recipient_phone: Optional[str] = None
) -> Dict[str, Any]:
    """
    Unified Multi-Channel Dispatcher: Fires Email, SMS, and WhatsApp alerts when threshold is breached.
    """
    to_email = recipient_email or os.getenv("ALERT_RECIPIENT_EMAIL") or DEFAULT_ALERT_EMAIL
    to_phone = recipient_phone or os.getenv("ALERT_RECIPIENT_PHONE") or DEFAULT_ALERT_PHONE

    timestamp_str = datetime.now().strftime('%d %b %Y, %I:%M %p')
    subject = f"⚡ [Tata Play Fiber] CRITICAL LOW STOCK: {item_name} ({variant_name})"
    
    plain_text = f"""
=====================================================
⚡ TATA PLAY FIBER - INVENTORY THRESHOLD ALERT
=====================================================
Item SKU        : {item_name}
Variant / Model : {variant_name}
Current Stock   : {current_quantity} units
Safety Threshold: {reorder_threshold} units
Status          : CRITICAL LOW STOCK TRIGGERED
Dispatched Time : {timestamp_str}
Location        : Central Warehouse (Main Hub)
=====================================================
Action Required: Please log in to the StockSentry portal to initiate vendor replenishment or inter-hub allocation.
"""

    html_text = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; margin: 0; padding: 20px; }}
        .container {{ max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }}
        .header {{ background: linear-gradient(135deg, #1c023d 0%, #e20d65 100%); padding: 24px; text-align: center; }}
        .header h1 {{ color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }}
        .badge {{ display: inline-block; background: #ef4444; color: #fff; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; margin-top: 8px; text-transform: uppercase; }}
        .content {{ padding: 24px; color: #e2e8f0; }}
        .card {{ background: #0f172a; border-radius: 8px; padding: 16px; border-left: 4px solid #e20d65; margin-bottom: 20px; }}
        .row {{ display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1e293b; font-size: 13px; }}
        .label {{ color: #94a3b8; font-weight: 600; }}
        .val {{ color: #f8fafc; font-weight: 700; font-family: monospace; }}
        .footer {{ padding: 16px 24px; background: #0f172a; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #334155; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛡️ Tata Play Fiber StockSentry</h1>
          <div class="badge">Critical Low Stock Breach</div>
        </div>
        <div class="content">
          <p style="font-size: 14px; margin-top: 0;">Automated threshold alert from Central Warehouse:</p>
          <div class="card">
            <h3 style="margin: 0 0 10px 0; color: #38bdf8; font-size: 16px;">{item_name}</h3>
            <div class="row"><span class="label">Variant:</span><span class="val">{variant_name}</span></div>
            <div class="row"><span class="label">Current Stock:</span><span class="val" style="color: #ef4444;">{current_quantity} units</span></div>
            <div class="row"><span class="label">Safety Threshold:</span><span class="val">{reorder_threshold} units</span></div>
            <div class="row"><span class="label">Time:</span><span class="val">{timestamp_str}</span></div>
          </div>
          <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">Please log into the portal to approve stock refills or place an inbound vendor replenishment PO.</p>
        </div>
        <div class="footer">
          Tata Play Fiber Enterprise Inventory Network • Real-Time Alert Engine
        </div>
      </div>
    </body>
    </html>
    """

    sms_msg = f"⚡ TATA PLAY FIBER ALERT: Low Stock on {item_name} ({variant_name}). Current: {current_quantity} units (Threshold: {reorder_threshold}). Log in to StockSentry to restock."

    # 1. Send Email
    email_res = send_alert_email(to_email=to_email, subject=subject, body_text=plain_text, html_body=html_text)

    # 2. Send SMS
    sms_res = send_alert_sms(to_phone=to_phone, message=sms_msg)

    # 3. Send WhatsApp
    wa_res = send_alert_whatsapp(to_phone=to_phone, message=sms_msg)

    return {
        "timestamp": datetime.now().isoformat(),
        "item_name": item_name,
        "variant_name": variant_name,
        "current_quantity": current_quantity,
        "threshold": reorder_threshold,
        "email_delivery": email_res,
        "sms_delivery": sms_res,
        "whatsapp_delivery": wa_res
    }
