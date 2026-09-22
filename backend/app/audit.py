from datetime import datetime
from sqlalchemy.orm import Session
from .models import AuditLog

def log_audit(db: Session, action: str, details: str = "", user_id: int = None, user_name: str = None, user_role: str = None, ip_address: str = "127.0.0.1"):
    try:
        log_entry = AuditLog(
            user_id=user_id,
            user_name=user_name or "System",
            user_role=user_role or "SYSTEM",
            action=action,
            details=details,
            ip_address=ip_address,
            timestamp=datetime.utcnow()
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        print(f"Failed to write audit log: {e}")
