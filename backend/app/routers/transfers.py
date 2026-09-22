from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import get_db
from ..models import (
    AssetTransfer, AssetUnit, AssetLifecycleEvent, User, Location, 
    AssetStatusEnum, RoleEnum
)
from ..schemas import (
    AssetTransferCreateSameCity, AssetTransferCreateCrossCity, AssetTransferOut
)
from ..auth import get_current_user, require_manager_or_above

router = APIRouter(prefix="/api/transfers", tags=["Asset Transfers"])

@router.post("/same-city", response_model=AssetTransferOut)
def transfer_asset_same_city(
    payload: AssetTransferCreateSameCity,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    asset = db.query(AssetUnit).filter(AssetUnit.asset_id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    to_user = db.query(User).filter(User.user_id == payload.to_user_id).first()
    if not to_user:
        raise HTTPException(status_code=404, detail="Target recipient user not found.")

    city_id = asset.current_location_id or current_user.city_id or to_user.city_id or 1
    old_holder_id = asset.current_holder_id
    from_user = db.query(User).filter(User.user_id == old_holder_id).first() if old_holder_id else None

    # Immediate assignment
    asset.current_holder_id = payload.to_user_id
    asset.current_location_id = city_id
    asset.status = AssetStatusEnum.ASSIGNED.value

    transfer = AssetTransfer(
        asset_id=asset.asset_id,
        from_user_id=old_holder_id,
        to_user_id=payload.to_user_id,
        from_city_id=city_id,
        to_city_id=city_id,
        transfer_type="SAME_CITY",
        status="COMPLETED",
        initiated_by=current_user.user_id,
        accepted_by=current_user.user_id,
        notes=payload.notes,
        created_at=datetime.utcnow(),
        completed_at=datetime.utcnow()
    )
    db.add(transfer)

    # Log lifecycle event
    event = AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type="TRANSFERRED",
        from_holder_id=old_holder_id,
        to_holder_id=payload.to_user_id,
        from_location_id=city_id,
        to_location_id=city_id,
        performed_by=current_user.user_id,
        notes=f"Same-city transfer from {from_user.name if from_user else 'Hub'} to {to_user.name}. {payload.notes or ''}",
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(transfer)

    return _build_transfer_out(transfer, db)

@router.post("/cross-city", response_model=AssetTransferOut)
def transfer_asset_cross_city(
    payload: AssetTransferCreateCrossCity,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    asset = db.query(AssetUnit).filter(AssetUnit.asset_id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    from_city_id = asset.current_location_id or current_user.city_id or 1
    old_holder_id = asset.current_holder_id

    # Mark asset in dispatch transit
    asset.status = AssetStatusEnum.DISPATCHED.value

    transfer = AssetTransfer(
        asset_id=asset.asset_id,
        from_user_id=old_holder_id,
        to_user_id=payload.to_user_id or current_user.user_id, # Target recipient in destination city
        from_city_id=from_city_id,
        to_city_id=payload.to_city_id,
        transfer_type="CROSS_CITY",
        status="PENDING_ACCEPTANCE",
        initiated_by=current_user.user_id,
        notes=payload.notes,
        created_at=datetime.utcnow()
    )
    db.add(transfer)

    event = AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type="TRANSFERRED",
        from_holder_id=old_holder_id,
        from_location_id=from_city_id,
        to_location_id=payload.to_city_id,
        performed_by=current_user.user_id,
        notes=f"Cross-city transfer dispatched to City #{payload.to_city_id}. Awaiting destination manager acceptance.",
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(transfer)

    return _build_transfer_out(transfer, db)

@router.get("", response_model=List[AssetTransferOut])
def list_transfers(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(AssetTransfer)
    if current_user.role == RoleEnum.MANAGER.value:
        query = query.filter(
            (AssetTransfer.from_city_id == current_user.city_id) | 
            (AssetTransfer.to_city_id == current_user.city_id)
        )
    elif current_user.role == RoleEnum.FIELD_WORKER.value:
        query = query.filter(
            (AssetTransfer.from_user_id == current_user.user_id) | 
            (AssetTransfer.to_user_id == current_user.user_id)
        )

    if status and status != 'ALL':
        query = query.filter(AssetTransfer.status == status)

    transfers = query.order_by(AssetTransfer.created_at.desc()).all()
    return [_build_transfer_out(t, db) for t in transfers]

@router.put("/{transfer_id}/accept", response_model=AssetTransferOut)
def accept_cross_city_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    transfer = db.query(AssetTransfer).filter(AssetTransfer.transfer_id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer record not found.")

    if current_user.role == RoleEnum.MANAGER.value and transfer.to_city_id != current_user.city_id:
        raise HTTPException(status_code=403, detail="Access forbidden: You can only accept transfers destined for your city hub.")

    asset = transfer.asset
    asset.current_location_id = transfer.to_city_id
    asset.current_holder_id = transfer.to_user_id
    asset.status = AssetStatusEnum.ASSIGNED.value

    transfer.status = "COMPLETED"
    transfer.accepted_by = current_user.user_id
    transfer.completed_at = datetime.utcnow()

    event = AssetLifecycleEvent(
        asset_id=asset.asset_id,
        event_type="ASSIGNED",
        to_holder_id=transfer.to_user_id,
        to_location_id=transfer.to_city_id,
        performed_by=current_user.user_id,
        notes=f"Cross-city transfer accepted by destination manager {current_user.name}.",
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(transfer)

    return _build_transfer_out(transfer, db)

@router.put("/{transfer_id}/reject", response_model=AssetTransferOut)
def reject_cross_city_transfer(
    transfer_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above)
):
    transfer = db.query(AssetTransfer).filter(AssetTransfer.transfer_id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer record not found.")

    if current_user.role == RoleEnum.MANAGER.value and transfer.to_city_id != current_user.city_id:
        raise HTTPException(status_code=403, detail="Access forbidden: You can only reject transfers destined for your city hub.")

    # Revert asset back to origin city
    asset = transfer.asset
    asset.current_location_id = transfer.from_city_id
    asset.current_holder_id = transfer.from_user_id
    asset.status = AssetStatusEnum.ASSIGNED.value if transfer.from_user_id else AssetStatusEnum.IN_WAREHOUSE.value

    transfer.status = "REJECTED"
    transfer.accepted_by = current_user.user_id
    transfer.notes = notes or transfer.notes
    transfer.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(transfer)
    return _build_transfer_out(transfer, db)

def _build_transfer_out(t: AssetTransfer, db: Session) -> AssetTransferOut:
    asset = t.asset
    variant = asset.variant if asset else None
    item = variant.item if variant else None
    from_u = t.from_user
    to_u = t.to_user
    from_c = t.from_city
    to_c = t.to_city
    init_u = t.initiator
    accept_u = t.acceptor

    return AssetTransferOut(
        transfer_id=t.transfer_id,
        asset_id=t.asset_id,
        serial_number=asset.serial_number if asset else None,
        item_name=item.name if item else None,
        variant_name=variant.variant_name if variant else None,
        from_user_id=t.from_user_id,
        from_user_name=from_u.name if from_u else None,
        to_user_id=t.to_user_id,
        to_user_name=to_u.name if to_u else None,
        from_city_id=t.from_city_id,
        from_city_name=from_c.city if from_c else None,
        to_city_id=t.to_city_id,
        to_city_name=to_c.city if to_c else None,
        transfer_type=t.transfer_type,
        status=t.status,
        initiated_by=t.initiated_by,
        initiator_name=init_u.name if init_u else None,
        accepted_by=t.accepted_by,
        acceptor_name=accept_u.name if accept_u else None,
        notes=t.notes,
        created_at=t.created_at,
        completed_at=t.completed_at
    )
