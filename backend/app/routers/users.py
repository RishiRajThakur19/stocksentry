import io
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
import openpyxl

from ..database import get_db
from ..models import User, Location, Region, AssetUnit, RoleEnum, Item, ItemVariant, AssetLifecycleEvent, InventoryStock, AssetStatusEnum
from ..schemas import (
    UserAdminOut, UserCreateRequest, UserResetPasswordRequest, 
    BulkUploadPreviewResponse, BulkUserRowPreview, EnterpriseIngestSummary,
    LakshyaSyncRequest, LakshyaSyncResponse
)
from ..services.lakshya_crm_service import sync_lakshya_workforce_to_db, DEFAULT_LAKSHYA_CRM_URL
from ..auth import (
    get_password_hash, get_current_user, require_super_admin, 
    require_regional_or_super_admin
)
from ..audit import log_audit

router = APIRouter(prefix="/api/users", tags=["User Management"])

EMAIL_REGEX = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'

def to_user_admin_out(u: User, db: Session) -> UserAdminOut:
    loc = u.city_location
    reg = u.region if u.region else (loc.region if loc else None)
    
    assigned_count = db.query(AssetUnit).filter(AssetUnit.current_holder_id == u.user_id).count()

    return UserAdminOut(
        user_id=u.user_id,
        name=u.name,
        email=u.email,
        role=u.role,
        region_id=u.region_id or (loc.region_id if loc else None),
        region_name=reg.name if reg else "Global Access",
        city_id=u.city_id,
        location_id=u.city_id,
        location_name=loc.name if loc else ("All Regional Hubs" if u.role == RoleEnum.REGIONAL_ADMIN.value else "Global Operations"),
        is_active=bool(u.is_active),
        is_leaving=bool(u.is_leaving),
        clearance_status=u.clearance_status or "ACTIVE",
        assigned_assets_count=assigned_count
    )

@router.get("", response_model=List[UserAdminOut])
def get_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Role-Scoped User List:
    - SUPER_ADMIN: all users
    - REGIONAL_ADMIN: users in their region
    - MANAGER: field workers and managers in their city
    """
    if current_user.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN"]:
        users = db.query(User).all()
    elif current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        region_cities = db.query(Location.location_id).filter(Location.region_id == current_user.region_id).all()
        city_ids = [c[0] for c in region_cities]
        users = db.query(User).filter(
            (User.region_id == current_user.region_id) | (User.city_id.in_(city_ids))
        ).all()
    elif current_user.role == RoleEnum.MANAGER.value:
        user_city_id = current_user.city_id or current_user.location_id
        users = db.query(User).filter(User.city_id == user_city_id).all()
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: Insufficient permissions to view users")

    return [to_user_admin_out(u, db) for u in users]

@router.post("", response_model=UserAdminOut)
def create_user(
    req: UserCreateRequest,
    current_user: User = Depends(require_regional_or_super_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    assigned_city_id = req.city_id or req.location_id
    assigned_region_id = req.region_id

    if current_user.role == RoleEnum.REGIONAL_ADMIN.value:
        if req.role in [RoleEnum.SUPER_ADMIN.value, "CENTRAL_ADMIN", RoleEnum.REGIONAL_ADMIN.value]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Regional Admins can only create Managers or Field Workers in their region.")
        if assigned_city_id:
            loc = db.query(Location).filter(Location.location_id == assigned_city_id).first()
            if not loc or loc.region_id != current_user.region_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot assign user to a city outside your region.")
        assigned_region_id = current_user.region_id

    new_user = User(
        name=req.name,
        email=req.email,
        password_hash=get_password_hash(req.password),
        role=req.role,
        region_id=assigned_region_id if req.role == RoleEnum.REGIONAL_ADMIN.value else None,
        city_id=assigned_city_id if req.role in [RoleEnum.MANAGER.value, RoleEnum.FIELD_WORKER.value] else None
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit(db, "CREATE_USER", f"{current_user.name} ({current_user.role}) created user '{new_user.email}' as {new_user.role}", current_user.user_id, current_user.name, current_user.role)

    return to_user_admin_out(new_user, db)

@router.get("/template")
def download_user_excel_template():
    """
    Generates downloadable .xlsx template with predefined columns and sample rows.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "User Import Template"

    headers = ["Name", "Email", "Role", "City", "Region"]
    ws.append(headers)

    # Style header
    header_fill = openpyxl.styles.PatternFill(start_color="6700CE", end_color="6700CE", fill_type="solid")
    header_font = openpyxl.styles.Font(color="FFFFFF", bold=True)
    for col_num in range(1, 6):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font

    # Sample rows
    sample_rows = [
        ["Aakash Sharma", "aakash.sharma@tataplay.com", "FIELD_WORKER", "Delhi", "North Region"],
        ["Vikram Sethi", "vikram.sethi@tataplay.com", "MANAGER", "Mumbai", "West Region"],
        ["Meera Iyer", "meera.iyer@tataplay.com", "FIELD_WORKER", "Bangalore", "South Region"]
    ]
    for row in sample_rows:
        ws.append(row)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    headers = {
        'Content-Disposition': 'attachment; filename="tataplay_user_onboarding_template.xlsx"'
    }
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

