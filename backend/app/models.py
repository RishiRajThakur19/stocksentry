from sqlalchemy import Column, Integer, String, Float, Numeric, DateTime, ForeignKey, Boolean, Text, Table, CheckConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base

user_territories = Table(
    "user_territories",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True),
    Column("location_id", Integer, ForeignKey("locations.location_id", ondelete="CASCADE"), primary_key=True)
)

class RoleEnum(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    REGIONAL_ADMIN = "REGIONAL_ADMIN"
    MANAGER = "MANAGER"
    LOCATION_MANAGER = "MANAGER"
    FIELD_WORKER = "FIELD_WORKER"

class AssetStatusEnum(str, enum.Enum):
    IN_WAREHOUSE = "IN_WAREHOUSE"
    DISPATCHED = "DISPATCHED"
    ASSIGNED = "ASSIGNED"
    IN_REPAIR = "IN_REPAIR"
    DECOMMISSIONED = "DECOMMISSIONED"
    LOST = "LOST"
    STOLEN = "STOLEN"

class TxnTypeEnum(str, enum.Enum):
    RECEIVED = "RECEIVED"
    DISPATCHED = "DISPATCHED"
    ADJUSTMENT = "ADJUSTMENT"

class RequestStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    DISPATCHED = "DISPATCHED"
    DELIVERED = "DELIVERED"

class AlertStatusEnum(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"

class Region(Base):
    __tablename__ = "regions"

    region_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)

    cities = relationship("Location", back_populates="region")
    regional_admins = relationship("User", back_populates="region")

class Location(Base):
    """
    Represents a City Hub within a Region.
    """
    __tablename__ = "locations"

    location_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    region_id = Column(Integer, ForeignKey("regions.region_id"), nullable=True)
    name = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False, default=28.6139)
    longitude = Column(Float, nullable=False, default=77.2090)
    manager_id = Column(Integer, ForeignKey("users.user_id", use_alter=True, name="fk_location_manager"), nullable=True)

    region = relationship("Region", back_populates="cities")
    users = relationship("User", back_populates="city_location", foreign_keys="User.city_id")
    asset_units = relationship("AssetUnit", back_populates="location")

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default=RoleEnum.MANAGER.value)
    region_id = Column(Integer, ForeignKey("regions.region_id"), nullable=True)
    city_id = Column(Integer, ForeignKey("locations.location_id"), nullable=True)
    is_active = Column(Integer, default=1)
    is_leaving = Column(Boolean, default=False)
    clearance_status = Column(String(50), default="ACTIVE") # ACTIVE, PENDING_CLEARANCE, OFFBOARDED
    must_change_password = Column(Boolean, default=False, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    auth_provider = Column(String(50), default="local", nullable=False)
    token_version = Column(Integer, default=1, nullable=False)

    # Legacy alias support
    @property
    def location_id(self):
        return self.city_id

    @location_id.setter
    def location_id(self, val):
        self.city_id = val

    region = relationship("Region", back_populates="regional_admins", foreign_keys=[region_id])
    city_location = relationship("Location", back_populates="users", foreign_keys=[city_id])
    assigned_assets = relationship("AssetUnit", back_populates="holder", foreign_keys="AssetUnit.current_holder_id")
    noc_records = relationship("NOCRecord", back_populates="user", foreign_keys="NOCRecord.user_id")
    territories = relationship("Location", secondary=user_territories, backref="assigned_users")

    @property
    def territory_ids(self):
        t_ids = [t.location_id for t in self.territories] if self.territories else []
        if self.city_id and self.city_id not in t_ids:
            t_ids.insert(0, self.city_id)
        return t_ids

    @property
    def territory_names(self):
        t_names = [t.name for t in self.territories] if self.territories else []
        if self.city_location and self.city_location.name not in t_names:
            t_names.insert(0, self.city_location.name)
        return t_names

class RepairLocation(Base):
    """
    Physical repair facility tied to a City & Region.
    """
    __tablename__ = "repair_locations"

    repair_location_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    city_id = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    region_id = Column(Integer, ForeignKey("regions.region_id"), nullable=False)
    address = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)

    city = relationship("Location")
    region = relationship("Region")
    asset_units = relationship("AssetUnit", back_populates="repair_facility")

