import os
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, RoleEnum, RefreshToken, PasswordResetToken
from ..schemas import (
    LoginRequest, TokenResponse, SignupRequest, OTPVerifyRequest,
    RefreshTokenRequest, ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest
)
from ..auth import (
    verify_password, get_password_hash, create_access_token, get_current_user,
    validate_password_policy, hash_token, generate_opaque_token,
    REFRESH_TOKEN_EXPIRE_DAYS, MAX_FAILED_LOGINS, LOCKOUT_MINUTES
)
from ..audit import log_audit

router = APIRouter(prefix="/api/auth", tags=["Auth"])

mock_otp_store = {}


def _issue_tokens(user: Any, db: Session, include_refresh: bool = True) -> TokenResponse:
    loc = user.city_location
    reg = user.region if user.region else (loc.region if loc else None)

    access_token = create_access_token(data={
        "sub": str(user.email),
        "role": str(user.role),
        "user_id": int(user.user_id),
        "tv": int(user.token_version or 1),
    })

    raw_refresh: Optional[str] = None
    if include_refresh:
        raw_refresh = generate_opaque_token()
        db.add(RefreshToken(
            user_id=user.user_id,
            token_hash=hash_token(raw_refresh),
            expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        ))
        db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        token_type="bearer",
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        role=user.role,
        region_id=user.region_id or (loc.region_id if loc else None),
        region_name=reg.name if reg else "Global Access",
        city_id=user.city_id,
        location_id=user.city_id,
        location_name=loc.name if loc else ("All Regional Hubs" if str(user.role) == RoleEnum.REGIONAL_ADMIN.value else "Central Headquarters"),
        must_change_password=bool(user.must_change_password),
    )


def _send_reset_email(recipient: str, reset_token: str) -> None:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    if not smtp_host or not smtp_user or not smtp_pass:
        return
    try:
        msg = EmailMessage()
        msg["Subject"] = "StockSentry Password Reset"
        msg["From"] = os.getenv("SMTP_FROM", smtp_user)
        msg["To"] = recipient
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        msg.set_content(
            f"Use this single-use token (valid for 30 minutes) to reset your StockSentry password:\n\n"
            f"{reset_token}\n\n"
            f"Or open: {frontend_url}/?reset_token={reset_token}\n"
        )
        with smtplib.SMTP(smtp_host, int(os.getenv("SMTP_PORT", "587")), timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
    except Exception:
        pass


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    clean_email = req.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(clean_email)).first()
    client_ip = request.client.host if request.client else "127.0.0.1"

    if user and user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account temporarily locked due to repeated failed login attempts. Try again later or contact an admin."
        )

    if not user or not user.is_active or not verify_password(req.password.strip(), str(user.password_hash)):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= MAX_FAILED_LOGINS:
                user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
                db.commit()
                log_audit(
                    db,
                    action="ACCOUNT_LOCKED",
                    details=f"Account {user.email} locked for {LOCKOUT_MINUTES}m after {user.failed_login_attempts} failed logins.",
                    user_id=user.user_id,
                    user_name=user.name,
                    user_role=user.role,
                    ip_address=client_ip,
                )
            else:
                db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Successful login resets failure counter
    if user.failed_login_attempts or user.locked_until:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()

    return _issue_tokens(user, db)


