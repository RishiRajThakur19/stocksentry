from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# Region Schemas
class RegionOut(BaseModel):
    region_id: int
    name: str
    city_count: Optional[int] = 0

    class Config:
        from_attributes = True

class RegionCreateRequest(BaseModel):
    name: str

# Location / City Schemas
class LocationOut(BaseModel):
    location_id: int
    name: str
    city: str
    region_id: Optional[int] = None
    region_name: Optional[str] = None
    latitude: Optional[float] = 28.6139
    longitude: Optional[float] = 77.2090
    manager_id: Optional[int] = None
    manager_name: Optional[str] = None

    class Config:
        from_attributes = True

# Auth & User Schemas
class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    name: str
    email: str
    phone: str
    role: str # SUPER_ADMIN, REGIONAL_ADMIN, MANAGER, FIELD_WORKER
    region_id: Optional[int] = None
    location_id: Optional[int] = None
    city_id: Optional[int] = None
    password: str

class OTPVerifyRequest(BaseModel):
    email: str
    otp: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    email: str
    role: str
    region_id: Optional[int] = None
    region_name: Optional[str] = None
    city_id: Optional[int] = None
    location_id: Optional[int] = None
    location_name: Optional[str] = None

class UserOut(BaseModel):
    user_id: int
    name: str
    email: str
    role: str
    region_id: Optional[int] = None
    region_name: Optional[str] = None
    city_id: Optional[int] = None
    location_id: Optional[int] = None
    location_name: Optional[str] = None

    class Config:
        from_attributes = True

class UserAdminOut(BaseModel):
    user_id: int
    name: str
    email: str
    role: str
    region_id: Optional[int] = None
    region_name: Optional[str] = None
    city_id: Optional[int] = None
    location_id: Optional[int] = None
    location_name: Optional[str] = None
    is_active: bool = True
    is_leaving: Optional[bool] = False
    clearance_status: Optional[str] = "ACTIVE"
    assigned_assets_count: Optional[int] = 0

    class Config:
        from_attributes = True

class UserCreateRequest(BaseModel):
    name: str
    email: str
    role: str # SUPER_ADMIN, REGIONAL_ADMIN, MANAGER, FIELD_WORKER
    region_id: Optional[int] = None
    location_id: Optional[int] = None
    city_id: Optional[int] = None
    password: str

class UserResetPasswordRequest(BaseModel):
    new_password: str

# Repair Location Schemas
class RepairLocationOut(BaseModel):
    repair_location_id: int
    name: str
    city_id: int
    region_id: int
    city_name: Optional[str] = None
    region_name: Optional[str] = None
    address: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: bool = True
    active_repairs_count: Optional[int] = 0

    class Config:
        from_attributes = True

class RepairLocationCreate(BaseModel):
    name: str
    city_id: int
    region_id: int
    address: Optional[str] = None
    contact_phone: Optional[str] = None

# Asset Unit Schema
class AssetUnitOut(BaseModel):
    asset_id: int
    variant_id: int
    serial_number: str
    status: str # IN_WAREHOUSE, DISPATCHED, ASSIGNED, IN_REPAIR, DECOMMISSIONED
    current_holder_id: Optional[int] = None
    current_holder_name: Optional[str] = None
    current_location_id: Optional[int] = None
    current_location_name: Optional[str] = None
    repair_location_id: Optional[int] = None
    repair_location_name: Optional[str] = None
    created_at: datetime
    variant_name: Optional[str] = None
    item_name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    unit_cost: Optional[float] = 0.0
    image_url: Optional[str] = None
    health_score: Optional[int] = 95
    mtbf_hours: Optional[int] = 12000
    in_service_days: Optional[int] = 180
    next_maintenance_due: Optional[str] = None
    next_calibration_due: Optional[str] = None

    class Config:
        from_attributes = True

# Asset Complaint Schemas
class AssetComplaintCreate(BaseModel):
    asset_id: int
    description: str

class AssetComplaintOut(BaseModel):
    complaint_id: int
    asset_id: int
    serial_number: Optional[str] = None
    item_name: Optional[str] = None
    variant_name: Optional[str] = None
    reported_by: int
    reporter_name: Optional[str] = None
    reporter_city: Optional[str] = None
    reporter_region: Optional[str] = None
    description: str
    status: str # OPEN, ROUTED_TO_REPAIR, RESOLVED, REJECTED
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Repair Workflow Schemas
class RepairRequestCreate(BaseModel):
    asset_id: int
    notes: Optional[str] = None
    complaint_id: Optional[int] = None
    repair_location_id: Optional[int] = None