class Item(Base):
    __tablename__ = "items"

    item_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_serialized = Column(Boolean, default=False, nullable=False)
    image_url = Column(String(255), nullable=True)

    variants = relationship("ItemVariant", back_populates="item", cascade="all, delete-orphan")

class ItemVariant(Base):
    __tablename__ = "item_variants"

    variant_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey("items.item_id"), nullable=False)
    variant_name = Column(String(100), nullable=False)
    unit_cost = Column(Float, nullable=False, default=0.0)
    reorder_threshold = Column(Integer, nullable=False, default=10)
    reorder_quantity = Column(Integer, nullable=False, default=20)

    item = relationship("Item", back_populates="variants")
    stock_record = relationship("InventoryStock", back_populates="variant", uselist=False)
    asset_units = relationship("AssetUnit", back_populates="variant", cascade="all, delete-orphan")

class AssetUnit(Base):
    """
    Individual Serialized Asset Tracking for Modems, Clamping Machines, Cameras, etc.
    """
    __tablename__ = "asset_units"

    asset_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    variant_id = Column(Integer, ForeignKey("item_variants.variant_id"), nullable=False)
    serial_number = Column(String(100), unique=True, index=True, nullable=False)
    status = Column(String(50), nullable=False, default=AssetStatusEnum.IN_WAREHOUSE.value)
    current_holder_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, index=True)
    current_location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=True, index=True)
    repair_location_id = Column(Integer, ForeignKey("repair_locations.repair_location_id"), nullable=True)
    is_reserved = Column(Boolean, default=False, nullable=False)
    reserved_for_request_id = Column(Integer, nullable=True)
    receipt_batch_id = Column(Integer, ForeignKey("receipt_batches.batch_id"), nullable=True)
    tech_delivery_status = Column(String(30), default="DELIVERED", nullable=False) # DISPATCHED, DELIVERED
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_asset_units_status_loc", "status", "current_location_id"),
    )

    variant = relationship("ItemVariant", back_populates="asset_units")
    holder = relationship("User", back_populates="assigned_assets", foreign_keys=[current_holder_id])
    location = relationship("Location", back_populates="asset_units", foreign_keys=[current_location_id])
    repair_facility = relationship("RepairLocation", back_populates="asset_units", foreign_keys=[repair_location_id])
    lifecycle_events = relationship("AssetLifecycleEvent", back_populates="asset", cascade="all, delete-orphan", order_by="desc(AssetLifecycleEvent.timestamp)")
    complaints = relationship("AssetComplaint", back_populates="asset", cascade="all, delete-orphan")

class AssetComplaint(Base):
    """
    Field Worker / Technician fault reports on assigned assets.
    """
    __tablename__ = "asset_complaints"

    complaint_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("asset_units.asset_id"), nullable=False)
    reported_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="OPEN") # OPEN, ROUTED_TO_REPAIR, RESOLVED, REJECTED
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    asset = relationship("AssetUnit", back_populates="complaints")
    reporter = relationship("User", foreign_keys=[reported_by])

class RepairRequest(Base):
    """
    Repair request approval workflow: PENDING -> Approved by Regional Admin -> IN_REPAIR -> REPAIR_RETURNED (Central stock or Decommission).
    """
    __tablename__ = "repair_requests"

    repair_request_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("asset_units.asset_id"), nullable=False)
    requested_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    region_id = Column(Integer, ForeignKey("regions.region_id"), nullable=False)
    city_id = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    repair_location_id = Column(Integer, ForeignKey("repair_locations.repair_location_id"), nullable=True)
    complaint_id = Column(Integer, ForeignKey("asset_complaints.complaint_id"), nullable=True)
    status = Column(String(50), nullable=False, default="PENDING") # PENDING, APPROVED, REJECTED, IN_REPAIR, REPAIR_RETURNED, ROUTED_TO_SCRAP
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    asset = relationship("AssetUnit")
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
    repair_facility = relationship("RepairLocation")
    complaint = relationship("AssetComplaint")