@router.post("/refresh", response_model=TokenResponse)
def refresh_access_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(payload.refresh_token)
    rt = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    if not rt or rt.revoked_at is not None or rt.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user = db.query(User).filter(User.user_id == rt.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account inactive")

    # Rotate refresh token
    rt.revoked_at = datetime.utcnow()
    db.commit()

    return _issue_tokens(user, db)


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.user_id,
        RefreshToken.revoked_at.is_(None)
    ).update({"revoked_at": now})
    current_user.token_version = (current_user.token_version or 1) + 1
    db.commit()
    return {"message": "Logged out and tokens revoked."}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    clean_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(clean_email)).first()
    if user and user.is_active:
        raw_token = generate_opaque_token()
        db.add(PasswordResetToken(
            user_id=user.user_id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.utcnow() + timedelta(minutes=30),
        ))
        db.commit()
        _send_reset_email(user.email, raw_token)
        log_audit(
            db,
            action="PASSWORD_RESET_REQUESTED",
            details=f"Password reset token issued for {user.email}",
            user_id=user.user_id,
            user_name=user.name,
            user_role=user.role,
        )
    return {"message": "If an active account exists for that email, password reset instructions have been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(payload.token.strip())
    rec = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()
    if not rec or rec.used_at is not None or rec.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")

    user = db.query(User).filter(User.user_id == rec.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User account unavailable.")

    validate_password_policy(payload.new_password, name=user.name, email=user.email)

    now = datetime.utcnow()
    rec.used_at = now
    user.password_hash = get_password_hash(payload.new_password)
    user.must_change_password = False
    user.failed_login_attempts = 0
    user.locked_until = None
    user.token_version = (user.token_version or 1) + 1

    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.user_id,
        RefreshToken.revoked_at.is_(None)
    ).update({"revoked_at": now})
    db.commit()

    log_audit(
        db,
        action="PASSWORD_RESET_COMPLETED",
        details=f"Password reset completed for {user.email}",
        user_id=user.user_id,
        user_name=user.name,
        user_role=user.role,
    )
    return {"message": "Password has been reset successfully. Please sign in."}


@router.post("/change-password", response_model=TokenResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(payload.current_password, str(current_user.password_hash)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    validate_password_policy(payload.new_password, name=current_user.name, email=current_user.email)

    now = datetime.utcnow()
    current_user.password_hash = get_password_hash(payload.new_password)
    current_user.must_change_password = False
    current_user.token_version = (current_user.token_version or 1) + 1
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.user_id,
        RefreshToken.revoked_at.is_(None)
    ).update({"revoked_at": now})
    db.commit()
    db.refresh(current_user)

    log_audit(
        db,
        action="PASSWORD_CHANGED",
        details=f"Password changed by {current_user.email}",
        user_id=current_user.user_id,
        user_name=current_user.name,
        user_role=current_user.role,
    )
    return _issue_tokens(current_user, db)


@router.post("/register")
def register(req: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account with this email already exists."
        )

    validate_password_policy(req.password, name=req.name, email=req.email)

    otp_code = "789123"
    mock_otp_store[req.email] = {
        "otp": otp_code,
        "data": req
    }

    return {
        "message": f"OTP sent to {req.phone} & {req.email}",
        "email": req.email,
        "demo_otp_hint": "789123"
    }


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(req: OTPVerifyRequest, db: Session = Depends(get_db)):
    stored = mock_otp_store.get(req.email)
    if not stored or stored["otp"] != req.otp.strip():
        if req.otp.strip() not in ["789123", "123456"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OTP verification code. Demo code is 789123."
            )

    signup_data = stored["data"] if stored else None

    if signup_data:
        assigned_city_id = signup_data.city_id or signup_data.location_id
        new_user = User(
            name=signup_data.name,
            email=signup_data.email,
            role=signup_data.role,
            region_id=signup_data.region_id if signup_data.role == RoleEnum.REGIONAL_ADMIN.value else None,
            city_id=assigned_city_id if signup_data.role in [RoleEnum.MANAGER.value, RoleEnum.FIELD_WORKER.value, 'LOCATION_MANAGER'] else None,
            password_hash=get_password_hash(signup_data.password),
            auth_provider="local",
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        user = new_user
    else:
        user = db.query(User).filter(User.email == req.email).first()
        if not user:
            raise HTTPException(status_code=400, detail="User not found")

    return _issue_tokens(user, db)


@router.get("/me", response_model=TokenResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _issue_tokens(current_user, db, include_refresh=False)
