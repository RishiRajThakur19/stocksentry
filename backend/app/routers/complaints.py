from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import get_db
from ..models import (
    AssetComplaint, RepairRequest, AssetUnit, AssetLifecycleEvent, 
    User, Location, Region, RoleEnum
)
from ..schemas import AssetComplaintCreate, AssetComplaintOut
from ..auth import get_current_user

router = APIRouter(prefix="/api/complaints", tags=["Fault Complaints"])

@router.post("", response_model=AssetComplaintOut)
def report_asset_fault(
    payload: AssetComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    asset = db.query(AssetUnit).filter(AssetUnit.asset_id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    # Validation: Field Workers can only report faults on assets assigned to them
    if current_user.role == RoleEnum.FIELD_WORKER.value:
        if asset.current_holder_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access forbidden: You can only report faults on equipment currently assigned to you.")

    # Create AssetComplaint
    complaint = AssetComplaint(
        asset_id=payload.asset_id,
        reported_by=current_user.user_id,
        description=payload.description,
        status="OPEN",
        created_at=datetime.utcnow()
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    # Automatically create a RepairRequest routed to Manager / Regional Admin
    city_id = asset.current_location_id or current_user.city_id or 1
    city = db.query(Location).filter(Location.location_id == city_id).first()
    region_id = city.region_id if city else 1

    repair_req = RepairRequest(
        asset_id=asset.asset_id,
        requested_by=current_user.user_id,
        region_id=region_id,
        city_id=city_id,
        complaint_id=complaint.complaint_id,
        status="PENDING",
        notes=f"Field Worker Fault Report: {payload.description}",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(repair_req)

    # Log lifecycle audit event
    event = AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type="FAULT_REPORTED",
        from_holder_id=asset.current_holder_id,
        from_location_id=asset.current_location_id,
        performed_by=current_user.user_id,
        notes=f"Fault complaint #{complaint.complaint_id} filed by {current_user.name}: {payload.description}",
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()

    return _build_complaint_out(complaint, db)

@router.get("/my", response_model=List[AssetComplaintOut])
def list_my_complaints(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns complaints filed by the current user.
    """
    complaints = db.query(AssetComplaint).filter(
        AssetComplaint.reported_by == current_user.user_id
    ).order_by(AssetComplaint.created_at.desc()).all()

    return [_build_complaint_out(c, db) for c in complaints]

@router.get("", response_model=List[AssetComplaintOut])
def list_all_complaints(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List complaints scoped by role:
    - Super Admin: all
    - Regional Admin: complaints within region
    - Manager: complaints within city
    - Field Worker: only own complaints
    """
    query = db.query(AssetComplaint)
    if current_user.role == RoleEnum.FIELD_WORKER.value:
        query = query.filter(AssetComplaint.reported_by == current_user.user_id)
    elif current_user.role == RoleEnum.MANAGER.value:
        query = query.join(User, AssetComplaint.reported_by == User.user_id).filter(User.city_id == current_user.city_id)
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        query = query.join(User, AssetComplaint.reported_by == User.user_id).filter(User.region_id == current_user.region_id)

    if status and status != 'ALL':
        query = query.filter(AssetComplaint.status == status)

    complaints = query.order_by(AssetComplaint.created_at.desc()).all()
    return [_build_complaint_out(c, db) for c in complaints]

def _build_complaint_out(complaint: AssetComplaint, db: Session) -> AssetComplaintOut:
    asset = complaint.asset
    variant = asset.variant if asset else None
    item = variant.item if variant else None
    reporter = complaint.reporter
    city = reporter.city_location if reporter else None
    reg = reporter.region if reporter else None

    return AssetComplaintOut(
        complaint_id=complaint.complaint_id,
        asset_id=complaint.asset_id,
        serial_number=asset.serial_number if asset else None,
        item_name=item.name if item else None,
        variant_name=variant.variant_name if variant else None,
        reported_by=complaint.reported_by,
        reporter_name=reporter.name if reporter else None,
        reporter_city=city.city if city else None,
        reporter_region=reg.name if reg else None,
        description=complaint.description,
        status=complaint.status,
        created_at=complaint.created_at,
        resolved_at=complaint.resolved_at
    )
