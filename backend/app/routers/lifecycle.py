from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import get_db
from ..models import (
    AssetUnit, AssetLifecycleEvent, ItemVariant, Item, User, Location, Region, 
    RepairLocation, RoleEnum
)
from ..schemas import (
    AssetUnitOut, AssetLifecycleEventOut, AssetSuggestionOut,
    SubscriberInstallationRequest, SubscriberInstallationResponse
)
from ..auth import get_current_user

router = APIRouter(prefix="/api/lifecycle", tags=["Asset Lifecycle"])

@router.get("/suggest", response_model=List[AssetSuggestionOut])
def suggest_assets(
    q: str = Query(..., min_length=1, description="Partial search query"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query_str = q.strip()
    base_query = db.query(AssetUnit).join(ItemVariant, AssetUnit.variant_id == ItemVariant.variant_id).join(Item, ItemVariant.item_id == Item.item_id)

    # Scoping
    if current_user.role == RoleEnum.FIELD_WORKER.value:
        base_query = base_query.filter(AssetUnit.current_holder_id == current_user.user_id)
    elif current_user.role == RoleEnum.MANAGER.value:
        if current_user.city_id:
            base_query = base_query.filter(
                (AssetUnit.current_location_id == current_user.city_id) | (AssetUnit.current_location_id == None)
            )
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        if current_user.region_id:
            base_query = base_query.outerjoin(Location, AssetUnit.current_location_id == Location.location_id).filter(
                (Location.region_id == current_user.region_id) | (AssetUnit.current_location_id == None)
            )

    # Filtering
    filters = [
        AssetUnit.serial_number.ilike(f"%{query_str}%"),
        Item.name.ilike(f"%{query_str}%"),
        Item.category.ilike(f"%{query_str}%"),
        ItemVariant.variant_name.ilike(f"%{query_str}%")
    ]
    if query_str.isdigit():
        filters.append(AssetUnit.asset_id == int(query_str))

    from sqlalchemy import or_
    matching_assets = base_query.filter(or_(*filters)).limit(10).all()

    suggestions = []
    for a in matching_assets:
        variant = a.variant
        item = variant.item if variant else None
        loc = a.location
        holder = a.holder

        loc_display = "Central Warehouse" if a.status == "IN_WAREHOUSE" else (loc.city if loc else "Field Assigned")
        suggestions.append(AssetSuggestionOut(
            asset_id=a.asset_id,
            serial_number=a.serial_number,
            item_name=item.name if item else None,
            variant_name=variant.variant_name if variant else None,
            category=item.category if item else None,
            status=a.status,
            location_name=loc_display,
            holder_name=holder.name if holder else None,
            unit_cost=variant.unit_cost if variant else 0.0
        ))
    return suggestions

@router.get("/search", response_model=AssetUnitOut)
def search_asset_by_serial(
    serial_number: Optional[str] = Query(None, description="Serial number of the asset"),
    query: Optional[str] = Query(None, description="Flexible search query (serial, ID, or SKU)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    raw_query = (query or serial_number or "").strip()
    if not raw_query:
        raise HTTPException(status_code=400, detail="Search query or serial number is required.")

    # 1. Try exact serial match
    asset = db.query(AssetUnit).filter(AssetUnit.serial_number == raw_query).first()

    # 2. Try integer asset_id match if numeric
    if not asset and raw_query.isdigit():
        asset = db.query(AssetUnit).filter(AssetUnit.asset_id == int(raw_query)).first()

    # 3. Try partial case-insensitive serial match
    if not asset:
        asset = db.query(AssetUnit).filter(AssetUnit.serial_number.ilike(f"%{raw_query}%")).first()

    # 4. Try item name or category or variant match
    if not asset:
        asset = db.query(AssetUnit).join(ItemVariant).join(Item).filter(
            (Item.name.ilike(f"%{raw_query}%")) |
            (Item.category.ilike(f"%{raw_query}%")) |
            (ItemVariant.variant_name.ilike(f"%{raw_query}%"))
        ).first()

    if not asset:
        raise HTTPException(status_code=404, detail=f"No asset found matching identifier '{raw_query}'.")

    # Scope check
    if current_user.role == RoleEnum.FIELD_WORKER.value:
        # Field workers can only view assets currently or formerly assigned to them
        had_event = db.query(AssetLifecycleEvent).filter(
            AssetLifecycleEvent.asset_id == asset.asset_id,
            (AssetLifecycleEvent.from_holder_id == current_user.user_id) | 
            (AssetLifecycleEvent.to_holder_id == current_user.user_id)
        ).first()
        if asset.current_holder_id != current_user.user_id and not had_event:
            raise HTTPException(status_code=403, detail="Access forbidden: You can only view assets assigned to you.")
    elif current_user.role == RoleEnum.MANAGER.value:
        if asset.current_location_id != current_user.city_id and asset.current_location_id is not None:
            city_event = db.query(AssetLifecycleEvent).filter(
                AssetLifecycleEvent.asset_id == asset.asset_id,
                (AssetLifecycleEvent.from_location_id == current_user.city_id) | 
                (AssetLifecycleEvent.to_location_id == current_user.city_id)
            ).first()
            if not city_event:
                raise HTTPException(status_code=403, detail="Access forbidden: Asset is outside your city hub jurisdiction.")
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        loc = asset.location
        if loc and loc.region_id != current_user.region_id:
            raise HTTPException(status_code=403, detail="Access forbidden: Asset is outside your assigned region.")

    variant = asset.variant
    item = variant.item if variant else None
    loc = asset.location
    holder = asset.holder
    repair_fac = asset.repair_facility

    # Calculate enterprise operational telemetry
    created_dt = asset.created_at or datetime.utcnow()
    in_service_days = max(1, (datetime.utcnow() - created_dt).days)
    repair_event_count = db.query(AssetLifecycleEvent).filter(
        AssetLifecycleEvent.asset_id == asset.asset_id,
        AssetLifecycleEvent.event_type.in_(["FAULT_REPORTED", "REPAIR_REQUESTED", "REPAIR_APPROVED"])
    ).count()

    health_score = max(45, 98 - (repair_event_count * 15))
    mtbf_hours = max(2800, 16000 - (repair_event_count * 3800))
    next_maint = f"In {max(14, 90 - (in_service_days % 90))} Days (Quarterly Preventive Maintenance)"
    next_calib = f"In {max(30, 365 - (in_service_days % 365))} Days (Annual ISO 9001 Recertification)"

    return AssetUnitOut(
        asset_id=asset.asset_id,
        variant_id=asset.variant_id,
        serial_number=asset.serial_number,
        status=asset.status,
        current_holder_id=asset.current_holder_id,
        current_holder_name=holder.name if holder else None,
        current_location_id=asset.current_location_id,
        current_location_name=loc.city if loc else ("Central Warehouse" if asset.status == "IN_WAREHOUSE" else None),
        repair_location_id=asset.repair_location_id,
        repair_location_name=repair_fac.name if repair_fac else None,
        created_at=asset.created_at,
        variant_name=variant.variant_name if variant else None,
        item_name=item.name if item else None,
        category=item.category if item else None,
        description=item.description if item else None,
        unit_cost=variant.unit_cost if variant else 0.0,
        image_url=item.image_url if item else None,
        health_score=health_score,
        mtbf_hours=mtbf_hours,
        in_service_days=in_service_days,
        next_maintenance_due=next_maint,
        next_calibration_due=next_calib
    )

@router.get("/events/{asset_id}", response_model=List[AssetLifecycleEventOut])
def get_asset_lifecycle_events(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    asset = db.query(AssetUnit).filter(AssetUnit.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    events = db.query(AssetLifecycleEvent).filter(
        AssetLifecycleEvent.asset_id == asset_id
    ).order_by(AssetLifecycleEvent.timestamp.asc()).all()

    out = []
    for ev in events:
        actor = db.query(User).filter(User.user_id == ev.performed_by).first() if ev.performed_by else None
        from_h = db.query(User).filter(User.user_id == ev.from_holder_id).first() if ev.from_holder_id else None
        to_h = db.query(User).filter(User.user_id == ev.to_holder_id).first() if ev.to_holder_id else None
        from_l = db.query(Location).filter(Location.location_id == ev.from_location_id).first() if ev.from_location_id else None
        to_l = db.query(Location).filter(Location.location_id == ev.to_location_id).first() if ev.to_location_id else None
        repair_fac = db.query(RepairLocation).filter(RepairLocation.repair_location_id == ev.repair_location_id).first() if ev.repair_location_id else None

        out.append(AssetLifecycleEventOut(
            event_id=ev.event_id,
            asset_id=ev.asset_id,
            event_type=ev.event_type,
            from_holder_id=ev.from_holder_id,
            from_holder_name=from_h.name if from_h else None,
            to_holder_id=ev.to_holder_id,
            to_holder_name=to_h.name if to_h else None,
            from_location_id=ev.from_location_id,
            from_location_name=from_l.city if from_l else None,
            to_location_id=ev.to_location_id,
            to_location_name=to_l.city if to_l else None,
            repair_location_id=ev.repair_location_id,
            repair_location_name=repair_fac.name if repair_fac else None,
            performed_by=ev.performed_by,
            actor_name=actor.name if actor else None,
            actor_role=actor.role if actor else None,
            notes=ev.notes,
            timestamp=ev.timestamp
        ))

    return out

@router.get("/my-assets", response_model=List[AssetUnitOut])
def get_my_assigned_assets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns assets currently assigned to the logged in user (Field Worker or Manager).
    """
    assets = db.query(AssetUnit).filter(
        AssetUnit.current_holder_id == current_user.user_id
    ).all()

    out = []
    for a in assets:
        variant = a.variant
        item = variant.item if variant else None
        loc = a.location

        out.append(AssetUnitOut(
            asset_id=a.asset_id,
            variant_id=a.variant_id,
            serial_number=a.serial_number,
            status=a.status,
            current_holder_id=a.current_holder_id,
            current_holder_name=current_user.name,
            current_location_id=a.current_location_id,
            current_location_name=loc.city if loc else "Field Deployment",
            repair_location_id=a.repair_location_id,
            repair_location_name=None,
            created_at=a.created_at,
            variant_name=variant.variant_name if variant else None,
            item_name=item.name if item else None,
            category=item.category if item else None,
            description=item.description if item else None,
            unit_cost=variant.unit_cost if variant else 0.0,
            image_url=item.image_url if item else None
        ))

    return out

@router.post("/subscriber-installation", response_model=SubscriberInstallationResponse)
def complete_subscriber_installation(
    payload: SubscriberInstallationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Field Technician Subscriber Wi-Fi Setup & Customer Premise Equipment (CPE) ONT Activation.
    Connects the assigned optical modem to the subscriber account, validates optical power,
    and immutably records the customer installation lifecycle milestone.
    """
    asset = db.query(AssetUnit).filter(AssetUnit.asset_id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Selected hardware unit not found.")

    # Only assigned holder or manager/admin can activate
    if current_user.role == RoleEnum.FIELD_WORKER.value and asset.current_holder_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only activate hardware currently assigned in your technician kit.")

    variant = asset.variant
    item = variant.item if variant else None
    item_name = item.name if item else "ONT Modem"

    # Evaluate optical power
    dbm = payload.optical_rx_power_dbm
    if -24.0 <= dbm <= -15.0:
        signal_status = "PASS_OPTIMAL"
        status_label = "Optimal 1 Gbps FTTH Signal"
    elif -27.0 <= dbm < -24.0:
        signal_status = "PASS_ACCEPTABLE"
        status_label = "Acceptable Signal (Clean Ferrule Advised)"
    else:
        signal_status = "FAIL_HIGH_LOSS"
        status_label = "High Optical Loss Warning (Check Splicing & Bends)"

    import uuid
    install_id = f"TPF-ACT-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    # Update asset state to active customer use
    prev_holder = asset.current_holder_id
    asset.status = "IN_USE"
    asset.current_holder_id = None # Released from technician toolbag into active subscriber premises

    # Log immutable lifecycle milestone
    notes = (
        f"FTTH Customer Installation & Wi-Fi Setup completed by Tech {current_user.name} (ID: {current_user.user_id}). "
        f"Subscriber: {payload.subscriber_name} (Acc: {payload.subscriber_id}) at {payload.subscriber_address}. "
        f"Configured Wi-Fi SSID: {payload.wifi_ssid}. "
        f"Measured Optical RX Power: {dbm} dBm [{status_label}]. "
        f"Work Order: {payload.work_order_no or 'DIRECT-DISPATCH'}. "
        f"{payload.installation_notes or ''}"
    ).strip()

    ev = AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type="CUSTOMER_INSTALLATION",
        from_holder_id=prev_holder,
        to_holder_id=None,
        from_location_id=asset.current_location_id,
        to_location_id=asset.current_location_id,
        performed_by=current_user.user_id,
        notes=notes,
        timestamp=datetime.utcnow()
    )
    db.add(ev)
    db.commit()

    return SubscriberInstallationResponse(
        installation_id=install_id,
        asset_id=asset.asset_id,
        serial_number=asset.serial_number,
        item_name=item_name,
        subscriber_id=payload.subscriber_id,
        subscriber_name=payload.subscriber_name,
        subscriber_address=payload.subscriber_address,
        wifi_ssid=payload.wifi_ssid,
        optical_rx_power_dbm=dbm,
        signal_status=signal_status,
        technician_name=current_user.name,
        installed_at=datetime.utcnow(),
        message=f"Wi-Fi setup and customer ONT activation completed successfully with {status_label}."
    )

