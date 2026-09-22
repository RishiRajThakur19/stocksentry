import os
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, Location, Region, RoleEnum

SECRET_KEY = os.getenv("SECRET_KEY", "stocksentry_secret_key_tata_play_fiber_demo")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours for demo ease

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Super Admin role required"
        )
    return current_user

# Alias for backwards compatibility
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

# Scope authorization helpers
def verify_user_scope_for_location(user: User, location_id: int, db: Session):
    """
    Validates if user has permission to access/act on a given city location.
    Raises HTTP 403 if out-of-scope.
    """
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
        user_city_id = user.city_id or user.location_id
        if target_location.location_id != user_city_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Location '{target_location.name}' is outside your assigned city."
            )
        return True

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: Insufficient permissions")

def verify_user_scope_for_region(user: User, region_id: int, db: Session):
    """
    Validates if user has permission to access a region.
    Raises HTTP 403 if out-of-scope.
    """
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

