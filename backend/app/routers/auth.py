from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Location, Region, RoleEnum
from ..schemas import LoginRequest, TokenResponse, UserOut, SignupRequest, OTPVerifyRequest
from ..auth import verify_password, get_password_hash, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])

mock_otp_store = {}

def build_token_response(user: Any, db: Session) -> TokenResponse:
    loc = user.city_location
    reg = user.region if user.region else (loc.region if loc else None)
    
    access_token = create_access_token(data={"sub": str(user.email), "role": str(user.role), "user_id": int(user.user_id)})

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        role=user.role,
        region_id=user.region_id or (loc.region_id if loc else None),
        region_name=reg.name if reg else "Global Access",
        city_id=user.city_id,
        location_id=user.city_id,
        location_name=loc.name if loc else ("All Regional Hubs" if str(user.role) == RoleEnum.REGIONAL_ADMIN.value else "Central Headquarters")
    )

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    clean_email = req.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(clean_email)).first()

    if not user or not verify_password(req.password.strip(), str(user.password_hash)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    return build_token_response(user, db)

@router.post("/register")
def register(req: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account with this email already exists."
        )

    # Generate mock 6-digit OTP
    otp_code = "789123"
    mock_otp_store[req.email] = {
        "otp": otp_code,
        "data": req
    }

    return {
        "message": f"OTP sent to {req.phone} & {req.email}",
        "email": req.email,
        "demo_otp_hint": "789123" # Included for smooth demo testing
    }

@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(req: OTPVerifyRequest, db: Session = Depends(get_db)):
    stored = mock_otp_store.get(req.email)
    if not stored or stored["otp"] != req.otp.strip():
        # Allow demo universal OTP 789123 or 123456
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
            password_hash=get_password_hash(signup_data.password)
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        user = new_user
    else:
        user = db.query(User).filter(User.email == req.email).first()
        if not user:
            raise HTTPException(status_code=400, detail="User not found")

    return build_token_response(user, db)

@router.get("/me", response_model=TokenResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return build_token_response(current_user, db)

