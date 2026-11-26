from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from ..database import get_db
from ..models import (
    CommunicationMessage, User, RoleEnum, Location, Region
)
from ..schemas import (
    CommunicationMessageCreate,
    CommunicationMessageOut,
    CommunicationContactOut,
    CommunicationChannelOut
)
from ..auth import get_current_user
from ..websocket_manager import ws_manager
from ..audit import log_audit

router = APIRouter(prefix="/api/communications", tags=["Unified Comms Center"])


def _format_message_out(msg: CommunicationMessage, db: Session) -> CommunicationMessageOut:
    sender = db.query(User).filter(User.user_id == msg.sender_id).first()
    recipient = db.query(User).filter(User.user_id == msg.recipient_id).first() if msg.recipient_id else None
    region = db.query(Region).filter(Region.region_id == msg.target_region_id).first() if msg.target_region_id else None
    city = db.query(Location).filter(Location.location_id == msg.target_city_id).first() if msg.target_city_id else None

    return CommunicationMessageOut(
        message_id=msg.message_id,
        sender_id=msg.sender_id,
        sender_name=sender.name if sender else "Unknown",
        sender_role=sender.role if sender else "STAFF",
        recipient_id=msg.recipient_id,
        recipient_name=recipient.name if recipient else None,
        recipient_role=recipient.role if recipient else None,
        channel_type=msg.channel_type,
        target_region_id=msg.target_region_id,
        target_region_name=region.name if region else None,
        target_city_id=msg.target_city_id,
        target_city_name=city.name if city else None,
        subject=msg.subject,
        content=msg.content,
        priority=msg.priority,
        is_read=msg.is_read,
        read_at=msg.read_at,
        created_at=msg.created_at
    )