@router.post("/bulk-upload", response_model=BulkUploadPreviewResponse)
async def bulk_upload_users(
    file: UploadFile = File(...),
    commit: bool = Query(False, description="If true, commits valid rows to database"),
    current_user: User = Depends(require_regional_or_super_admin),
    db: Session = Depends(get_db)
):
    """
    Parses Excel spreadsheet (.xlsx), validates each row against database records and role permissions,
    and commits valid records if commit=True.
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel (.xlsx) file.")

    contents = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        ws = wb.active
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")

    rows = list(ws.iter_rows(values_only=True))
    if not rows or len(rows) < 2:
        raise HTTPException(status_code=400, detail="Excel file is empty or missing data rows.")

    header = [str(cell).strip().lower() if cell else "" for cell in rows[0]]
    # Expected header mapping
    name_idx = next((i for i, h in enumerate(header) if "name" in h), 0)
    email_idx = next((i for i, h in enumerate(header) if "email" in h), 1)
    role_idx = next((i for i, h in enumerate(header) if "role" in h), 2)
    city_idx = next((i for i, h in enumerate(header) if "city" in h), 3)
    region_idx = next((i for i, h in enumerate(header) if "region" in h), 4)

    # Pre-fetch lookup caches
    all_locations = {l.city.lower(): l for l in db.query(Location).all()}
    all_regions = {r.name.lower(): r for r in db.query(Region).all()}
    existing_emails = {u.email.lower() for u in db.query(User.email).all()}

    preview_rows: List[BulkUserRowPreview] = []
    valid_records_to_create = []

    seen_in_batch = set()

    for idx, row in enumerate(rows[1:], start=2):
        if not any(row):
            continue

        name = str(row[name_idx] or "").strip()
        email = str(row[email_idx] or "").strip().lower()
        role = str(row[role_idx] or "").strip().upper()
        city_str = str(row[city_idx] or "").strip()
        region_str = str(row[region_idx] or "").strip()

        row_errors = []

        if not name:
            row_errors.append("Name is required.")
        if not email or not re.match(EMAIL_REGEX, email):
            row_errors.append(f"Invalid email format '{email}'.")
        elif email in existing_emails or email in seen_in_batch:
            row_errors.append(f"Email '{email}' is already registered or duplicate.")

        valid_roles = [RoleEnum.SUPER_ADMIN.value, RoleEnum.REGIONAL_ADMIN.value, RoleEnum.MANAGER.value, RoleEnum.FIELD_WORKER.value]
        if role not in valid_roles:
            row_errors.append(f"Invalid role '{role}'. Must be one of: {', '.join(valid_roles)}")

        # Scope verification for Regional Admin
        if current_user.role == RoleEnum.REGIONAL_ADMIN.value:
            if role in [RoleEnum.SUPER_ADMIN.value, RoleEnum.REGIONAL_ADMIN.value]:
                row_errors.append("Regional Admin can only onboard Managers or Field Workers.")

        target_city = all_locations.get(city_str.lower())
        target_region = all_regions.get(region_str.lower())

        if role in [RoleEnum.MANAGER.value, RoleEnum.FIELD_WORKER.value]:
            if not target_city:
                row_errors.append(f"City '{city_str}' not found in registry.")
            elif current_user.role == RoleEnum.REGIONAL_ADMIN.value and target_city.region_id != current_user.region_id:
                row_errors.append(f"City '{city_str}' is outside your assigned region.")

        if role == RoleEnum.REGIONAL_ADMIN.value and not target_region:
            row_errors.append(f"Region '{region_str}' not found in registry.")

        is_valid = len(row_errors) == 0
        if is_valid:
            seen_in_batch.add(email)
            valid_records_to_create.append({
                "name": name,
                "email": email,
                "role": role,
                "region_id": target_region.region_id if target_region else (target_city.region_id if target_city else None),
                "city_id": target_city.location_id if target_city else None
            })

        preview_rows.append(BulkUserRowPreview(
            row_index=idx,
            name=name,
            email=email,
            role=role,
            city=city_str,
            region=region_str,
            is_valid=is_valid,
            errors=row_errors
        ))

    if commit and valid_records_to_create:
        default_pwd_hash = get_password_hash("tataplay123")
        for rec in valid_records_to_create:
            new_u = User(
                name=rec["name"],
                email=rec["email"],
                password_hash=default_pwd_hash,
                role=rec["role"],
                region_id=rec["region_id"] if rec["role"] == RoleEnum.REGIONAL_ADMIN.value else None,
                city_id=rec["city_id"] if rec["role"] in [RoleEnum.MANAGER.value, RoleEnum.FIELD_WORKER.value] else None
            )
            db.add(new_u)
        db.commit()
        log_audit(db, "BULK_USER_IMPORT", f"{current_user.name} imported {len(valid_records_to_create)} users via Excel batch.", current_user.user_id, current_user.name, current_user.role)

    valid_count = sum(1 for r in preview_rows if r.is_valid)
    error_count = len(preview_rows) - valid_count

    return BulkUploadPreviewResponse(
        total_rows=len(preview_rows),
        valid_count=valid_count,
        error_count=error_count,
        rows=preview_rows
    )

@router.put("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    req: UserResetPasswordRequest,
    current_user: User = Depends(require_regional_or_super_admin),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.user_id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    target_user.password_hash = get_password_hash(req.new_password)
    db.commit()

    log_audit(db, "PASSWORD_RESET", f"Password reset for '{target_user.email}' by {current_user.name}", current_user.user_id, current_user.name, current_user.role)
    return {"message": "Password reset successfully."}

@router.get("/enterprise-template")
def download_enterprise_template(
    staff_count: int = Query(600, description="Total field technicians to generate"),
    devices_per_worker: int = Query(6, description="Devices assigned per worker"),
    current_user: User = Depends(require_regional_or_super_admin)
):
    """
    Generates and downloads a multi-sheet enterprise Excel workbook (.xlsx)
    pre-populated with 600 Field Technicians + Managers + Admins, and ~3,600 serialized hardware assets.
    """
    wb = openpyxl.Workbook()

    # Define Styles
    header_fill = openpyxl.styles.PatternFill(start_color="1C023D", end_color="1C023D", fill_type="solid")
    header_font = openpyxl.styles.Font(color="FFFFFF", bold=True, size=11)
    meta_fill = openpyxl.styles.PatternFill(start_color="F3E8FF", end_color="F3E8FF", fill_type="solid")
    meta_font = openpyxl.styles.Font(color="6700CE", bold=True, size=11)

    # ----------------------------------------------------
    # Sheet 1: Personnel Roster
    # ----------------------------------------------------
    ws1 = wb.active
    ws1.title = "1_Personnel_Roster"

    user_headers = ["Employee ID", "Full Name", "Email Address", "Role", "Region", "City Hub", "Phone Number"]
    ws1.append(user_headers)
    for col_idx in range(1, len(user_headers) + 1):
        c = ws1.cell(row=1, column=col_idx)
        c.fill = header_fill
        c.font = header_font

    cities = [
        ("Delhi", "North Region"),
        ("Mumbai", "West Region"),
        ("Pune", "West Region"),
        ("Bangalore", "South Region"),
        ("Hyderabad", "South Region"),
        ("Chennai", "South Region"),
        ("Kolkata", "East Region")
    ]

    first_names = [
        "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
        "Shaurya", "Atharva", "Advik", "Pranav", "Advaith", "Aaryan", "Dhruv", "Kabir", "Rishi", "Darsh",
        "Ananya", "Diya", "Isha", "Rhea", "Tara", "Tanvi", "Sanya", "Kavya", "Pooja", "Neha",
        "Deepak", "Vikram", "Sunil", "Rajesh", "Amit", "Manoj", "Suresh", "Ramesh", "Pankaj", "Gaurav"
    ]
    last_names = [
        "Sharma", "Verma", "Gupta", "Malhotra", "Bhatia", "Saxena", "Mehta", "Chopra", "Joshi", "Patel",
        "Reddy", "Nair", "Iyer", "Rao", "Menon", "Mukherjee", "Chatterjee", "Banerjee", "Das", "Ghosh",
        "Kulkarni", "Deshmukh", "Patil", "Pawar", "Shinde", "Deshpande", "Gowda", "Shetty", "Pillai", "Singh"
    ]

    # Pre-add leadership
    leaders = [
        ["TPF-CORP-001", "Central Admin", "admin@tataplay.com", "SUPER_ADMIN", "National Central", "Central Headquarters", "+91 1800 209 0001"],
        ["TPF-REG-001", "North Admin", "north.admin@tataplay.com", "REGIONAL_ADMIN", "North Region", "Delhi", "+91 1800 209 0002"],
        ["TPF-REG-002", "West Admin", "west.admin@tataplay.com", "REGIONAL_ADMIN", "West Region", "Mumbai", "+91 1800 209 0003"],
        ["TPF-REG-003", "South Admin", "south.admin@tataplay.com", "REGIONAL_ADMIN", "South Region", "Bangalore", "+91 1800 209 0004"],
        ["TPF-REG-004", "East Admin", "east.admin@tataplay.com", "REGIONAL_ADMIN", "East Region", "Kolkata", "+91 1800 209 0005"],
        ["TPF-MGR-001", "Rajesh Kumar (Delhi Mgr)", "delhi@tataplay.com", "MANAGER", "North Region", "Delhi", "+91 98110 00001"],
        ["TPF-MGR-002", "Vikram Sethi (Mumbai Mgr)", "mumbai@tataplay.com", "MANAGER", "West Region", "Mumbai", "+91 98220 00002"],
        ["TPF-MGR-003", "Anand Kulkarni (Pune Mgr)", "pune@tataplay.com", "MANAGER", "West Region", "Pune", "+91 98330 00003"],
        ["TPF-MGR-004", "Suresh Rao (Bangalore Mgr)", "bangalore@tataplay.com", "MANAGER", "South Region", "Bangalore", "+91 98440 00004"],
        ["TPF-MGR-005", "Venkat Reddy (Hyderabad Mgr)", "hyderabad@tataplay.com", "MANAGER", "South Region", "Hyderabad", "+91 98550 00005"],
        ["TPF-MGR-006", "Karthik Nair (Chennai Mgr)", "chennai@tataplay.com", "MANAGER", "South Region", "Chennai", "+91 98660 00006"],
        ["TPF-MGR-007", "Subhash Das (Kolkata Mgr)", "kolkata@tataplay.com", "MANAGER", "East Region", "Kolkata", "+91 98770 00007"]
    ]
    for row in leaders:
        ws1.append(row)

    # Generate 600 Field Workers
    field_workers = []
    for i in range(1, staff_count + 1):
        fn = first_names[(i - 1) % len(first_names)]
        ln = last_names[((i - 1) * 3) % len(last_names)]
        name = f"{fn} {ln}"
        emp_id = f"TPF-EMP-{1000 + i}"
        email = f"worker{1000 + i}@tataplay.com"
        city, region = cities[(i - 1) % len(cities)]
        phone = f"+91 98{i % 90 + 10:02d} {i:05d}"
        row = [emp_id, name, email, "FIELD_WORKER", region, city, phone]
        ws1.append(row)
        field_workers.append({"emp_id": emp_id, "name": name, "email": email, "city": city, "region": region})

    # Auto-width
    for col in ws1.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws1.column_dimensions[col_letter].width = max(max_len + 3, 14)

    # ----------------------------------------------------
    # Sheet 2: Serialized Hardware Kits (6 Devices per worker)
    # ----------------------------------------------------
    ws2 = wb.create_sheet(title="2_Serialized_Hardware_Kits")
    asset_headers = [
        "Serial Number", "Equipment Name", "Variant / Model", 
        "Category", "Unit Cost (INR)", "Assigned Employee Email / ID", 
        "Status", "City Hub"
    ]
    ws2.append(asset_headers)
    for col_idx in range(1, len(asset_headers) + 1):
        c = ws2.cell(row=1, column=col_idx)
        c.fill = header_fill
        c.font = header_font

    standard_kit_templates = [
        ("Nokia Dual-Band Wi-Fi 6 GPON ONT", "G-140W-F Gigabit Optical", "CPE Modems", 4500, "NOK"),
        ("Precision Fiber Core Alignment Splicer", "FS-60S High Precision Core", "Splicing Equipment", 85000, "CLP"),
        ("Smart Handheld Optical Time-Domain Reflectometer", "OTDR-Mini 1310/1550nm Range", "Testing & Measurement", 32000, "OTDR"),
        ("High-Precision Optical Power Meter", "OPM-PRO (-70 to +10 dBm)", "Testing & Measurement", 3800, "OPM"),
        ("Visual Fault Locator Laser Pen", "VFL-Red Beam 650nm (20mW)", "Field Tools", 1200, "VFL"),
        ("Single-Action Optical Fiber Cleaver", "FC-6S High Stability Blade", "Field Tools", 4200, "FC")
    ]

    serial_counter = 10001
    for w in field_workers:
        for idx, (eq_name, var_name, cat, cost, prefix) in enumerate(standard_kit_templates[:devices_per_worker]):
            sn = f"TPF-{prefix}-{serial_counter}"
            serial_counter += 1
            ws2.append([sn, eq_name, var_name, cat, cost, w["email"], "ASSIGNED", w["city"]])

    # Add 50 unassigned spare warehouse units per city
    for city, _ in cities:
        for idx in range(1, 11):
            sn = f"TPF-SPARE-{city[:3].upper()}-{serial_counter}"
            serial_counter += 1
            ws2.append([sn, "Fiber Optic Drop Cable Spool (1km)", "Single-Mode G.657A2 Drop", "Consumables & Cables", 14500, "", "IN_WAREHOUSE", city])

    for col in ws2.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws2.column_dimensions[col_letter].width = max(max_len + 3, 14)

    # ----------------------------------------------------
    # Sheet 3: AI Prompt & Format Instructions
    # ----------------------------------------------------
    ws3 = wb.create_sheet(title="3_AI_Prompt_&_Instructions")
    ws3.column_dimensions["A"].width = 110

    guidelines = [
        ["TATA PLAY FIBER - ENTERPRISE DATASET INGESTION PROTOCOL"],
        [""],
        ["HOW TO USE THIS WORKBOOK:"],
        ["1. Sheet 1 ('1_Personnel_Roster'): Contains all system users, including Super Admins, Regional Admins, City Managers, and Field Workers."],
        ["2. Sheet 2 ('2_Serialized_Hardware_Kits'): Contains serialized devices (6-7 devices per technician). Link each device using 'Assigned Employee Email / ID'."],
        ["3. Upload this completed Excel file via the StockSentry 'Excel Bulk Onboarding' dashboard to automatically populate the enterprise database."],
        [""],
        ["PROMPT TO GENERATE CUSTOM DATASETS WITH AI (CHATGPT / GEMINI / CLAUDE):"],
        ["\"Generate an Excel-compatible dataset with 2 sheets for Tata Play Fiber telecommunications inventory:"],
        ["Sheet 1 ('1_Personnel_Roster') with columns: Employee ID, Full Name, Email Address, Role, Region, City Hub, Phone Number."],
        ["- Include 1 Super Admin, 4 Regional Admins, 7 City Managers (Delhi, Mumbai, Pune, Bangalore, Hyderabad, Chennai, Kolkata), and 600 Field Workers."],
        ["Sheet 2 ('2_Serialized_Hardware_Kits') with columns: Serial Number, Equipment Name, Variant / Model, Category, Unit Cost (INR), Assigned Employee Email / ID, Status, City Hub."],
        ["- Give each field worker 6 devices: 1x Nokia GPON ONT Modem, 1x Fusion Splicer, 1x OTDR, 1x Optical Power Meter, 1x VFL Laser Pen, 1x Fiber Cleaver."],
        ["- Ensure all Serial Numbers are unique and format matching TPF-NOK-*, TPF-CLP-*, etc.\""],
        [""],
        ["ALLOWED ROLES: SUPER_ADMIN, REGIONAL_ADMIN, MANAGER, FIELD_WORKER"],
        ["ALLOWED REGIONS: North Region, West Region, South Region, East Region"],
        ["ALLOWED CITY HUBS: Delhi, Mumbai, Pune, Bangalore, Hyderabad, Chennai, Kolkata"]
    ]
    for g in guidelines:
        ws3.append(g)

    ws3.cell(row=1, column=1).font = openpyxl.styles.Font(bold=True, size=14, color="1C023D")

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    headers = {
        'Content-Disposition': f'attachment; filename="tataplay_enterprise_{staff_count}_staff_with_kits.xlsx"'
    }
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

@router.post("/bulk-upload-enterprise", response_model=EnterpriseIngestSummary)
async def bulk_upload_enterprise_workbook(
    file: UploadFile = File(...),
    commit: bool = Query(False, description="If true, commits users and serialized assets to database"),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Ingests enterprise-scale multi-sheet workbooks:
    - Sheet 1: Personnel Roster (Admins, Managers, Field Technicians)
    - Sheet 2: Serialized Hardware Assets (Linked to workers with kit devices)
    Automatically provisions users, creates hardware items/variants, binds custody,
    records immutable lifecycle events, and updates inventory.
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel (.xlsx) file.")

    contents = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel workbook: {str(e)}")

    sheet_names = wb.sheetnames

    # Identify sheets
    personnel_sheet = None
    assets_sheet = None

    for s in sheet_names:
        s_lower = s.lower()
        if "personnel" in s_lower or "employee" in s_lower or "user" in s_lower:
            personnel_sheet = wb[s]
        elif "asset" in s_lower or "hardware" in s_lower or "kit" in s_lower or "device" in s_lower:
            assets_sheet = wb[s]

    if not personnel_sheet:
        personnel_sheet = wb.active # Fallback to first sheet

    all_locations = {l.city.lower(): l for l in db.query(Location).all()}
    all_regions = {r.name.lower(): r for r in db.query(Region).all()}
    existing_users_by_email = {u.email.lower(): u for u in db.query(User).all()}

    # 1. Parse Personnel
    p_rows = list(personnel_sheet.iter_rows(values_only=True))
    if not p_rows or len(p_rows) < 2:
        raise HTTPException(status_code=400, detail="Personnel sheet is empty or missing data.")

    p_header = [str(c).strip().lower() if c else "" for c in p_rows[0]]
    emp_id_idx = next((i for i, h in enumerate(p_header) if "id" in h), 0)
    name_idx = next((i for i, h in enumerate(p_header) if "name" in h), 1)
    email_idx = next((i for i, h in enumerate(p_header) if "email" in h), 2)
    role_idx = next((i for i, h in enumerate(p_header) if "role" in h), 3)
    region_idx = next((i for i, h in enumerate(p_header) if "region" in h), 4)
    city_idx = next((i for i, h in enumerate(p_header) if "city" in h), 5)

    created_users = []
    users_by_identifier = {} # Maps emp_id and email to user object / record

    default_pwd_hash = get_password_hash("tataplay123")

    for row in p_rows[1:]:
        if not any(row):
            continue
        emp_id = str(row[emp_id_idx] or "").strip()
        name = str(row[name_idx] or "").strip()
        email = str(row[email_idx] or "").strip().lower()
        role = str(row[role_idx] or "").strip().upper()
        city_str = str(row[city_idx] or "").strip()
        region_str = str(row[region_idx] or "").strip()

        if not name or not email or not re.match(EMAIL_REGEX, email):
            continue

        valid_roles = [RoleEnum.SUPER_ADMIN.value, RoleEnum.REGIONAL_ADMIN.value, RoleEnum.MANAGER.value, RoleEnum.FIELD_WORKER.value]
        if role not in valid_roles:
            role = RoleEnum.FIELD_WORKER.value

        target_city = all_locations.get(city_str.lower())
        target_region = all_regions.get(region_str.lower())
        if not target_region and target_city:
            target_region = all_regions.get(target_city.region.name.lower() if target_city.region else "")

        u_obj = existing_users_by_email.get(email)
        if not u_obj:
            u_data = {
                "name": name,
                "email": email,
                "role": role,
                "region_id": target_region.region_id if target_region else (target_city.region_id if target_city else None),
                "city_id": target_city.location_id if target_city else None,
                "is_active": 1
            }
            if commit:
                new_u = User(
                    name=u_data["name"],
                    email=u_data["email"],
                    password_hash=default_pwd_hash,
                    role=u_data["role"],
                    region_id=u_data["region_id"] if u_data["role"] == RoleEnum.REGIONAL_ADMIN.value else None,
                    city_id=u_data["city_id"] if u_data["role"] in [RoleEnum.MANAGER.value, RoleEnum.FIELD_WORKER.value] else None,
                    is_active=1
                )
                db.add(new_u)
                db.flush()
                u_obj = new_u
                existing_users_by_email[email] = new_u
            created_users.append(u_data)
        
        users_by_identifier[email] = u_obj
        if emp_id:
            users_by_identifier[emp_id.lower()] = u_obj

    # 2. Parse Assets if asset sheet exists
    total_devices = 0
    assigned_devices = 0
    warehouse_devices = 0
    total_valuation = 0.0
    sample_assets = []

    if assets_sheet:
        a_rows = list(assets_sheet.iter_rows(values_only=True))
        if len(a_rows) >= 2:
            a_header = [str(c).strip().lower() if c else "" for c in a_rows[0]]
            sn_idx = next((i for i, h in enumerate(a_header) if "serial" in h), 0)
            item_idx = next((i for i, h in enumerate(a_header) if "equipment" in h or "item" in h or "name" in h), 1)
            var_idx = next((i for i, h in enumerate(a_header) if "variant" in h or "model" in h), 2)
            cat_idx = next((i for i, h in enumerate(a_header) if "category" in h), 3)
            cost_idx = next((i for i, h in enumerate(a_header) if "cost" in h or "valuation" in h or "price" in h), 4)
            assign_idx = next((i for i, h in enumerate(a_header) if "assigned" in h or "employee" in h or "holder" in h), 5)
            status_idx = next((i for i, h in enumerate(a_header) if "status" in h), 6)
            city_a_idx = next((i for i, h in enumerate(a_header) if "city" in h or "hub" in h or "location" in h), 7)

            existing_serials = {a.serial_number for a in db.query(AssetUnit.serial_number).all()}
            item_cache = {(it.name.lower(), it.category.lower()): it for it in db.query(Item).all()}
            variant_cache = {(v.item_id, v.variant_name.lower()): v for v in db.query(ItemVariant).all()}

            for row in a_rows[1:]:
                if not any(row):
                    continue
                sn = str(row[sn_idx] or "").strip()
                if not sn or sn in existing_serials:
                    continue

                item_name = str(row[item_idx] or "").strip() or "Standard Optical Equipment"
                var_name = str(row[var_idx] or "").strip() or "Standard Model"
                cat_name = str(row[cat_idx] or "").strip() or "CPE Modems"
                try:
                    cost_val = float(row[cost_idx] or 0.0)
                except Exception:
                    cost_val = 4500.0

                assigned_to = str(row[assign_idx] or "").strip().lower()
                status_str = str(row[status_idx] or "").strip().upper() or "IN_WAREHOUSE"
                hub_city_str = str(row[city_a_idx] or "").strip()

                target_city = all_locations.get(hub_city_str.lower())
                assigned_user = users_by_identifier.get(assigned_to)

                holder_id = assigned_user.user_id if assigned_user and hasattr(assigned_user, 'user_id') else None
                if holder_id and status_str != "IN_REPAIR":
                    status_str = "ASSIGNED"

                total_devices += 1
                total_valuation += cost_val
                if holder_id:
                    assigned_devices += 1
                else:
                    warehouse_devices += 1

                if len(sample_assets) < 10:
                    sample_assets.append({"serial": sn, "item": item_name, "holder": assigned_to, "city": hub_city_str})

                if commit:
                    # Ensure Item
                    item_key = (item_name.lower(), cat_name.lower())
                    it_obj = item_cache.get(item_key)
                    if not it_obj:
                        it_obj = Item(name=item_name, category=cat_name, is_serialized=True, description="Batch ingested hardware")
                        db.add(it_obj)
                        db.flush()
                        item_cache[item_key] = it_obj

                    # Ensure Variant
                    var_key = (it_obj.item_id, var_name.lower())
                    var_obj = variant_cache.get(var_key)
                    if not var_obj:
                        var_obj = ItemVariant(item_id=it_obj.item_id, variant_name=var_name, unit_cost=cost_val)
                        db.add(var_obj)
                        db.flush()
                        variant_cache[var_key] = var_obj

                    # Create AssetUnit
                    new_asset = AssetUnit(
                        variant_id=var_obj.variant_id,
                        serial_number=sn,
                        status=status_str,
                        current_holder_id=holder_id,
                        current_location_id=target_city.location_id if target_city else None
                    )
                    db.add(new_asset)
                    db.flush()

                    # Lifecycle Events
                    ev1 = AssetLifecycleEvent(
                        asset_id=new_asset.asset_id,
                        event_type="REGISTERED",
                        from_location_id=None,
                        to_location_id=target_city.location_id if target_city else None,
                        performed_by=current_user.user_id,
                        notes=f"Enterprise Batch Ingestion: Serialized into {hub_city_str or 'Central'} pool.",
                        timestamp=datetime.utcnow()
                    )
                    db.add(ev1)

                    if holder_id:
                        ev2 = AssetLifecycleEvent(
                            asset_id=new_asset.asset_id,
                            event_type="ASSIGNED",
                            to_holder_id=holder_id,
                            from_location_id=target_city.location_id if target_city else None,
                            to_location_id=target_city.location_id if target_city else None,
                            performed_by=current_user.user_id,
                            notes=f"Assigned tool kit device to personnel {assigned_to}.",
                            timestamp=datetime.utcnow()
                        )
                        db.add(ev2)

                    existing_serials.add(sn)

    if commit:
        db.commit()
        log_audit(
            db, 
            "ENTERPRISE_BATCH_INGESTION", 
            f"Ingested {len(created_users)} personnel and {total_devices} serialized devices (Valuation: ₹{total_valuation:,.2f})", 
            current_user.user_id, 
            current_user.name, 
            current_user.role
        )

    return EnterpriseIngestSummary(
        total_users_created=len(created_users),
        total_devices_created=total_devices,
        total_devices_assigned=assigned_devices,
        total_warehouse_stock_added=warehouse_devices,
        total_valuation_inr=total_valuation,
        message=f"Successfully {'committed' if commit else 'validated'} {len(created_users)} personnel and {total_devices} serialized units across 7 city hubs!",
        sample_users=[{"name": u["name"], "email": u["email"], "role": u["role"]} for u in created_users[:8]],
        sample_devices=sample_assets
    )

@router.get("/crm-config")
def get_lakshya_crm_config(
    current_user: User = Depends(get_current_user)
):
    """
    Returns configured My Lakshya App / CRM Gateway status.
    """
    import os
    configured_url = os.getenv("LAKSHYA_CRM_URL", DEFAULT_LAKSHYA_CRM_URL)
    has_api_key = bool(os.getenv("LAKSHYA_API_KEY"))
    return {
        "system": "My Lakshya App - Tata Play Fiber CRM",
        "crm_url": configured_url,
        "is_configured": True,
        "has_api_key": has_api_key,
        "supported_roles": ["FIELD_WORKER", "MANAGER"],
        "telecom_circles": ["Delhi", "Mumbai", "Bengaluru", "Kolkata", "Chennai", "Hyderabad", "Pune"],
        "status": "ONLINE"
    }

@router.post("/sync-lakshya", response_model=LakshyaSyncResponse)
def sync_workforce_from_lakshya(
    payload: Optional[LakshyaSyncRequest] = None,
    current_user: User = Depends(require_regional_or_super_admin),
    db: Session = Depends(get_db)
):
    """
    Synchronizes workforce records from My Lakshya App / Tata Play Fiber CRM.
    Supports real CRM URL with seamless local simulation fallback.
    Authorized for Super Admin and Regional Admin.
    """
    req_url = payload.crm_url if payload else None
    req_key = payload.api_key if payload else None

    result = sync_lakshya_workforce_to_db(
        db=db,
        crm_url=req_url,
        api_key=req_key,
        sync_user_id=current_user.user_id
    )

    return LakshyaSyncResponse(**result)