class RepairRequestApprove(BaseModel):
    repair_location_id: int
    notes: Optional[str] = None

class RepairRequestComplete(BaseModel):
    resolution_action: str # "RETURN_TO_WAREHOUSE" or "ROUTE_TO_SCRAP"
    notes: Optional[str] = None
    technician_name: Optional[str] = None
    bench_station: Optional[str] = None
    parts_replaced: Optional[List[str]] = None
    labor_hours: Optional[float] = None
    calibration_certificate_no: Optional[str] = None
    optical_loss_db: Optional[float] = None
    burn_in_hours: Optional[float] = None
    qa_signoff: Optional[bool] = True

class RepairRequestOut(BaseModel):
    repair_request_id: int
    asset_id: int
    serial_number: Optional[str] = None
    item_name: Optional[str] = None
    variant_name: Optional[str] = None
    requested_by: int
    requester_name: Optional[str] = None
    approved_by: Optional[int] = None
    approver_name: Optional[str] = None
    region_id: int
    region_name: Optional[str] = None
    city_id: int
    city_name: Optional[str] = None
    repair_location_id: Optional[int] = None
    repair_location_name: Optional[str] = None
    complaint_id: Optional[int] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    work_order_meta: Optional[dict] = None

    class Config:
        from_attributes = True

class AssetSuggestionOut(BaseModel):
    asset_id: int
    serial_number: str
    item_name: Optional[str] = None
    variant_name: Optional[str] = None
    category: Optional[str] = None
    status: str
    location_name: Optional[str] = None
    holder_name: Optional[str] = None
    unit_cost: Optional[float] = 0.0

# Decommission Schemas
class DecommissionRequestCreate(BaseModel):
    asset_id: int
    reason: str
    notes: Optional[str] = None

class DecommissionRequestOut(BaseModel):
    decommission_id: int
    asset_id: int
    serial_number: Optional[str] = None
    item_name: Optional[str] = None
    variant_name: Optional[str] = None
    requested_by: int
    requester_name: Optional[str] = None
    approved_by: Optional[int] = None
    approver_name: Optional[str] = None
    region_id: int
    region_name: Optional[str] = None
    reason: str
    status: str # PENDING, APPROVED, REJECTED
    notes: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Asset Transfer Schemas
class AssetTransferCreateSameCity(BaseModel):
    asset_id: int
    to_user_id: int
    notes: Optional[str] = None

class AssetTransferCreateCrossCity(BaseModel):
    asset_id: int
    to_city_id: int
    to_user_id: Optional[int] = None
    notes: Optional[str] = None

class AssetTransferOut(BaseModel):
    transfer_id: int
    asset_id: int
    serial_number: Optional[str] = None
    item_name: Optional[str] = None
    variant_name: Optional[str] = None
    from_user_id: Optional[int] = None
    from_user_name: Optional[str] = None
    to_user_id: Optional[int] = None
    to_user_name: Optional[str] = None
    from_city_id: int
    from_city_name: Optional[str] = None
    to_city_id: int
    to_city_name: Optional[str] = None
    transfer_type: str # SAME_CITY, CROSS_CITY
    status: str # COMPLETED, PENDING_ACCEPTANCE, REJECTED
    initiated_by: int
    initiator_name: Optional[str] = None
    accepted_by: Optional[int] = None
    acceptor_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Asset Lifecycle Event Schema (Append-only Audit)
class AssetLifecycleEventOut(BaseModel):
    event_id: int
    asset_id: int
    event_type: str
    from_holder_id: Optional[int] = None
    from_holder_name: Optional[str] = None
    to_holder_id: Optional[int] = None
    to_holder_name: Optional[str] = None
    from_location_id: Optional[int] = None
    from_location_name: Optional[str] = None
    to_location_id: Optional[int] = None
    to_location_name: Optional[str] = None
    repair_location_id: Optional[int] = None
    repair_location_name: Optional[str] = None
    performed_by: Optional[int] = None
    actor_name: Optional[str] = None
    actor_role: Optional[str] = None
    notes: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

# Offboarding & NOC Schemas
class MarkLeavingRequest(BaseModel):
    user_id: int
    remarks: Optional[str] = None