@router.get("/contacts", response_model=List[CommunicationContactOut])
def get_authorized_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns authorized contacts based on organization hierarchy rules:
    - Super Admin: sees all active personnel across all tiers.
    - Regional Admin: sees Super Admins, fellow Regional Admins, and Managers/Techs in their region.
    - Hub Manager: sees Super Admins, their Regional Admin, peer Hub Managers, and Techs in their hub.
    - Field Worker: sees their Hub Manager, Hub peer technicians, and corporate leadership for escalations.
    """
    user_role = current_user.role
    user_city_id = current_user.city_id
    user_region_id = current_user.region_id

    # If user has a city_id but no region_id, resolve region_id from city
    if not user_region_id and user_city_id:
        loc = db.query(Location).filter(Location.location_id == user_city_id).first()
        if loc and loc.region_id:
            user_region_id = loc.region_id

    # Base query for active users (excluding current user)
    query = db.query(User).filter(User.user_id != current_user.user_id, User.is_active == 1)

    contacts_raw: List[User] = []

    if user_role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        # Super Admin sees all active personnel
        contacts_raw = query.all()

    elif user_role == RoleEnum.REGIONAL_ADMIN.value:
        # Regional Admin sees:
        # 1. Super Admins
        # 2. Other Regional Admins
        # 3. Managers & Workers in their region
        cities_in_region = [c.location_id for c in db.query(Location).filter(Location.region_id == user_region_id).all()]
        contacts_raw = query.filter(
            or_(
                User.role.in_([RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN", RoleEnum.REGIONAL_ADMIN.value]),
                User.region_id == user_region_id,
                User.city_id.in_(cities_in_region)
            )
        ).all()

    elif user_role == RoleEnum.MANAGER.value:
        # Manager sees:
        # 1. Super Admins
        # 2. Regional Admin of their region
        # 3. Other Managers
        # 4. Field workers in their city hub (and assigned territories)
        territory_city_ids = current_user.territory_ids or ([user_city_id] if user_city_id else [])
        contacts_raw = query.filter(
            or_(
                User.role.in_([RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN", RoleEnum.MANAGER.value]),
                and_(User.role == RoleEnum.REGIONAL_ADMIN.value, User.region_id == user_region_id),
                and_(User.role == RoleEnum.FIELD_WORKER.value, User.city_id.in_(territory_city_ids))
            )
        ).all()

    else:
        # FIELD_WORKER sees:
        # 1. Their City Hub Manager
        # 2. Peer Field Workers in their city hub
        # 3. Regional Admin of their hub's region (for operational escalations)
        # 4. Super Admin (for compliance escalations)
        contacts_raw = query.filter(
            or_(
                and_(User.city_id == user_city_id, User.role.in_([RoleEnum.MANAGER.value, RoleEnum.FIELD_WORKER.value])),
                and_(User.role == RoleEnum.REGIONAL_ADMIN.value, User.region_id == user_region_id),
                User.role.in_([RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"])
            )
        ).all()

    # Build output with hierarchy relationship and unread count
    result = []
    for u in contacts_raw:
        # Resolve contact's region & city names
        c_city = db.query(Location).filter(Location.location_id == u.city_id).first() if u.city_id else None
        c_region = None
        if u.region_id:
            c_region = db.query(Region).filter(Region.region_id == u.region_id).first()
        elif c_city and c_city.region_id:
            c_region = db.query(Region).filter(Region.region_id == c_city.region_id).first()

        # Count unread direct messages from this contact to current user
        unread_count = db.query(CommunicationMessage).filter(
            CommunicationMessage.sender_id == u.user_id,
            CommunicationMessage.recipient_id == current_user.user_id,
            CommunicationMessage.channel_type == "DIRECT",
            CommunicationMessage.is_read == False
        ).count()

        # Determine hierarchy label
        relation = "Colleague"
        if u.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
            relation = "Central Authority / Executive"
        elif u.role == RoleEnum.REGIONAL_ADMIN.value:
            relation = "Regional Admin Overseer" if u.region_id == user_region_id else "Regional Admin (Other Circle)"
        elif u.role == RoleEnum.MANAGER.value:
            if user_role == RoleEnum.FIELD_WORKER.value and u.city_id == user_city_id:
                relation = "Direct Reporting Manager"
            elif user_role == RoleEnum.REGIONAL_ADMIN.value:
                relation = "Hub Manager (Under Regional Jurisdiction)"
            else:
                relation = "City Hub Manager"
        elif u.role == RoleEnum.FIELD_WORKER.value:
            if user_role == RoleEnum.MANAGER.value and u.city_id in (current_user.territory_ids or [user_city_id]):
                relation = "Field Technician (Direct Report)"
            elif user_role == RoleEnum.FIELD_WORKER.value:
                relation = "Peer Field Technician"
            else:
                relation = "Field Operations Tech"

        result.append(CommunicationContactOut(
            user_id=u.user_id,
            name=u.name,
            email=u.email,
            role=u.role,
            region_id=u.region_id or (c_city.region_id if c_city else None),
            region_name=c_region.name if c_region else None,
            city_id=u.city_id,
            city_name=c_city.name if c_city else None,
            unread_count=unread_count,
            hierarchy_relation=relation
        ))

    return result


@router.get("/channels", response_model=List[CommunicationChannelOut])
def get_authorized_channels(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns available operational broadcast channels based on user hierarchy:
    - Nationwide Directives: Readable by all, postable only by Super Admin
    - Regional Directives: Accessible for user's assigned region
    - Hub Dispatch Memo: Accessible for user's assigned city hub
    """
    user_role = current_user.role
    user_city_id = current_user.city_id
    user_region_id = current_user.region_id

    # Resolve user's region from city if necessary
    user_city = db.query(Location).filter(Location.location_id == user_city_id).first() if user_city_id else None
    if not user_region_id and user_city and user_city.region_id:
        user_region_id = user_city.region_id

    channels = []

    # 1. Nationwide Directives (Global)
    last_nw = db.query(CommunicationMessage).filter(
        CommunicationMessage.channel_type == "BROADCAST_NATIONWIDE"
    ).order_by(desc(CommunicationMessage.created_at)).first()

    nw_unread = db.query(CommunicationMessage).filter(
        CommunicationMessage.channel_type == "BROADCAST_NATIONWIDE",
        CommunicationMessage.sender_id != current_user.user_id,
        CommunicationMessage.is_read == False
    ).count()

    channels.append(CommunicationChannelOut(
        channel_id="nationwide",
        channel_type="BROADCAST_NATIONWIDE",
        name="📢 Nationwide Directives",
        description="Official executive bulletins, standard operating procedures, and nationwide alerts from Central Operations.",
        target_region_id=None,
        target_city_id=None,
        can_post=user_role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"],
        unread_count=nw_unread,
        last_message={
            "subject": last_nw.subject,
            "content": last_nw.content[:100] + "..." if len(last_nw.content) > 100 else last_nw.content,
            "created_at": last_nw.created_at.isoformat(),
            "priority": last_nw.priority
        } if last_nw else None
    ))

    # 2. Regional Directive Channel
    target_regions = []
    if user_role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        target_regions = db.query(Region).all()
    elif user_region_id:
        r = db.query(Region).filter(Region.region_id == user_region_id).first()
        if r:
            target_regions = [r]

    for reg in target_regions:
        last_reg_msg = db.query(CommunicationMessage).filter(
            CommunicationMessage.channel_type == "BROADCAST_REGION",
            CommunicationMessage.target_region_id == reg.region_id
        ).order_by(desc(CommunicationMessage.created_at)).first()

        reg_unread = db.query(CommunicationMessage).filter(
            CommunicationMessage.channel_type == "BROADCAST_REGION",
            CommunicationMessage.target_region_id == reg.region_id,
            CommunicationMessage.sender_id != current_user.user_id,
            CommunicationMessage.is_read == False
        ).count()

        channels.append(CommunicationChannelOut(
            channel_id=f"region_{reg.region_id}",
            channel_type="BROADCAST_REGION",
            name=f"🌐 {reg.name} Directive",
            description=f"Regional operational memos, circle inventory balances, and field protocols for {reg.name}.",
            target_region_id=reg.region_id,
            target_city_id=None,
            can_post=user_role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"] or (user_role == RoleEnum.REGIONAL_ADMIN.value and current_user.region_id == reg.region_id),
            unread_count=reg_unread,
            last_message={
                "subject": last_reg_msg.subject,
                "content": last_reg_msg.content[:100] + "..." if len(last_reg_msg.content) > 100 else last_reg_msg.content,
                "created_at": last_reg_msg.created_at.isoformat(),
                "priority": last_reg_msg.priority
            } if last_reg_msg else None
        ))

    # 3. City Hub Dispatch Channel
    target_cities = []
    if user_role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        target_cities = db.query(Location).limit(5).all()
    elif user_role == RoleEnum.REGIONAL_ADMIN.value and user_region_id:
        target_cities = db.query(Location).filter(Location.region_id == user_region_id).all()
    elif user_city:
        target_cities = [user_city]

    for city_loc in target_cities:
        last_city_msg = db.query(CommunicationMessage).filter(
            CommunicationMessage.channel_type == "BROADCAST_CITY",
            CommunicationMessage.target_city_id == city_loc.location_id
        ).order_by(desc(CommunicationMessage.created_at)).first()

        city_unread = db.query(CommunicationMessage).filter(
            CommunicationMessage.channel_type == "BROADCAST_CITY",
            CommunicationMessage.target_city_id == city_loc.location_id,
            CommunicationMessage.sender_id != current_user.user_id,
            CommunicationMessage.is_read == False
        ).count()

        channels.append(CommunicationChannelOut(
            channel_id=f"city_{city_loc.location_id}",
            channel_type="BROADCAST_CITY",
            name=f"🏙️ {city_loc.name} Dispatch",
            description=f"Daily shift dispatches, priority splice tasks, and local stock memos for {city_loc.city}.",
            target_region_id=city_loc.region_id,
            target_city_id=city_loc.location_id,
            can_post=user_role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"] or 
                     (user_role == RoleEnum.REGIONAL_ADMIN.value and current_user.region_id == city_loc.region_id) or
                     (user_role == RoleEnum.MANAGER.value and (current_user.city_id == city_loc.location_id or city_loc.location_id in (current_user.territory_ids or []))),
            unread_count=city_unread,
            last_message={
                "subject": last_city_msg.subject,
                "content": last_city_msg.content[:100] + "..." if len(last_city_msg.content) > 100 else last_city_msg.content,
                "created_at": last_city_msg.created_at.isoformat(),
                "priority": last_city_msg.priority
            } if last_city_msg else None
        ))

    return channels


