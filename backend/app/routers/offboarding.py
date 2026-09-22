import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import get_db
from ..models import User, AssetUnit, NOCRecord, Location, Region, RoleEnum, AssetLifecycleEvent, ItemVariant, Item, ManagerHandoverRecord
from ..schemas import (
    MarkLeavingRequest, ClearanceCheckResponse, IssueNOCRequest, NOCRecordOut, AssetUnitOut,
    SurrenderAssetRequest, OnboardStaffRequest, ManagerHandoverRequest, ManagerHandoverRecordOut
)
from ..auth import get_current_user, require_manager_or_above, require_regional_or_super_admin, get_password_hash
from ..audit import log_audit

router = APIRouter(prefix="/api/offboarding", tags=["Offboarding & NOC Clearance"])

@router.post("/mark-leaving", response_model=ClearanceCheckResponse)
def mark_employee_leaving(
    payload: MarkLeavingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    target_user = db.query(User).filter(User.user_id == payload.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Scope check: Managers can only offboard their field workers; Regional Admins can offboard managers in their region
    if current_user.role == RoleEnum.MANAGER.value:
        if target_user.city_id != current_user.city_id or target_user.role != RoleEnum.FIELD_WORKER.value:
            raise HTTPException(status_code=403, detail="Access forbidden: You can only offboard field technicians in your city hub.")
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        if target_user.region_id != current_user.region_id and target_user.city_location.region_id != current_user.region_id:
            raise HTTPException(status_code=403, detail="Access forbidden: You can only offboard personnel within your assigned region.")

    target_user.is_leaving = True
    target_user.clearance_status = "PENDING_CLEARANCE"
    db.commit()
    db.refresh(target_user)

    log_audit(db, "MARK_LEAVING", f"{current_user.name} initiated offboarding & clearance audit for {target_user.name}", current_user.user_id, current_user.name, current_user.role)

    return _build_clearance_check(target_user, db)

@router.post("/cancel-leaving", response_model=ClearanceCheckResponse)
def cancel_employee_leaving(
    payload: MarkLeavingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    target_user = db.query(User).filter(User.user_id == payload.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")
    target_user.is_leaving = False
    target_user.clearance_status = "ACTIVE"
    db.commit()
    db.refresh(target_user)
    log_audit(db, "CANCEL_OFFBOARDING", f"{current_user.name} reverted offboarding for {target_user.name}", current_user.user_id, current_user.name, current_user.role)
    return _build_clearance_check(target_user, db)

@router.get("/check-clearance/{user_id}", response_model=ClearanceCheckResponse)
def check_asset_clearance(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    target_user = db.query(User).filter(User.user_id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    return _build_clearance_check(target_user, db)

@router.post("/issue-noc", response_model=NOCRecordOut)
def issue_noc_certificate(
    payload: IssueNOCRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    target_user = db.query(User).filter(User.user_id == payload.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Check for remaining assigned assets
    assigned_assets = db.query(AssetUnit).filter(
        AssetUnit.current_holder_id == target_user.user_id
    ).all()

    if len(assigned_assets) > 0:
        serials = [a.serial_number for a in assigned_assets]
        raise HTTPException(
            status_code=400, 
            detail=f"NOC Issuance Blocked: User still holds {len(assigned_assets)} active asset(s) ({', '.join(serials)}). Must return to warehouse, reassign, or route to repair first."
        )

    # Generate unique NOC Number
    timestamp_str = datetime.utcnow().strftime("%Y%m%d")
    noc_number = f"TPF-NOC-{timestamp_str}-{target_user.user_id:04d}"

    city = target_user.city_location
    reg = target_user.region or (city.region if city else None)

    noc = NOCRecord(
        noc_number=noc_number,
        user_id=target_user.user_id,
        user_name=target_user.name,
        user_role=target_user.role,
        city_name=city.city if city else "National Central",
        region_name=reg.name if reg else "Central Region",
        issued_by_id=current_user.user_id,
        issued_by_name=current_user.name,
        cleared_at=datetime.utcnow(),
        cleared_assets_summary=json.dumps({"status": "100% Cleared", "active_holdings": 0}),
        remarks=payload.remarks or "All Tata Play Fiber assets verified, returned and cleared."
    )
    db.add(noc)

    target_user.clearance_status = "OFFBOARDED"
    target_user.is_active = 0
    target_user.is_leaving = False

    db.commit()
    db.refresh(noc)

    return _build_noc_out(noc)

@router.get("/noc-records", response_model=List[NOCRecordOut])
def list_noc_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    query = db.query(NOCRecord)
    if current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        reg = db.query(Region).filter(Region.region_id == current_user.region_id).first()
        if reg:
            query = query.filter(NOCRecord.region_name == reg.name)
    elif current_user.role == RoleEnum.MANAGER.value:
        loc = db.query(Location).filter(Location.location_id == current_user.city_id).first()
        if loc:
            query = query.filter(NOCRecord.city_name == loc.city)

    records = query.order_by(NOCRecord.cleared_at.desc()).all()
    return [_build_noc_out(r) for r in records]

@router.post("/surrender-asset", response_model=ClearanceCheckResponse)
def surrender_asset(
    payload: SurrenderAssetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    asset = db.query(AssetUnit).filter(AssetUnit.asset_id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    if not asset.current_holder_id:
        raise HTTPException(status_code=400, detail="Asset is not currently held by any personnel.")

    holder = db.query(User).filter(User.user_id == asset.current_holder_id).first()
    old_holder_id = asset.current_holder_id
    old_holder_name = holder.name if holder else f"User #{old_holder_id}"

    is_damaged = payload.condition.upper() == "DAMAGED"
    new_status = "FAULTY" if is_damaged else "IN_STOCK"

    asset.status = new_status
    asset.current_holder_id = None

    event = AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type="SURRENDERED_CLEARANCE" if not is_damaged else "SURRENDERED_DAMAGED",
        from_holder_id=old_holder_id,
        to_holder_id=None,
        from_location_id=asset.current_location_id,
        to_location_id=asset.current_location_id,
        performed_by=current_user.user_id,
        notes=f"Surrendered during clearance inspection. Condition: {payload.condition}. {payload.notes or ''}"
    )
    db.add(event)
    db.commit()
    db.refresh(asset)

    log_audit(db, "SURRENDER_ASSET", f"Asset {asset.serial_number} surrendered by {old_holder_name} (Condition: {payload.condition})", current_user.user_id, current_user.name, current_user.role)

    if holder:
        return _build_clearance_check(holder, db)
    raise HTTPException(status_code=400, detail="Original holder not found.")

@router.get("/available-hub-assets")
def get_available_hub_assets(
    city_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    query = db.query(AssetUnit).filter(AssetUnit.current_holder_id == None).filter(
        AssetUnit.status.in_(["IN_STOCK", "IN_WAREHOUSE", "AT_LOCATION"])
    )
    if city_id:
        query = query.filter(AssetUnit.current_location_id == city_id)
    elif current_user.role == RoleEnum.MANAGER.value:
        query = query.filter(AssetUnit.current_location_id == current_user.city_id)

    assets = query.limit(100).all()
    out = []
    for a in assets:
        v = a.variant
        item = v.item if v else None
        loc = a.location
        out.append({
            "asset_id": a.asset_id,
            "serial_number": a.serial_number,
            "item_name": item.name if item else "Equipment",
            "variant_name": v.variant_name if v else "",
            "category": item.category if item else "Hardware",
            "location_name": loc.city if loc else "Central Warehouse",
            "status": a.status
        })
    return out

@router.post("/onboard-staff")
def onboard_staff(
    payload: OnboardStaffRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    assigned_city_id = payload.city_id
    assigned_region_id = payload.region_id

    if current_user.role == RoleEnum.MANAGER.value:
        assigned_city_id = current_user.city_id
        assigned_region_id = current_user.region_id
        if payload.role != RoleEnum.FIELD_WORKER.value:
            raise HTTPException(status_code=403, detail="Managers can only onboard Field Technicians in their city hub.")

    new_user = User(
        name=payload.name,
        email=payload.email,
        password_hash=get_password_hash(payload.password or "tataplay123"),
        role=payload.role,
        region_id=assigned_region_id if payload.role == RoleEnum.REGIONAL_ADMIN.value else None,
        city_id=assigned_city_id if payload.role in [RoleEnum.MANAGER.value, RoleEnum.FIELD_WORKER.value] else None,
        is_active=1,
        clearance_status="ACTIVE",
        is_leaving=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    assigned_kit_serials = []
    if payload.initial_asset_ids:
        for aid in payload.initial_asset_ids:
            asset = db.query(AssetUnit).filter(AssetUnit.asset_id == aid).first()
            if asset and not asset.current_holder_id:
                asset.current_holder_id = new_user.user_id
                asset.status = "ASSIGNED"
                ev = AssetLifecycleEvent(
                    asset_id=asset.asset_id,
                    event_type="ASSIGNED",
                    from_holder_id=None,
                    to_holder_id=new_user.user_id,
                    from_location_id=asset.current_location_id,
                    to_location_id=asset.current_location_id,
                    performed_by=current_user.user_id,
                    notes=f"Initial kit handover upon onboarding {new_user.name}"
                )
                db.add(ev)
                assigned_kit_serials.append(asset.serial_number)
        db.commit()

    log_audit(db, "ONBOARD_STAFF", f"{current_user.name} onboarded {new_user.name} ({new_user.role}) with {len(assigned_kit_serials)} kit assets assigned", current_user.user_id, current_user.name, current_user.role)

    return {
        "user_id": new_user.user_id,
        "name": new_user.name,
        "email": new_user.email,
        "role": new_user.role,
        "assigned_assets_count": len(assigned_kit_serials),
        "assigned_serials": assigned_kit_serials,
        "message": f"Successfully onboarded {new_user.name} to Tata Play Fiber."
    }

@router.get("/manager-stock/{manager_id}")
def get_manager_hub_stock(
    manager_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    target_user = db.query(User).filter(User.user_id == manager_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    city = target_user.city_location
    if not city:
        raise HTTPException(status_code=400, detail="User is not assigned to any physical city hub.")

    # Unassigned serialized assets in city warehouse pool
    unassigned_assets = db.query(AssetUnit).filter(
        AssetUnit.current_location_id == city.location_id,
        AssetUnit.current_holder_id == None
    ).all()

    # Active personnel under manager
    team_members = db.query(User).filter(
        User.city_id == city.location_id,
        User.role == RoleEnum.FIELD_WORKER.value,
        User.is_active == 1
    ).all()

    total_value = sum(a.variant.unit_cost for a in unassigned_assets if a.variant)

    # Candidate successors
    candidates = db.query(User).filter(
        User.user_id != manager_id,
        (User.city_id == city.location_id) | (User.role.in_([RoleEnum.MANAGER.value, RoleEnum.REGIONAL_ADMIN.value]))
    ).all()

    # Other regional cities
    other_cities = db.query(Location).filter(Location.location_id != city.location_id).all()

    assets_summary = []
    for a in unassigned_assets:
        v = a.variant
        item = v.item if v else None
        assets_summary.append({
            "asset_id": a.asset_id,
            "serial_number": a.serial_number,
            "item_name": item.name if item else "Equipment",
            "variant_name": v.variant_name if v else "",
            "category": item.category if item else "General",
            "unit_cost": v.unit_cost if v else 0.0,
            "status": a.status
        })

    cands = [{"user_id": u.user_id, "name": u.name, "role": u.role, "email": u.email, "city_name": u.city_location.city if u.city_location else ""} for u in candidates]
    cities_list = [{"location_id": c.location_id, "city_name": c.city, "name": c.city, "region_name": c.region.name if c.region else "Central", "region_id": c.region_id} for c in other_cities]

    return {
        "manager_id": target_user.user_id,
        "manager_name": target_user.name,
        "city_id": city.location_id,
        "city_name": city.city,
        "region_name": city.region.name if city.region else "Central",
        "unassigned_assets_count": len(unassigned_assets),
        "warehouse_asset_count": len(unassigned_assets),
        "total_warehouse_value_inr": total_value,
        "warehouse_valuation_inr": total_value,
        "team_size": len(team_members),
        "team_field_worker_count": len(team_members),
        "assets_in_warehouse": assets_summary,
        "successor_candidates": cands,
        "candidate_successors": cands,
        "available_transfer_cities": cities_list,
        "candidate_cities": cities_list
    }

@router.post("/manager-handover", response_model=ManagerHandoverRecordOut)
def execute_manager_handover(
    payload: ManagerHandoverRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_regional_or_super_admin)
):
    """
    Executes a formal managerial stock transition when a City Hub Manager leaves:
    1. TRANSFER_TO_SUCCESSOR: assigns city stewardship to incoming manager.
    2. EVACUATE_TO_CENTRAL: moves all unassigned city hub stock back to Central Warehouse pool.
    3. TRANSFER_TO_CITY: redistributes unassigned stock to another regional city hub.
    """
    manager = db.query(User).filter(User.user_id == payload.outgoing_manager_id).first()
    if not manager:
        raise HTTPException(status_code=404, detail="Outgoing manager not found.")

    city = manager.city_location
    if not city:
        raise HTTPException(status_code=400, detail="Outgoing manager has no assigned city hub.")

    unassigned_assets = db.query(AssetUnit).filter(
        AssetUnit.current_location_id == city.location_id,
        AssetUnit.current_holder_id == None
    ).all()

    total_value = sum(a.variant.unit_cost for a in unassigned_assets if a.variant)
    target_manager_name = None
    target_city_name = None

    if payload.action_type == "TRANSFER_TO_SUCCESSOR":
        if not payload.target_manager_id:
            raise HTTPException(status_code=400, detail="Target successor manager ID is required.")
        target_m = db.query(User).filter(User.user_id == payload.target_manager_id).first()
        if not target_m:
            raise HTTPException(status_code=404, detail="Successor manager not found.")
        target_m.role = RoleEnum.MANAGER.value
        target_m.city_id = city.location_id
        target_manager_name = target_m.name

        # Log custody stewardship transfer for assets
        for a in unassigned_assets:
            ev = AssetLifecycleEvent(
                asset_id=a.asset_id,
                event_type="TRANSFERRED",
                from_location_id=city.location_id,
                to_location_id=city.location_id,
                performed_by=current_user.user_id,
                notes=f"Managerial Hub Handover: Stewardship transferred from Outgoing Manager {manager.name} to Successor Manager {target_m.name}."
            )
            db.add(ev)

    elif payload.action_type == "EVACUATE_TO_CENTRAL":
        target_city_name = "Central Warehouse (Main Hub)"
        for a in unassigned_assets:
            old_loc = a.current_location_id
            a.current_location_id = None # Central Warehouse pool
            a.status = "IN_WAREHOUSE"
            ev = AssetLifecycleEvent(
                asset_id=a.asset_id,
                event_type="TRANSFERRED",
                from_location_id=old_loc,
                to_location_id=None,
                performed_by=current_user.user_id,
                notes=f"Managerial Stock Evacuation: Transferred from {city.city} Hub to Central Warehouse active pool upon departure of Manager {manager.name}."
            )
            db.add(ev)

    elif payload.action_type == "TRANSFER_TO_CITY":
        if not payload.target_city_id:
            raise HTTPException(status_code=400, detail="Target destination city ID is required.")
        target_c = db.query(Location).filter(Location.location_id == payload.target_city_id).first()
        if not target_c:
            raise HTTPException(status_code=404, detail="Destination city not found.")
        target_city_name = target_c.city
        for a in unassigned_assets:
            old_loc = a.current_location_id
            a.current_location_id = target_c.location_id
            ev = AssetLifecycleEvent(
                asset_id=a.asset_id,
                event_type="TRANSFERRED",
                from_location_id=old_loc,
                to_location_id=target_c.location_id,
                performed_by=current_user.user_id,
                notes=f"Regional Stock Reallocation: Transferred from {city.city} Hub to {target_c.city} Hub upon manager departure."
            )
            db.add(ev)

    # Generate Handover Record
    import uuid
    handover_no = f"TPF-MGR-HO-{datetime.utcnow().strftime('%Y%m%d%H%M')}-{uuid.uuid4().hex[:4].upper()}"
    summary_data = {
        "assets_transferred": len(unassigned_assets),
        "total_value_inr": total_value,
        "action": payload.action_type,
        "origin_city": city.city,
        "timestamp": datetime.utcnow().isoformat()
    }

    record = ManagerHandoverRecord(
        handover_number=handover_no,
        outgoing_manager_id=manager.user_id,
        outgoing_manager_name=manager.name,
        city_id=city.location_id,
        city_name=city.city,
        action_type=payload.action_type,
        target_manager_id=payload.target_manager_id,
        target_manager_name=target_manager_name,
        target_city_id=payload.target_city_id,
        target_city_name=target_city_name,
        transferred_assets_count=len(unassigned_assets),
        transferred_value_inr=total_value,
        transferred_summary_json=json.dumps(summary_data),
        notes=payload.notes or "Official City Warehouse stewardship handover completed.",
        created_at=datetime.utcnow()
    )
    db.add(record)

    manager.clearance_status = "CLEARED_FOR_NOC"
    db.commit()
    db.refresh(record)

    log_audit(db, "MANAGER_HANDOVER", f"{current_user.name} completed managerial stock handover for {manager.name} ({city.city} Hub) - {len(unassigned_assets)} assets", current_user.user_id, current_user.name, current_user.role)

    target_ent = record.target_manager_name or record.target_city_name or ("Central Warehouse" if record.action_type == "EVACUATE_TO_CENTRAL" else "Reallocated")

    return ManagerHandoverRecordOut(
        handover_id=record.handover_id,
        handover_number=record.handover_number,
        outgoing_manager_id=record.outgoing_manager_id,
        outgoing_manager_name=record.outgoing_manager_name,
        city_id=record.city_id,
        city_name=record.city_name,
        action_type=record.action_type,
        target_manager_id=record.target_manager_id,
        target_manager_name=record.target_manager_name,
        target_city_id=record.target_city_id,
        target_city_name=record.target_city_name,
        transferred_assets_count=record.transferred_assets_count,
        transferred_value_inr=record.transferred_value_inr,
        assets_transferred_count=record.transferred_assets_count,
        total_valuation_inr=record.transferred_value_inr,
        target_entity_name=target_ent,
        transferred_summary_json=record.transferred_summary_json,
        notes=record.notes,
        created_at=record.created_at
    )

@router.get("/manager-handovers", response_model=List[ManagerHandoverRecordOut])
def list_manager_handovers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    query = db.query(ManagerHandoverRecord).order_by(ManagerHandoverRecord.created_at.desc()).all()
    return [
        ManagerHandoverRecordOut(
            handover_id=r.handover_id,
            handover_number=r.handover_number,
            outgoing_manager_id=r.outgoing_manager_id,
            outgoing_manager_name=r.outgoing_manager_name,
            city_id=r.city_id,
            city_name=r.city_name,
            action_type=r.action_type,
            target_manager_id=r.target_manager_id,
            target_manager_name=r.target_manager_name,
            target_city_id=r.target_city_id,
            target_city_name=r.target_city_name,
            transferred_assets_count=r.transferred_assets_count,
            transferred_value_inr=r.transferred_value_inr,
            assets_transferred_count=r.transferred_assets_count,
            total_valuation_inr=r.transferred_value_inr,
            target_entity_name=r.target_manager_name or r.target_city_name or ("Central Warehouse" if r.action_type == "EVACUATE_TO_CENTRAL" else "Reallocated"),
            transferred_summary_json=r.transferred_summary_json,
            notes=r.notes,
            created_at=r.created_at
        ) for r in query
    ]

def _build_clearance_check(target_user: User, db: Session) -> ClearanceCheckResponse:
    assigned_assets = db.query(AssetUnit).filter(
        AssetUnit.current_holder_id == target_user.user_id
    ).all()

    can_issue = len(assigned_assets) == 0
    reasons = []
    if len(assigned_assets) > 0:
        reasons.append(f"Holding {len(assigned_assets)} active assigned electronic/serialized device(s).")

    # If manager, check city warehouse stock stewardship
    if target_user.role == RoleEnum.MANAGER.value and target_user.city_id:
        city = target_user.city_location
        unassigned_in_city = db.query(AssetUnit).filter(
            AssetUnit.current_location_id == target_user.city_id,
            AssetUnit.current_holder_id == None
        ).count()
        if unassigned_in_city > 0 and target_user.clearance_status != "CLEARED_FOR_NOC":
            reasons.append(f"Manager holds stewardship over {unassigned_in_city} unassigned warehouse asset(s) in {city.city if city else 'City'} Hub. Managerial Stock Handover must be executed.")
            can_issue = False

    city = target_user.city_location
    reg = target_user.region or (city.region if city else None)

    assets_out = []
    for a in assigned_assets:
        v = a.variant
        item = v.item if v else None
        assets_out.append(AssetUnitOut(
            asset_id=a.asset_id,
            variant_id=a.variant_id,
            serial_number=a.serial_number,
            status=a.status,
            current_holder_id=a.current_holder_id,
            current_holder_name=target_user.name,
            current_location_id=a.current_location_id,
            current_location_name=city.city if city else None,
            created_at=a.created_at,
            variant_name=v.variant_name if v else None,
            item_name=item.name if item else None,
            category=item.category if item else None,
            description=item.description if item else None,
            unit_cost=v.unit_cost if v else 0.0,
            image_url=item.image_url if item else None
        ))

    return ClearanceCheckResponse(
        user_id=target_user.user_id,
        user_name=target_user.name,
        user_role=target_user.role,
        city_name=city.city if city else None,
        region_name=reg.name if reg else None,
        is_leaving=target_user.is_leaving or False,
        clearance_status=target_user.clearance_status or "ACTIVE",
        can_issue_noc=can_issue,
        assigned_assets=assets_out,
        blocking_reasons=reasons
    )

def _build_noc_out(noc: NOCRecord) -> NOCRecordOut:
    return NOCRecordOut(
        noc_id=noc.noc_id,
        noc_number=noc.noc_number,
        user_id=noc.user_id,
        user_name=noc.user_name,
        user_role=noc.user_role,
        city_name=noc.city_name,
        region_name=noc.region_name,
        issued_by_id=noc.issued_by_id,
        issued_by_name=noc.issued_by_name,
        cleared_at=noc.cleared_at,
        cleared_assets_summary=noc.cleared_assets_summary,
        remarks=noc.remarks
    )