class ClearanceCheckResponse(BaseModel):
    user_id: int
    user_name: str
    user_role: str
    city_name: Optional[str] = None
    region_name: Optional[str] = None
    is_leaving: bool
    clearance_status: str
    can_issue_noc: bool
    assigned_assets: List[AssetUnitOut] = []
    blocking_reasons: List[str] = []

class IssueNOCRequest(BaseModel):
    user_id: int
    remarks: Optional[str] = None

class NOCRecordOut(BaseModel):
    noc_id: int
    noc_number: str
    user_id: int
    user_name: str
    user_role: str
    city_name: Optional[str] = None
    region_name: Optional[str] = None
    issued_by_id: int
    issued_by_name: str
    cleared_at: datetime
    cleared_assets_summary: Optional[str] = None
    remarks: Optional[str] = None

    class Config:
        from_attributes = True

class SurrenderAssetRequest(BaseModel):
    asset_id: int
    condition: str = "FUNCTIONAL" # FUNCTIONAL or DAMAGED
    notes: Optional[str] = None

class OnboardStaffRequest(BaseModel):
    name: str
    email: str
    role: str
    password: Optional[str] = "tataplay123"
    city_id: Optional[int] = None
    region_id: Optional[int] = None
    initial_asset_ids: Optional[List[int]] = []

# Bulk Upload Schemas
class BulkUserRowPreview(BaseModel):
    row_index: int
    name: str
    email: str
    role: str
    city: str
    region: str
    is_valid: bool
    errors: List[str] = []

class BulkUploadPreviewResponse(BaseModel):
    total_rows: int
    valid_count: int
    error_count: int
    rows: List[BulkUserRowPreview]


# Item & Variant Schemas
class ItemVariantOut(BaseModel):
    variant_id: int
    item_id: int
    variant_name: str
    unit_cost: float
    reorder_threshold: int
    reorder_quantity: int
    item_name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    is_serialized: Optional[bool] = False
    central_stock_qty: Optional[int] = 0
    available_units_count: Optional[int] = 0

    class Config:
        from_attributes = True

class VariantCreateRequest(BaseModel):
    variant_name: str
    unit_cost: float
    reorder_threshold: int = 10
    reorder_quantity: int = 20
    initial_central_stock: Optional[int] = 100