@router.get("/messages", response_model=List[CommunicationMessageOut])
def get_messages(
    channel_type: str = Query("DIRECT"), # DIRECT, BROADCAST_NATIONWIDE, BROADCAST_REGION, BROADCAST_CITY
    recipient_id: Optional[int] = Query(None),
    target_region_id: Optional[int] = Query(None),
    target_city_id: Optional[int] = Query(None),
    limit: int = Query(60),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves messages for a direct conversation or a broadcast channel.
    """
    if channel_type == "DIRECT":
        if not recipient_id:
            raise HTTPException(status_code=400, detail="recipient_id required for DIRECT communication.")
        
        # Messages between current user and recipient
        messages = db.query(CommunicationMessage).filter(
            CommunicationMessage.channel_type == "DIRECT",
            or_(
                and_(CommunicationMessage.sender_id == current_user.user_id, CommunicationMessage.recipient_id == recipient_id),
                and_(CommunicationMessage.sender_id == recipient_id, CommunicationMessage.recipient_id == current_user.user_id)
            )
        ).order_by(CommunicationMessage.created_at.asc()).limit(limit).all()

    elif channel_type == "BROADCAST_NATIONWIDE":
        messages = db.query(CommunicationMessage).filter(
            CommunicationMessage.channel_type == "BROADCAST_NATIONWIDE"
        ).order_by(CommunicationMessage.created_at.asc()).limit(limit).all()

    elif channel_type == "BROADCAST_REGION":
        if not target_region_id:
            raise HTTPException(status_code=400, detail="target_region_id required for BROADCAST_REGION.")
        messages = db.query(CommunicationMessage).filter(
            CommunicationMessage.channel_type == "BROADCAST_REGION",
            CommunicationMessage.target_region_id == target_region_id
        ).order_by(CommunicationMessage.created_at.asc()).limit(limit).all()

    elif channel_type == "BROADCAST_CITY":
        if not target_city_id:
            raise HTTPException(status_code=400, detail="target_city_id required for BROADCAST_CITY.")
        messages = db.query(CommunicationMessage).filter(
            CommunicationMessage.channel_type == "BROADCAST_CITY",
            CommunicationMessage.target_city_id == target_city_id
        ).order_by(CommunicationMessage.created_at.asc()).limit(limit).all()

    else:
        raise HTTPException(status_code=400, detail=f"Invalid channel_type: {channel_type}")

    return [_format_message_out(m, db) for m in messages]


@router.post("/send", response_model=CommunicationMessageOut)
async def send_message(
    payload: CommunicationMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sends a communication message with hierarchical role enforcement.
    """
    user_role = current_user.role
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be blank.")

    # 1. HIERARCHY PERMISSION ENFORCEMENT
    if payload.channel_type == "BROADCAST_NATIONWIDE":
        if user_role not in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Hierarchy restriction: Only Super Admin (Central Authority) can publish nationwide broadcasts."
            )

    elif payload.channel_type == "BROADCAST_REGION":
        if not payload.target_region_id:
            raise HTTPException(status_code=400, detail="target_region_id is required for regional broadcast.")
        if user_role not in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
            if user_role != RoleEnum.REGIONAL_ADMIN.value or current_user.region_id != payload.target_region_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Hierarchy restriction: You can only broadcast to your own assigned Region."
                )

    elif payload.channel_type == "BROADCAST_CITY":
        if not payload.target_city_id:
            raise HTTPException(status_code=400, detail="target_city_id is required for city hub dispatch.")
        city_loc = db.query(Location).filter(Location.location_id == payload.target_city_id).first()
        if not city_loc:
            raise HTTPException(status_code=404, detail="Target city location not found.")

        # Check permissions: Super Admin, Regional Admin of this region, or City Hub Manager of this city
        is_super = user_role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]
        is_reg = user_role == RoleEnum.REGIONAL_ADMIN.value and current_user.region_id == city_loc.region_id
        is_hub_mgr = user_role == RoleEnum.MANAGER.value and (current_user.city_id == city_loc.location_id or city_loc.location_id in (current_user.territory_ids or []))

        if not (is_super or is_reg or is_hub_mgr):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Hierarchy restriction: Field Workers cannot broadcast hub memos. Send a direct escalation to your City Hub Manager instead."
            )

    elif payload.channel_type == "DIRECT":
        if not payload.recipient_id:
            raise HTTPException(status_code=400, detail="recipient_id is required for DIRECT communication.")
        recipient = db.query(User).filter(User.user_id == payload.recipient_id, User.is_active == 1).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient user not found or inactive.")
    else:
        raise HTTPException(status_code=400, detail=f"Unknown channel_type: {payload.channel_type}")

    # 2. PERSIST MESSAGE
    new_msg = CommunicationMessage(
        sender_id=current_user.user_id,
        recipient_id=payload.recipient_id if payload.channel_type == "DIRECT" else None,
        channel_type=payload.channel_type,
        target_region_id=payload.target_region_id,
        target_city_id=payload.target_city_id,
        subject=payload.subject or ("Operational Message" if payload.channel_type == "DIRECT" else "Broadcast Directive"),
        content=content,
        priority=payload.priority,
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    # 3. AUDIT LOG (for high priority or broadcasts)
    if payload.priority in ["URGENT", "OPERATIONAL_DIRECTIVE"] or payload.channel_type.startswith("BROADCAST"):
        log_audit(
            db=db,
            action=f"COMMS_{payload.channel_type}_{payload.priority}",
            details=f"Sender: {current_user.name} ({current_user.role}) - Subject: {new_msg.subject}",
            user_id=current_user.user_id,
            user_name=current_user.name,
            user_role=current_user.role
        )

    # 4. WEBSOCKET REALTIME BROADCAST
    try:
        await ws_manager.broadcast({
            "type": "NEW_COMMUNICATION_MESSAGE",
            "message_id": new_msg.message_id,
            "channel_type": new_msg.channel_type,
            "sender_id": current_user.user_id,
            "sender_name": current_user.name,
            "sender_role": current_user.role,
            "recipient_id": new_msg.recipient_id,
            "target_region_id": new_msg.target_region_id,
            "target_city_id": new_msg.target_city_id,
            "priority": new_msg.priority,
            "subject": new_msg.subject,
            "content": new_msg.content[:150],
            "created_at": new_msg.created_at.isoformat()
        })
    except Exception as e:
        print(f"Comms WebSocket broadcast warning: {e}")

    return _format_message_out(new_msg, db)


@router.post("/read/{message_id}")
def mark_message_as_read(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marks a specific message as read.
    """
    msg = db.query(CommunicationMessage).filter(CommunicationMessage.message_id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    msg.is_read = True
    msg.read_at = datetime.utcnow()
    db.commit()
    return {"status": "success", "message_id": message_id, "is_read": True}


@router.post("/read-thread")
def mark_thread_as_read(
    recipient_id: int = Query(...), # The other party's user id
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marks all direct messages received from recipient_id as read.
    """
    now = datetime.utcnow()
    updated_count = db.query(CommunicationMessage).filter(
        CommunicationMessage.channel_type == "DIRECT",
        CommunicationMessage.sender_id == recipient_id,
        CommunicationMessage.recipient_id == current_user.user_id,
        CommunicationMessage.is_read == False
    ).update({"is_read": True, "read_at": now}, synchronize_session=False)
    db.commit()

    return {"status": "success", "updated_count": updated_count}


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns unread messages count for badges.
    """
    # Direct unread messages specifically addressed to current_user
    direct_unread = db.query(CommunicationMessage).filter(
        CommunicationMessage.channel_type == "DIRECT",
        CommunicationMessage.recipient_id == current_user.user_id,
        CommunicationMessage.is_read == False
    ).count()

    return {
        "direct_unread": direct_unread,
        "total_unread": direct_unread
    }