class DecommissionRequest(Base):
    """
    Decommission / Scrap workflow: PENDING -> Approved by Regional Admin -> SCRAPPED.
    """
    __tablename__ = "decommission_requests"

    decommission_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("asset_units.asset_id"), nullable=False)
    requested_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    region_id = Column(Integer, ForeignKey("regions.region_id"), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="PENDING") # PENDING, APPROVED, REJECTED
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)

    asset = relationship("AssetUnit")
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])

class AssetTransfer(Base):
    """
    Direct technician-to-technician transfer (Same City: instant) or cross-city transfer (requires destination manager acceptance).
    """
    __tablename__ = "asset_transfers"

    transfer_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("asset_units.asset_id"), nullable=False)
    from_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    to_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    from_city_id = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    to_city_id = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    transfer_type = Column(String(50), nullable=False, default="SAME_CITY") # SAME_CITY, CROSS_CITY
    status = Column(String(50), nullable=False, default="COMPLETED") # COMPLETED, PENDING_ACCEPTANCE, REJECTED
    initiated_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    accepted_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    asset = relationship("AssetUnit")
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])
    from_city = relationship("Location", foreign_keys=[from_city_id])
    to_city = relationship("Location", foreign_keys=[to_city_id])
    initiator = relationship("User", foreign_keys=[initiated_by])
    acceptor = relationship("User", foreign_keys=[accepted_by])

class AssetLifecycleEvent(Base):
    """
    Append-only audit trail capturing the complete lifecycle of each physical serialized asset.
    """
    __tablename__ = "asset_lifecycle_events"

    event_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("asset_units.asset_id"), nullable=False)
    event_type = Column(String(50), nullable=False) # REGISTERED, DISPATCHED, ASSIGNED, FAULT_REPORTED, REPAIR_REQUESTED, REPAIR_APPROVED, REPAIR_COMPLETED, TRANSFERRED, DECOMMISSION_REQUESTED, SCRAPPED
    from_holder_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    to_holder_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    from_location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=True)
    to_location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=True)
    repair_location_id = Column(Integer, ForeignKey("repair_locations.repair_location_id"), nullable=True)
    performed_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    asset = relationship("AssetUnit", back_populates="lifecycle_events")
    actor = relationship("User", foreign_keys=[performed_by])
    from_holder = relationship("User", foreign_keys=[from_holder_id])
    to_holder = relationship("User", foreign_keys=[to_holder_id])
    from_location = relationship("Location", foreign_keys=[from_location_id])
    to_location = relationship("Location", foreign_keys=[to_location_id])
    repair_facility = relationship("RepairLocation", foreign_keys=[repair_location_id])