class ItemCreateRequest(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    is_serialized: Optional[bool] = False
    image_url: Optional[str] = None
    variants: List[VariantCreateRequest]

class ItemOut(BaseModel):
    item_id: int
    name: str
    category: str
    description: Optional[str] = None
    is_serialized: bool = False
    image_url: Optional[str] = None
    variants: List[ItemVariantOut] = []

    class Config:
        from_attributes = True

# Single Central Inventory Stock Schemas
class InventoryStockOut(BaseModel):
    stock_id: int
    variant_id: int
    current_quantity: int
    last_updated: datetime
    variant_name: Optional[str] = None
    item_name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    is_serialized: Optional[bool] = False
    available_units_count: Optional[int] = 0
    reorder_threshold: Optional[int] = None
    reorder_quantity: Optional[int] = None
    unit_cost: Optional[float] = None
    is_low_stock: Optional[bool] = False

    class Config:
        from_attributes = True

class ReceiveStockRequest(BaseModel):
    variant_id: int
    quantity_received: int
    supplier_name: Optional[str] = "Syrotech Systems"
    notes: Optional[str] = None
    serial_numbers: Optional[List[str]] = None

class StockAdjustmentRequest(BaseModel):
    variant_id: int
    quantity_change: int # positive for add, negative for remove
    reason: Optional[str] = None

class StockTransactionOut(BaseModel):
    txn_id: int
    variant_id: int
    txn_type: str # RECEIVED, DISPATCHED, ADJUSTMENT
    quantity: int
    performed_by: int
    timestamp: datetime
    performed_by_name: Optional[str] = None
    item_name: Optional[str] = None
    variant_name: Optional[str] = None
    reference_request_id: Optional[int] = None

    class Config:
        from_attributes = True

# City Request Schemas
class RequestCreatePayload(BaseModel):
    variant_id: int
    quantity_requested: int
    location_id: Optional[int] = None # Defaults to manager's city location

class RequestDispatchPayload(BaseModel):
    carrier_name: Optional[str] = "Tata Play Express Logistics"
    tracking_number: Optional[str] = None
    estimated_delivery: Optional[str] = "2 Business Days"

class RequestOut(BaseModel):
    request_id: int
    requested_by: int
    location_id: int
    variant_id: int
    quantity_requested: int
    status: str
    created_at: datetime
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    dispatched_by: Optional[int] = None
    dispatched_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    carrier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    estimated_delivery: Optional[str] = None
    requester_name: Optional[str] = None
    location_name: Optional[str] = None
    city: Optional[str] = None
    region_id: Optional[int] = None
    region_name: Optional[str] = None
    source_location_name: Optional[str] = "Central Warehouse (Main Hub)"
    source_latitude: Optional[float] = 28.6139
    source_longitude: Optional[float] = 77.2090
    destination_latitude: Optional[float] = 28.6139
    destination_longitude: Optional[float] = 77.2090
    variant_name: Optional[str] = None
    item_name: Optional[str] = None
    is_serialized: Optional[bool] = False
    unit_cost: Optional[float] = None

    class Config:
        from_attributes = True

# Alert Schemas
class AlertOut(BaseModel):
    alert_id: int
    variant_id: int
    threshold_at_trigger: int
    current_qty_at_trigger: int
    status: str
    created_at: datetime
    variant_name: Optional[str] = None
    item_name: Optional[str] = None
    is_serialized: Optional[bool] = False
    current_quantity: Optional[int] = None

    class Config:
        from_attributes = True

class AlertStatusUpdate(BaseModel):
    status: str # ACKNOWLEDGED, RESOLVED

# Analytics Schemas
class DashboardSummary(BaseModel):
    total_locations: int
    total_skus: int
    total_central_stock: int
    total_inventory_value: float
    open_alerts_count: int
    pending_requests_count: int
    total_regions: Optional[int] = 0
    serialized_assets_count: Optional[int] = 0

# Audit Log Schemas
class AuditLogOut(BaseModel):
    log_id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

# Manager Handover Schemas
class ManagerHandoverRequest(BaseModel):
    outgoing_manager_id: int
    action_type: str # "TRANSFER_TO_SUCCESSOR", "EVACUATE_TO_CENTRAL", "TRANSFER_TO_CITY"
    target_manager_id: Optional[int] = None
    target_city_id: Optional[int] = None
    notes: Optional[str] = None

class ManagerHandoverRecordOut(BaseModel):
    handover_id: int
    handover_number: str
    outgoing_manager_id: int
    outgoing_manager_name: str
    city_id: int
    city_name: str
    action_type: str
    target_manager_id: Optional[int] = None
    target_manager_name: Optional[str] = None
    target_city_id: Optional[int] = None
    target_city_name: Optional[str] = None
    transferred_assets_count: int
    transferred_value_inr: float
    assets_transferred_count: Optional[int] = None
    total_valuation_inr: Optional[float] = None
    target_entity_name: Optional[str] = None
    transferred_summary_json: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Enterprise Ingestion Schemas
class EnterpriseIngestSummary(BaseModel):
    total_users_created: int
    total_devices_created: int
    total_devices_assigned: int
    total_warehouse_stock_added: int
    total_valuation_inr: float
    message: str
    sample_users: Optional[List[dict]] = None
    sample_devices: Optional[List[dict]] = None

# Field Technician Subscriber Wi-Fi Setup & ONT Activation Schemas
class SubscriberInstallationRequest(BaseModel):
    asset_id: int
    subscriber_id: str
    subscriber_name: str
    subscriber_address: str
    wifi_ssid: str
    wifi_password: Optional[str] = None
    optical_rx_power_dbm: float
    work_order_no: Optional[str] = None
    installation_notes: Optional[str] = None

class SubscriberInstallationResponse(BaseModel):
    installation_id: str
    asset_id: int
    serial_number: str
    item_name: str
    subscriber_id: str
    subscriber_name: str
    subscriber_address: str
    wifi_ssid: str
    optical_rx_power_dbm: float
    signal_status: str # "PASS_OPTIMAL", "PASS_ACCEPTABLE", "FAIL_HIGH_LOSS"
    technician_name: str
    installed_at: datetime
    message: str

# My Lakshya CRM Workforce Sync Schemas
class LakshyaSyncRequest(BaseModel):
    crm_url: Optional[str] = None
    api_key: Optional[str] = None

class LakshyaSyncResponse(BaseModel):
    status: str
    sync_mode: str
    message: str
    endpoint_used: str
    scanned_count: int
    created_count: int
    updated_count: int
    synced_users: List[dict]

