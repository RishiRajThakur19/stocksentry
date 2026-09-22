import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger("stocksentry.email")

def send_alert_email(
    to_email: str, 
    subject: str, 
    body_text: str, 
    html_body: str = None,
    smtp_host: str = None,
    smtp_port: int = 587,
    smtp_user: str = None,
    smtp_password: str = None
) -> dict:
    """
    Sends an email using standard SMTP (Gmail, SendGrid, Mailgun, or custom SMTP server).
    Returns dict with success status and detailed message.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_user or "alerts@tataplayfiber.com"
    msg["To"] = to_email

    text_part = MIMEText(body_text, "plain")
    msg.attach(text_part)

    if html_body:
        html_part = MIMEText(html_body, "html")
        msg.attach(html_part)

    # If live SMTP credentials are provided, attempt real network delivery
    if smtp_host and smtp_user and smtp_password:
        try:
            logger.info(f"📧 [SMTP NETWORK DISPATCH] Connecting to {smtp_host}:{smtp_port} for {to_email}...")
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, [to_email], msg.as_string())
            server.quit()
            
            logger.info(f"✅ Real email delivered to {to_email} via {smtp_host}!")
            return {
                "success": True,
                "mode": "LIVE_SMTP_NETWORK_SENT",
                "message": f"Real email delivered to {to_email} via {smtp_host}!"
            }
        except Exception as e:
            logger.error(f"❌ SMTP delivery failed: {e}")
            return {
                "success": False,
                "mode": "SMTP_ERROR",
                "message": f"SMTP delivery failed: {str(e)}"
            }
    else:
        # System simulation mode (no credentials provided yet)
        logger.info(f"📧 [SYSTEM DISPATCH] Alert logged for {to_email}. (To send real emails to your personal inbox, provide SMTP/Gmail credentials below)")
        return {
            "success": True,
            "mode": "SYSTEM_DISPATCH_LOGGED",
            "message": f"Dispatched and logged for {to_email}. Configure SMTP credentials below for live inbox delivery."
        }
