import os
import smtplib
import logging
import threading
import time
from email.message import EmailMessage
from typing import Optional
from sqlalchemy.orm import Session
from ..models import NotificationPreference, User

logger = logging.getLogger("stocksentry.email")


def _should_send(db: Session, user_id: int, category: str) -> bool:
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    if not pref:
        return True
    return bool(getattr(pref, f"email_{category}", True))


def send_email_async(recipient: str, subject: str, body: str, max_retries: int = 3):
    """
    Dispatches email in a background daemon thread with exponential backoff retries.
    Never blocks API requests.
    """
    smtp_host = os.getenv("SMTP_HOST")
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    if not smtp_host or not smtp_user or not smtp_pass or not recipient:
        return

    def _worker():
        for attempt in range(1, max_retries + 1):
            try:
                msg = EmailMessage()
                msg["Subject"] = subject
                msg["From"] = os.getenv("SMTP_FROM", smtp_user)
                msg["To"] = recipient
                msg.set_content(body)
                with smtplib.SMTP(smtp_host, int(os.getenv("SMTP_PORT", "587")), timeout=10) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
                return
            except Exception as e:
                logger.warning(f"Email attempt {attempt}/{max_retries} failed for {recipient}: {e}")
                time.sleep(min(5, attempt * 2))

    threading.Thread(target=_worker, daemon=True).start()


def notify_user_email(db: Session, user: Optional[User], category: str, subject: str, body: str):
    if not user or not user.is_active or not user.email:
        return
    if not _should_send(db, user.user_id, category):
        return
    send_email_async(user.email, subject, body)