class NOCRecord(Base):
    """
    No Objection Certificate issued upon employee offboarding after 100% asset clearance.
    """
    __tablename__ = "noc_records"

    noc_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    noc_number = Column(String(100), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    user_name = Column(String(100), nullable=False)
    user_role = Column(String(50), nullable=False)
    city_name = Column(String(100), nullable=True)
    region_name = Column(String(100), nullable=True)
    issued_by_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    issued_by_name = Column(String(100), nullable=False)
    cleared_at = Column(DateTime, default=datetime.utcnow)
    cleared_assets_summary = Column(Text, nullable=True) # JSON representation of cleared items
    remarks = Column(Text, nullable=True)

    user = relationship("User", back_populates="noc_records", foreign_keys=[user_id])
    issuer = relationship("User", foreign_keys=[issued_by_id])

class InventoryStock(Base):
    """
    Single Central Warehouse Inventory Stock Table.
    All physical stock is held in one central warehouse.
    For consumables, tracks physical quantity.
    """
    __tablename__ = "inventory_stocks"

    stock_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    variant_id = Column(Integer, ForeignKey("item_variants.variant_id"), unique=True, nullable=False)
    current_quantity = Column(Integer, nullable=False, default=0)
    reserved_quantity = Column(Integer, nullable=False, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("current_quantity >= 0", name="ck_inventory_stock_qty_non_negative"),
        CheckConstraint("reserved_quantity >= 0", name="ck_inventory_stock_reserved_non_negative"),
    )

    variant = relationship("ItemVariant", back_populates="stock_record")

class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    txn_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    variant_id = Column(Integer, ForeignKey("item_variants.variant_id"), nullable=False)
    txn_type = Column(String(50), nullable=False) # RECEIVED, DISPATCHED, ADJUSTMENT
    quantity = Column(Integer, nullable=False)
    performed_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    reference_request_id = Column(Integer, ForeignKey("requests.request_id"), nullable=True)

    variant = relationship("ItemVariant")
    user = relationship("User")

class RequestModel(Base):
    """
    City Stock Requests from Managers to Central Warehouse.
    """
    __tablename__ = "requests"

    request_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    requested_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("item_variants.variant_id"), nullable=False)
    quantity_requested = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False, default=RequestStatusEnum.PENDING.value)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    dispatched_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    dispatched_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    carrier_name = Column(String(100), nullable=True)
    tracking_number = Column(String(100), nullable=True)
    estimated_delivery = Column(String(100), nullable=True)

    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
    dispatcher = relationship("User", foreign_keys=[dispatched_by])
    location = relationship("Location", foreign_keys=[location_id])
    variant = relationship("ItemVariant")

class Alert(Base):
    __tablename__ = "alerts"

    alert_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    variant_id = Column(Integer, ForeignKey("item_variants.variant_id"), nullable=False)
    threshold_at_trigger = Column(Integer, nullable=False)
    current_qty_at_trigger = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False, default=AlertStatusEnum.OPEN.value) # OPEN, ACKNOWLEDGED, RESOLVED
    created_at = Column(DateTime, default=datetime.utcnow)

    variant = relationship("ItemVariant")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    user_name = Column(String(100), nullable=True)
    user_role = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

class ManagerHandoverRecord(Base):
    """
    Tracks inventory and warehouse custody handover when a City Hub Manager leaves their post.
    """
    __tablename__ = "manager_handover_records"

    handover_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    handover_number = Column(String(100), unique=True, index=True, nullable=False)
    outgoing_manager_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    outgoing_manager_name = Column(String(100), nullable=False)
    city_id = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    city_name = Column(String(100), nullable=False)
    action_type = Column(String(50), nullable=False) # "TRANSFER_TO_SUCCESSOR", "EVACUATE_TO_CENTRAL", "TRANSFER_TO_CITY"
    target_manager_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    target_manager_name = Column(String(100), nullable=True)
    target_city_id = Column(Integer, ForeignKey("locations.location_id"), nullable=True)
    target_city_name = Column(String(100), nullable=True)
    transferred_assets_count = Column(Integer, nullable=False, default=0)
    transferred_value_inr = Column(Float, nullable=False, default=0.0)
    transferred_summary_json = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CommunicationMessage(Base):
    """
    Hierarchical communication messages, team dispatches, and operational broadcast directives.
    Channel Types:
      - 'DIRECT': 1-on-1 direct message between authorized hierarchical contacts
      - 'BROADCAST_NATIONWIDE': Super Admin directive broadcast to all regions and hubs
      - 'BROADCAST_REGION': Regional Admin directive broadcast to city hubs within the region
      - 'BROADCAST_CITY': City Hub Manager dispatch memo broadcast to field technicians in that hub
    """
    __tablename__ = "communication_messages"

    message_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sender_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.user_id"), nullable=True) # null for channel/broadcasts
    channel_type = Column(String(50), nullable=False, default="DIRECT") # DIRECT, BROADCAST_NATIONWIDE, BROADCAST_REGION, BROADCAST_CITY
    target_region_id = Column(Integer, ForeignKey("regions.region_id"), nullable=True)
    target_city_id = Column(Integer, ForeignKey("locations.location_id"), nullable=True)
    subject = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)
    priority = Column(String(30), nullable=False, default="NORMAL") # NORMAL, URGENT, OPERATIONAL_DIRECTIVE
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
    target_region = relationship("Region", foreign_keys=[target_region_id])
    target_city = relationship("Location", foreign_keys=[target_city_id])


