import os
import re
import hashlib
import secrets
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, Location, RoleEnum

SECRET_KEY = os.getenv("SECRET_KEY", "stocksentry_secret_key_tata_play_fiber_demo")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES = 15

COMMON_PASSWORDS = {
    "password", "password123", "1234567890", "123456789", "qwerty1234",
    "admin12345", "letmein123", "welcome123", "tataplay123", "stocksentry",
    "iloveyou12", "abc1234567", "0000000000", "1111111111", "changeme123"
}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

MUST_CHANGE_EXEMPT_PATHS = {
    "/api/auth/change-password",
    "/api/auth/me",
    "/api/auth/logout",
    "/api/auth/refresh",
}


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_opaque_token() -> str:
    return secrets.token_urlsafe(48)


def validate_password_policy(password: str, name: str = "", email: str = "") -> None:
    if not password or len(password) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 10 characters long."
        )
    lower_pw = password.lower()
    if lower_pw in COMMON_PASSWORDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is too common. Please choose a stronger password."
        )
    if name:
        for part in re.split(r"[\s._-]+", name.lower()):
            if len(part) >= 3 and part in lower_pw:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password must not contain your name."
                )
    if email and "@" in email:
        local_part = email.split("@")[0].lower()
        if len(local_part) >= 3 and local_part in lower_pw:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must not contain your email address."
            )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token_payload(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token_payload(token)
        email: Optional[str] = payload.get("sub")
        token_version: Optional[int] = payload.get("tv")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.is_active:
        raise credentials_exception

    if token_version is not None and user.token_version != token_version:
        raise credentials_exception

    if user.must_change_password and request.url.path not in MUST_CHANGE_EXEMPT_PATHS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required before accessing this resource."
        )

    return user


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Super Admin role required"
        )
    return current_user


require_admin = require_super_admin


def require_regional_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != RoleEnum.REGIONAL_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Regional Admin role required"
        )
    return current_user


def require_regional_or_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN", RoleEnum.REGIONAL_ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Regional Admin or Super Admin role required"
        )
    return current_user


def require_manager_or_above(current_user: User = Depends(get_current_user)) -> User:
    allowed = [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN", RoleEnum.REGIONAL_ADMIN.value, RoleEnum.MANAGER.value]
    if current_user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Manager or Admin role required"
        )
    return current_user


def verify_user_scope_for_location(user: User, location_id: int, db: Session):
    if user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        return True

    target_location = db.query(Location).filter(Location.location_id == location_id).first()
    if not target_location:
        raise HTTPException(status_code=404, detail="Location not found")

    if user.role == RoleEnum.REGIONAL_ADMIN.value:
        if target_location.region_id != user.region_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Location '{target_location.name}' is outside your assigned region."
            )
        return True

    if user.role in [RoleEnum.MANAGER.value, RoleEnum.FIELD_WORKER.value]:
        if target_location.location_id not in user.territory_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Location '{target_location.name}' is outside your assigned city."
            )
        return True

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: Insufficient permissions")


def verify_user_scope_for_region(user: User, region_id: int, db: Session):
    if user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        return True

    if user.role == RoleEnum.REGIONAL_ADMIN.value:
        if user.region_id != region_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Operation target is outside your assigned region."
            )
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access forbidden: Regional Admin or Super Admin role required"
    )
