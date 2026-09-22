from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import get_db
from ..models import (
    DecommissionRequest, AssetUnit, AssetLifecycleEvent, User, Location, Region, 
    AssetStatusEnum, RoleEnum
)
from ..schemas import DecommissionRequestCreate, DecommissionRequestOut
from ..auth import get_current_user, require_regional_or_super_admin, require_manager_or_above

router = APIRouter(prefix="/api/decommission", tags=["Decommission & Scrap"])

@router.post("/requests", response_model=DecommissionRequestOut)
def initiate_decommission_request(
    payload: DecommissionRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    asset = db.query(AssetUnit).filter(AssetUnit.asset_id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    city_id = asset.current_location_id or current_user.city_id or 1
    city = db.query(Location).filter(Location.location_id == city_id).first()
    region_id = city.region_id if city else 1

    decom = DecommissionRequest(
        asset_id=payload.asset_id,
        requested_by=current_user.user_id,
        region_id=region_id,
        reason=payload.reason,
        notes=payload.notes,
        status="PENDING",
        created_at=datetime.utcnow()
    )
    db.add(decom)

    event = AssetLifecycleEvent(
        asset_id=payload.asset_id,
        event_type="DECOMMISSION_REQUESTED",
        from_holder_id=asset.current_holder_id,
        from_location_id=asset.current_location_id,
        performed_by=current_user.user_id,
        notes=f"Decommission scrap request initiated: {payload.reason}",
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(decom)

    return _build_decommission_out(decom, db)

@router.get("/requests", response_model=List[DecommissionRequestOut])
def list_decommission_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(DecommissionRequest)
    if current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        query = query.filter(DecommissionRequest.region_id == current_user.region_id)
    elif current_user.role == RoleEnum.MANAGER.value:
        query = query.filter(DecommissionRequest.requested_by == current_user.user_id)

    if status and status != 'ALL':
        query = query.filter(DecommissionRequest.status == status)

    requests = query.order_by(DecommissionRequest.created_at.desc()).all()
    return [_build_decommission_out(r, db) for r in requests]

@router.put("/requests/{decommission_id}/approve", response_model=DecommissionRequestOut)
def approve_decommission_request(
    decommission_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_regional_or_super_admin)
):
    decom = db.query(DecommissionRequest).filter(DecommissionRequest.decommission_id == decommission_id).first()
    if not decom:
        raise HTTPException(status_code=404, detail="Decommission request not found.")

    if current_user.role == RoleEnum.REGIONAL_ADMIN.value and decom.region_id != current_user.region_id:
        raise HTTPException(status_code=403, detail="Access forbidden: You can only approve decommission requests for your assigned region.")

    asset = decom.asset
    old_holder = asset.current_holder_id
    old_loc = asset.current_location_id

    # Mark asset DECOMMISSIONED permanently
    asset.status = AssetStatusEnum.DECOMMISSIONED.value
    asset.current_holder_id = None
    asset.current_location_id = None
    asset.repair_location_id = None

    decom.status = "APPROVED"
    decom.approved_by = current_user.user_id
    decom.approved_at = datetime.utcnow()
    decom.notes = notes or decom.notes

    event = AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type="SCRAPPED",
        from_holder_id=old_holder,
        to_holder_id=None,
        from_location_id=old_loc,
        performed_by=current_user.user_id,
        notes=f"Decommission approved by {current_user.name}. Asset retired & scrapped: {decom.reason}. {notes or ''}",
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(decom)

    return _build_decommission_out(decom, db)

@router.put("/requests/{decommission_id}/reject", response_model=DecommissionRequestOut)
def reject_decommission_request(
    decommission_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_regional_or_super_admin)
):
    decom = db.query(DecommissionRequest).filter(DecommissionRequest.decommission_id == decommission_id).first()
    if not decom:
        raise HTTPException(status_code=404, detail="Decommission request not found.")

    if current_user.role == RoleEnum.REGIONAL_ADMIN.value and decom.region_id != current_user.region_id:
        raise HTTPException(status_code=403, detail="Access forbidden: You can only reject decommission requests for your assigned region.")

    decom.status = "REJECTED"
    decom.approved_by = current_user.user_id
    decom.notes = notes or decom.notes
    decom.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(decom)
    return _build_decommission_out(decom, db)

def _build_decommission_out(decom: DecommissionRequest, db: Session) -> DecommissionRequestOut:
    asset = decom.asset
    variant = asset.variant if asset else None
    item = variant.item if variant else None
    requester = decom.requester
    approver = decom.approver
    region = db.query(Region).filter(Region.region_id == decom.region_id).first()

    return DecommissionRequestOut(
        decommission_id=decom.decommission_id,
        asset_id=decom.asset_id,
        serial_number=asset.serial_number if asset else None,
        item_name=item.name if item else None,
        variant_name=variant.variant_name if variant else None,
        requested_by=decom.requested_by,
        requester_name=requester.name if requester else None,
        approved_by=decom.approved_by,
        approver_name=approver.name if approver else None,
        region_id=decom.region_id,
        region_name=region.name if region else None,
        reason=decom.reason,
        status=decom.status,
        notes=decom.notes,
        created_at=decom.created_at,
        approved_at=decom.approved_at
    )