class FieldRequisition(Base):
    """
    Field Technician gear/equipment/uniform requisition routed to both City Manager and Regional Admin.
    """
    __tablename__ = "field_requisitions"

    requisition_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    requested_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    region_id = Column(Integer, ForeignKey("regions.region_id"), nullable=True)
    variant_id = Column(Integer, ForeignKey("item_variants.variant_id"), nullable=False)
    quantity_requested = Column(Integer, nullable=False, default=1)
    quantity_fulfilled = Column(Integer, nullable=False, default=0)
    urgency = Column(String(30), nullable=False, default="NORMAL") # NORMAL, URGENT, CRITICAL
    target_approver = Column(String(30), nullable=False, default="BOTH") # BOTH, CITY_MANAGER, REGIONAL_ADMIN
    status = Column(String(30), nullable=False, default="PENDING") # PENDING, APPROVED, FULFILLED, REJECTED
    notes = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    review_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    fulfilled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    requester = relationship("User", foreign_keys=[requested_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    location = relationship("Location", foreign_keys=[location_id])
    region = relationship("Region", foreign_keys=[region_id])
    variant = relationship("ItemVariant")


class FieldConsumableAssignment(Base):
    """
    Tracks non-serialized gear/uniforms/consumables (e.g., T-shirts, safety vests, drop cable)
    assigned to Field Technicians by City Managers or Regional Admins.
    """
    __tablename__ = "field_consumable_assignments"

    assignment_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("item_variants.variant_id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    assigned_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    notes = Column(Text, nullable=True)
    delivery_status = Column(String(30), default="DISPATCHED", nullable=False) # DISPATCHED, DELIVERED
    delivered_at = Column(DateTime, nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    technician = relationship("User", foreign_keys=[user_id])
    assigner = relationship("User", foreign_keys=[assigned_by])
    location = relationship("Location", foreign_keys=[location_id])
    variant = relationship("ItemVariant")


class RefreshToken(Base):
    """
    Stores hashed refresh tokens for rotation and revocation on logout/deactivation.
    """
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class PasswordResetToken(Base):
    """
    Single-use, time-limited password reset token (stored as SHA-256 hash).
    """
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class IdempotencyRecord(Base):
    """
    Prevents duplicate execution of dispatch or bulk-assignment requests with the same Idempotency-Key.
    """
    __tablename__ = "idempotency_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    idempotency_key = Column(String(128), unique=True, index=True, nullable=False)
    endpoint = Column(String(128), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    response_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ================= STAGE 2: SUPPORT TICKETS, LOST ASSETS & STOCK AUDITS =================

class Ticket(Base):
    __tablename__ = "tickets"

    ticket_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ticket_code = Column(String(40), unique=True, index=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    city_id = Column(Integer, ForeignKey("locations.location_id"), nullable=True, index=True)
    region_id = Column(Integer, ForeignKey("regions.region_id"), nullable=True, index=True)
    category = Column(String(50), nullable=False, default="OTHER") # ASSET_FAULT, STOCK_ISSUE, ACCESS_ACCOUNT, REQUEST_QUERY, OTHER
    priority = Column(String(30), nullable=False, default="NORMAL") # LOW, NORMAL, HIGH, URGENT
    status = Column(String(40), nullable=False, default="OPEN", index=True) # OPEN, IN_PROGRESS, WAITING_ON_REQUESTER, RESOLVED, CLOSED, REOPENED
    subject = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    related_asset_id = Column(Integer, ForeignKey("asset_units.asset_id"), nullable=True)
    related_request_id = Column(Integer, ForeignKey("requests.request_id"), nullable=True)
    related_repair_id = Column(Integer, ForeignKey("repair_requests.repair_request_id"), nullable=True)
    assignee_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, index=True)
    escalation_level = Column(Integer, nullable=False, default=0) # 0=City, 1=Regional, 2=SuperAdmin
    sla_due_at = Column(DateTime, nullable=False)
    sla_breached = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by])
    assignee = relationship("User", foreign_keys=[assignee_id])
    city = relationship("Location", foreign_keys=[city_id])
    region = relationship("Region", foreign_keys=[region_id])
    related_asset = relationship("AssetUnit", foreign_keys=[related_asset_id])


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    comment_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ticket_id = Column(Integer, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    body = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket")
    author = relationship("User", foreign_keys=[author_id])


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    attachment_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ticket_id = Column(Integer, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), nullable=False, index=True)
    comment_id = Column(Integer, ForeignKey("ticket_comments.comment_id", ondelete="CASCADE"), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), unique=True, nullable=False)
    content_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class TicketEvent(Base):
    __tablename__ = "ticket_events"

    event_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ticket_id = Column(Integer, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    event_type = Column(String(50), nullable=False) # CREATED, STATUS_CHANGED, REASSIGNED, ESCALATED, SLA_BREACHED
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    actor = relationship("User", foreign_keys=[actor_id])


class LossReport(Base):
    __tablename__ = "loss_reports"

    loss_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    asset_id = Column(Integer, ForeignKey("asset_units.asset_id"), nullable=False, index=True)
    reported_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    loss_type = Column(String(30), nullable=False, default="LOST") # LOST, STOLEN
    circumstances = Column(Text, nullable=False)
    date_last_seen = Column(String(50), nullable=True)
    police_report_ref = Column(String(120), nullable=True)
    status = Column(String(40), nullable=False, default="PENDING_REGIONAL", index=True) # PENDING_REGIONAL, APPROVED, REJECTED, RECOVERED
    reviewed_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    review_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    asset = relationship("AssetUnit")
    reporter = relationship("User", foreign_keys=[reported_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class StockAudit(Base):
    __tablename__ = "stock_audits"

    audit_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    audit_code = Column(String(40), unique=True, index=True, nullable=False)
    scope_type = Column(String(30), nullable=False, default="CITY") # CENTRAL, CITY
    location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=True)
    region_id = Column(Integer, ForeignKey("regions.region_id"), nullable=True)
    status = Column(String(30), nullable=False, default="DRAFT", index=True) # DRAFT, COUNTING, SUBMITTED, APPROVED, CLOSED
    started_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    variance_threshold_pct = Column(Float, nullable=False, default=2.0)
    notes = Column(Text, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    starter = relationship("User", foreign_keys=[started_by])
    approver = relationship("User", foreign_keys=[approved_by])
    location = relationship("Location", foreign_keys=[location_id])


class StockAuditLine(Base):
    __tablename__ = "stock_audit_lines"

    line_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    audit_id = Column(Integer, ForeignKey("stock_audits.audit_id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("item_variants.variant_id"), nullable=False)
    system_quantity = Column(Integer, nullable=False, default=0)
    counted_quantity = Column(Integer, nullable=False, default=0)
    variance = Column(Integer, nullable=False, default=0)
    reason = Column(Text, nullable=True)
    scanned_serials_json = Column(Text, nullable=True)
    missing_serials_json = Column(Text, nullable=True)

    audit = relationship("StockAudit")
    variant = relationship("ItemVariant")


class ReceiptBatch(Base):
    __tablename__ = "receipt_batches"

    batch_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    batch_code = Column(String(40), unique=True, index=True, nullable=False)
    variant_id = Column(Integer, ForeignKey("item_variants.variant_id"), nullable=False)
    received_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    reference_note = Column(Text, nullable=True)
    unit_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    variant = relationship("ItemVariant")
    receiver = relationship("User", foreign_keys=[received_by])


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    pref_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), unique=True, nullable=False)
    email_requests = Column(Boolean, default=True, nullable=False)
    email_requisitions = Column(Boolean, default=True, nullable=False)
    email_tickets = Column(Boolean, default=True, nullable=False)
    email_low_stock = Column(Boolean, default=True, nullable=False)
    email_noc = Column(Boolean, default=True, nullable=False)
    email_weekly_digest = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")





