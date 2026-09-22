from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import get_db
from ..models import (
    RepairLocation, RepairRequest, AssetUnit, AssetLifecycleEvent, 
    AssetComplaint, DecommissionRequest, User, Location, Region, 
    AssetStatusEnum, RoleEnum
)
from ..schemas import (
    RepairLocationOut, RepairLocationCreate, RepairRequestCreate, 
    RepairRequestApprove, RepairRequestComplete, RepairRequestOut
)
from ..auth import get_current_user, require_regional_or_super_admin, require_manager_or_above

router = APIRouter(prefix="/api/repairs", tags=["Repairs & Facilities"])

@router.get("/locations", response_model=List[RepairLocationOut])
def list_repair_locations(
    region_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(RepairLocation).filter(RepairLocation.is_active == True)
    if region_id:
        query = query.filter(RepairLocation.region_id == region_id)
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value and current_user.region_id:
        query = query.filter(RepairLocation.region_id == current_user.region_id)

    locations = query.all()
    out = []
    for loc in locations:
        active_count = db.query(AssetUnit).filter(
            AssetUnit.repair_location_id == loc.repair_location_id,
            AssetUnit.status == AssetStatusEnum.IN_REPAIR.value
        ).count()

        city = loc.city
        reg = loc.region

        out.append(RepairLocationOut(
            repair_location_id=loc.repair_location_id,
            name=loc.name,
            city_id=loc.city_id,
            region_id=loc.region_id,
            city_name=city.city if city else None,
            region_name=reg.name if reg else None,
            address=loc.address,
            contact_phone=loc.contact_phone,
            is_active=loc.is_active,
            active_repairs_count=active_count
        ))

    return out

@router.post("/locations", response_model=RepairLocationOut)
def create_repair_location(
    payload: RepairLocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_regional_or_super_admin)
):
    if current_user.role == RoleEnum.REGIONAL_ADMIN.value and current_user.region_id != payload.region_id:
        raise HTTPException(status_code=403, detail="Access forbidden: You can only create repair centers in your assigned region.")

    city = db.query(Location).filter(Location.location_id == payload.city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City location not found.")

    new_loc = RepairLocation(
        name=payload.name,
        city_id=payload.city_id,
        region_id=payload.region_id,
        address=payload.address,
        contact_phone=payload.contact_phone,
        is_active=True
    )
    db.add(new_loc)
    db.commit()
    db.refresh(new_loc)

    return RepairLocationOut(
        repair_location_id=new_loc.repair_location_id,
        name=new_loc.name,
        city_id=new_loc.city_id,
        region_id=new_loc.region_id,
        city_name=city.city,
        region_name=city.region.name if city.region else None,
        address=new_loc.address,
        contact_phone=new_loc.contact_phone,
        is_active=new_loc.is_active,
        active_repairs_count=0
    )

@router.post("/requests", response_model=RepairRequestOut)
def initiate_repair_request(
    payload: RepairRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    asset = db.query(AssetUnit).filter(AssetUnit.asset_id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    city_id = asset.current_location_id or current_user.city_id or 1
    city = db.query(Location).filter(Location.location_id == city_id).first()
    region_id = city.region_id if city else 1

    req = RepairRequest(
        asset_id=payload.asset_id,
        requested_by=current_user.user_id,
        region_id=region_id,
        city_id=city_id,
        repair_location_id=payload.repair_location_id,
        complaint_id=payload.complaint_id,
        status="PENDING",
        notes=payload.notes,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(req)

    # Log lifecycle event
    event = AssetLifecycleEvent(
        asset_id=payload.asset_id,
        event_type="REPAIR_REQUESTED",
        from_holder_id=asset.current_holder_id,
        from_location_id=asset.current_location_id,
        performed_by=current_user.user_id,
        notes=f"Repair initiated: {payload.notes or 'Routine fault inspection'}",
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(req)

    return _build_repair_out(req, db)

@router.get("/requests", response_model=List[RepairRequestOut])
def list_repair_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(RepairRequest)
    if current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        query = query.filter(RepairRequest.region_id == current_user.region_id)
    elif current_user.role == RoleEnum.MANAGER.value:
        query = query.filter(RepairRequest.city_id == current_user.city_id)
    elif current_user.role == RoleEnum.FIELD_WORKER.value:
        query = query.filter(RepairRequest.requested_by == current_user.user_id)

    if status and status != 'ALL':
        query = query.filter(RepairRequest.status == status)

    requests = query.order_by(RepairRequest.created_at.desc()).all()
    return [_build_repair_out(r, db) for r in requests]

@router.put("/requests/{repair_request_id}/approve", response_model=RepairRequestOut)
def approve_repair_request(
    repair_request_id: int,
    payload: RepairRequestApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_regional_or_super_admin)
):
    req = db.query(RepairRequest).filter(RepairRequest.repair_request_id == repair_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Repair request not found.")

    if current_user.role == RoleEnum.REGIONAL_ADMIN.value and req.region_id != current_user.region_id:
        raise HTTPException(status_code=403, detail="Access forbidden: You can only approve repair requests for your assigned region.")

    repair_fac = db.query(RepairLocation).filter(RepairLocation.repair_location_id == payload.repair_location_id).first()
    if not repair_fac:
        raise HTTPException(status_code=404, detail="Repair location facility not found.")

    asset = req.asset
    old_holder = asset.current_holder_id
    old_loc = asset.current_location_id

    # Transition asset to IN_REPAIR at RepairLocation
    asset.status = AssetStatusEnum.IN_REPAIR.value
    asset.current_holder_id = None # Cleared
    asset.repair_location_id = payload.repair_location_id

    req.status = "IN_REPAIR"
    req.approved_by = current_user.user_id
    req.repair_location_id = payload.repair_location_id
    req.notes = payload.notes or req.notes
    req.updated_at = datetime.utcnow()

    if req.complaint:
        req.complaint.status = "ROUTED_TO_REPAIR"

    # Log lifecycle event
    event = AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type="REPAIR_APPROVED",
        from_holder_id=old_holder,
        to_holder_id=None,
        from_location_id=old_loc,
        repair_location_id=payload.repair_location_id,
        performed_by=current_user.user_id,
        notes=f"Repair approved. Routed to facility: {repair_fac.name}. {payload.notes or ''}",
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(req)

    return _build_repair_out(req, db)

@router.put("/requests/{repair_request_id}/reject", response_model=RepairRequestOut)
def reject_repair_request(
    repair_request_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_regional_or_super_admin)
):
    req = db.query(RepairRequest).filter(RepairRequest.repair_request_id == repair_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Repair request not found.")

    if current_user.role == RoleEnum.REGIONAL_ADMIN.value and req.region_id != current_user.region_id:
        raise HTTPException(status_code=403, detail="Access forbidden: You can only reject repair requests for your assigned region.")

    req.status = "REJECTED"
    req.approved_by = current_user.user_id
    req.notes = notes or req.notes
    req.updated_at = datetime.utcnow()

    if req.complaint:
        req.complaint.status = "REJECTED"

    db.commit()
    db.refresh(req)
    return _build_repair_out(req, db)

@router.put("/requests/{repair_request_id}/complete", response_model=RepairRequestOut)
def complete_repair_action(
    repair_request_id: int,
    payload: RepairRequestComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_regional_or_super_admin)
):
    """
    On repair completion:
    (a) "RETURN_TO_WAREHOUSE": asset status -> IN_WAREHOUSE, location -> Central Warehouse (None), repair_location cleared.
    (b) "ROUTE_TO_SCRAP": routes directly to Decommission flow, marks ROUTED_TO_SCRAP.
    """
    req = db.query(RepairRequest).filter(RepairRequest.repair_request_id == repair_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Repair request not found.")

    if current_user.role == RoleEnum.REGIONAL_ADMIN.value and req.region_id != current_user.region_id:
        raise HTTPException(status_code=403, detail="Access forbidden: You can only manage repairs for your assigned region.")

    asset = req.asset

    import json
    work_order_meta = {
        "technician_name": payload.technician_name or "Er. Deepak Sharma (Lead RF Engineer)",
        "bench_station": payload.bench_station or f"Bench Station #{req.repair_location_id or 1} - Precision Lab",
        "parts_replaced": payload.parts_replaced or ["V-Groove Optical Alignment Block", "High-Voltage Electrode Tip"],
        "labor_hours": payload.labor_hours if payload.labor_hours is not None else 3.5,
        "calibration_certificate_no": payload.calibration_certificate_no or f"CAL-TATA-2026-0{req.repair_request_id:04d}",
        "optical_loss_db": payload.optical_loss_db if payload.optical_loss_db is not None else 0.02,
        "burn_in_hours": payload.burn_in_hours if payload.burn_in_hours is not None else 4.0,
        "qa_signoff": payload.qa_signoff if payload.qa_signoff is not None else True,
        "action": payload.resolution_action,
        "completed_at": datetime.utcnow().isoformat()
    }

    # Store note with work order metadata separator
    raw_user_note = payload.notes or req.notes or ""
    serialized_meta = json.dumps(work_order_meta)
    combined_notes = f"{raw_user_note} ||WORK_ORDER_META|| {serialized_meta}"

    parts_summary = ", ".join(work_order_meta["parts_replaced"]) if work_order_meta["parts_replaced"] else "Optical alignment & recalibration"

    if payload.resolution_action == "RETURN_TO_TECHNICIAN":
        # (1) Return calibrated hardware directly to the originating Field Technician
        original_tech_id = req.requested_by
        tech_user = db.query(User).filter(User.user_id == original_tech_id).first()
        tech_name = tech_user.name if tech_user else f"Technician #{original_tech_id}"
        loc = db.query(Location).filter(Location.location_id == req.city_id).first()
        loc_name = loc.name if loc else "City Hub"

        asset.status = AssetStatusEnum.ASSIGNED.value
        asset.current_holder_id = original_tech_id
        asset.current_location_id = req.city_id
        asset.repair_location_id = None

        req.status = "REPAIR_RETURNED"
        req.notes = combined_notes
        req.updated_at = datetime.utcnow()

        if req.complaint:
            req.complaint.status = "RESOLVED"
            req.complaint.resolved_at = datetime.utcnow()

        event = AssetLifecycleEvent(
            asset_id=asset.asset_id,
            event_type="REPAIR_RETURNED_TO_TECHNICIAN",
            to_holder_id=original_tech_id,
            to_location_id=req.city_id,
            repair_location_id=req.repair_location_id,
            performed_by=current_user.user_id,
            notes=f"Certified Bench Overhaul Complete [Cert #{work_order_meta['calibration_certificate_no']}]. Tech: {work_order_meta['technician_name']}. Replaced: {parts_summary}. Optical Loss: {work_order_meta['optical_loss_db']} dB. Reassigned and returned directly to Field Technician {tech_name} ({loc_name}).",
            timestamp=datetime.utcnow()
        )
        db.add(event)

    elif payload.resolution_action == "RETURN_TO_CITY_HUB":
        # (2) Return to local Regional City Hub stock (e.g. Delhi Regional Hub inventory)
        loc = db.query(Location).filter(Location.location_id == req.city_id).first()
        loc_name = loc.name if loc else "City Hub"

        asset.status = "IN_STOCK"
        asset.current_holder_id = None
        asset.current_location_id = req.city_id
        asset.repair_location_id = None

        req.status = "REPAIR_RETURNED"
        req.notes = combined_notes
        req.updated_at = datetime.utcnow()

        if req.complaint:
            req.complaint.status = "RESOLVED"
            req.complaint.resolved_at = datetime.utcnow()

        event = AssetLifecycleEvent(
            asset_id=asset.asset_id,
            event_type="REPAIR_RETURNED_TO_CITY_HUB",
            to_holder_id=None,
            to_location_id=req.city_id,
            repair_location_id=req.repair_location_id,
            performed_by=current_user.user_id,
            notes=f"Certified Bench Overhaul Complete [Cert #{work_order_meta['calibration_certificate_no']}]. Tech: {work_order_meta['technician_name']}. Replaced: {parts_summary}. Optical Loss: {work_order_meta['optical_loss_db']} dB. Restocked into {loc_name} active city inventory pool.",
            timestamp=datetime.utcnow()
        )
        db.add(event)

    elif payload.resolution_action == "RETURN_TO_WAREHOUSE":
        # (3) Recommission to Central National Warehouse pool
        asset.status = AssetStatusEnum.IN_WAREHOUSE.value
        asset.current_location_id = None # Central Warehouse pool
        asset.current_holder_id = None
        asset.repair_location_id = None

        req.status = "REPAIR_RETURNED"
        req.notes = combined_notes
        req.updated_at = datetime.utcnow()

        if req.complaint:
            req.complaint.status = "RESOLVED"
            req.complaint.resolved_at = datetime.utcnow()

        event = AssetLifecycleEvent(
            asset_id=asset.asset_id,
            event_type="REPAIR_COMPLETED",
            repair_location_id=req.repair_location_id,
            to_location_id=None,
            performed_by=current_user.user_id,
            notes=f"Certified Bench Overhaul Complete [Cert #{work_order_meta['calibration_certificate_no']}]. Tech: {work_order_meta['technician_name']}. Replaced: {parts_summary}. Optical Loss: {work_order_meta['optical_loss_db']} dB. Returned to Central National Warehouse pool.",
            timestamp=datetime.utcnow()
        )
        db.add(event)

    elif payload.resolution_action == "ROUTE_TO_SCRAP":
        req.status = "ROUTED_TO_SCRAP"
        req.notes = combined_notes
        req.updated_at = datetime.utcnow()

        # Create Decommission Request automatically
        decom = DecommissionRequest(
            asset_id=asset.asset_id,
            requested_by=current_user.user_id,
            region_id=req.region_id,
            reason=f"Beyond Economical Repair (BER). Tech: {work_order_meta['technician_name']}. {payload.notes or 'Critical PCB core layer delamination'}",
            status="PENDING",
            created_at=datetime.utcnow()
        )
        db.add(decom)

        event = AssetLifecycleEvent(
            asset_id=asset.asset_id,
            event_type="DECOMMISSION_REQUESTED",
            repair_location_id=req.repair_location_id,
            performed_by=current_user.user_id,
            notes=f"Asset inspected at lab and condemned as Beyond Economical Repair (BER). Tech: {work_order_meta['technician_name']}. Routed to scrap decommission queue. {payload.notes or ''}",
            timestamp=datetime.utcnow()
        )
        db.add(event)

    db.commit()
    db.refresh(req)
    return _build_repair_out(req, db)

def _build_repair_out(req: RepairRequest, db: Session) -> RepairRequestOut:
    asset = req.asset
    variant = asset.variant if asset else None
    item = variant.item if variant else None
    requester = req.requester
    approver = req.approver
    region = db.query(Region).filter(Region.region_id == req.region_id).first()
    city = db.query(Location).filter(Location.location_id == req.city_id).first()
    repair_fac = req.repair_facility

    # Parse work_order_meta if serialized
    import json
    notes_clean = req.notes or ""
    parsed_meta = None
    if "||WORK_ORDER_META||" in notes_clean:
        parts = notes_clean.split("||WORK_ORDER_META||")
        notes_clean = parts[0].strip()
        try:
            parsed_meta = json.loads(parts[1].strip())
        except Exception:
            parsed_meta = None

    return RepairRequestOut(
        repair_request_id=req.repair_request_id,
        asset_id=req.asset_id,
        serial_number=asset.serial_number if asset else None,
        item_name=item.name if item else None,
        variant_name=variant.variant_name if variant else None,
        requested_by=req.requested_by,
        requester_name=requester.name if requester else None,
        approved_by=req.approved_by,
        approver_name=approver.name if approver else None,
        region_id=req.region_id,
        region_name=region.name if region else None,
        city_id=req.city_id,
        city_name=city.city if city else None,
        repair_location_id=req.repair_location_id,
        repair_location_name=repair_fac.name if repair_fac else None,
        complaint_id=req.complaint_id,
        status=req.status,
        notes=notes_clean,
        created_at=req.created_at,
        updated_at=req.updated_at,
        work_order_meta=parsed_meta
    )
