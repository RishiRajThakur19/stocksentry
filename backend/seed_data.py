import os
import secrets
import logging
import asyncio
from datetime import datetime
from app.database import SessionLocal, engine, Base
from app.models import (
    Region, Location, Item, ItemVariant, AssetUnit, AssetStatusEnum, 
    InventoryStock, User, RoleEnum, RequestModel, RequestStatusEnum, Alert,
    RepairLocation, AssetComplaint, RepairRequest, AssetLifecycleEvent
)
from app.auth import get_password_hash
from app.engine import check_and_update_threshold_alerts

logger = logging.getLogger("stocksentry.seed")

async def seed_database(force_reseed: bool = False):
    if force_reseed:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if not force_reseed and db.query(Region).count() > 0:
            logger.info("Database already seeded with Regions and 4-Tier Roles. Skipping.")
            return

        logger.info("Seeding StockSentry 4-Tier Role, Region Hierarchy & Serialized Assets database...")

        # 1. Create Regions
        regions_data = [
            "North Region",
            "West Region",
            "South Region",
            "East Region"
        ]
        region_objs = {}
        for r_name in regions_data:
            reg = Region(name=r_name)
            db.add(reg)
            db.commit()
            db.refresh(reg)
            region_objs[r_name] = reg

        # 2. Create City Locations for Manager Territories linked to Regions
        cities_data = [
            ("Delhi Regional Hub", "Delhi", "North Region", 28.6139, 77.2090),
            ("Mumbai Main Hub", "Mumbai", "West Region", 19.0760, 72.8777),
            ("Pune West Hub", "Pune", "West Region", 18.5204, 73.8567),
            ("Bangalore Tech Park Hub", "Bangalore", "South Region", 12.9716, 77.5946),
            ("Hyderabad Metro Hub", "Hyderabad", "South Region", 17.3850, 78.4867),
            ("Chennai Central Hub", "Chennai", "South Region", 13.0827, 80.2707),
            ("Kolkata Eastern Hub", "Kolkata", "East Region", 22.5726, 88.3639),
        ]

        loc_objs = {}
        for name, city, reg_name, lat, lng in cities_data:
            loc = Location(
                name=name, 
                city=city, 
                region_id=region_objs[reg_name].region_id, 
                latitude=lat, 
                longitude=lng
            )
            db.add(loc)
            db.commit()
            db.refresh(loc)
            loc_objs[city] = loc

        # 3. Create Users Across 4 Tiers
        admin_pass = os.getenv("INITIAL_ADMIN_PASSWORD") or "admin123"
        mgr_pass = os.getenv("INITIAL_MANAGER_PASSWORD") or "manager123"
        worker_pass = "worker123"

        # Tier 1: SUPER_ADMIN
        super_admin = User(
            name="Super Admin (Central Warehouse)",
            email="admin@tataplay.com",
            password_hash=get_password_hash(admin_pass),
            role=RoleEnum.SUPER_ADMIN.value,
            region_id=None,
            city_id=None
        )
        db.add(super_admin)

        # Tier 2: REGIONAL_ADMIN (North, West, South)
        reg_admins = [
            ("Vikram Malhotra", "north.admin@tataplay.com", region_objs["North Region"].region_id),
            ("Rohit Deshmukh", "west.admin@tataplay.com", region_objs["West Region"].region_id),
            ("Deepak Menon", "south.admin@tataplay.com", region_objs["South Region"].region_id),
        ]
        for name, email, reg_id in reg_admins:
            u = User(
                name=name,
                email=email,
                password_hash=get_password_hash(admin_pass),
                role=RoleEnum.REGIONAL_ADMIN.value,
                region_id=reg_id,
                city_id=None
            )
            db.add(u)

        # Tier 3: MANAGERS (1 per City Hub)
        managers_info = [
            ("Rajesh Kumar", "delhi@tataplay.com", loc_objs["Delhi"].location_id),
            ("Priya Sharma", "mumbai@tataplay.com", loc_objs["Mumbai"].location_id),
            ("Sanjay Deshmukh", "pune@tataplay.com", loc_objs["Pune"].location_id),
            ("Anish Nair", "bangalore@tataplay.com", loc_objs["Bangalore"].location_id),
            ("Suresh Reddy", "hyderabad@tataplay.com", loc_objs["Hyderabad"].location_id),
            ("Kavitha Raman", "chennai@tataplay.com", loc_objs["Chennai"].location_id),
            ("Amitabh Banerjee", "kolkata@tataplay.com", loc_objs["Kolkata"].location_id),
        ]
        mgr_objs = {}
        for name, email, loc_id in managers_info:
            u = User(
                name=name,
                email=email,
                password_hash=get_password_hash(mgr_pass),
                role=RoleEnum.MANAGER.value,
                region_id=None,
                city_id=loc_id
            )
            db.add(u)
            db.commit()
            db.refresh(u)
            mgr_objs[email] = u

            # Link manager_id on Location
            loc = db.query(Location).filter(Location.location_id == loc_id).first()
            if loc:
                loc.manager_id = u.user_id
                db.commit()

        # Tier 4: FIELD_WORKERS (Sales / Technicians)
        field_workers_info = [
            ("Amit Verma (Field Tech)", "delhi.worker@tataplay.com", loc_objs["Delhi"].location_id),
            ("Rahul Patil (Field Tech)", "mumbai.worker@tataplay.com", loc_objs["Mumbai"].location_id),
            ("Karthik Gowda (Field Tech)", "bangalore.worker@tataplay.com", loc_objs["Bangalore"].location_id),
            ("Vikram Sharma (Senior Field Tech)", "vikram.exit@tataplay.com", loc_objs["Delhi"].location_id),
        ]
        worker_objs = {}
        for name, email, loc_id in field_workers_info:
            u = User(
                name=name,
                email=email,
                password_hash=get_password_hash(worker_pass),
                role=RoleEnum.FIELD_WORKER.value,
                region_id=None,
                city_id=loc_id
            )
            db.add(u)
            db.commit()
            db.refresh(u)
            worker_objs[email] = u

        db.commit()

        # 4. Product Catalog: CONSUMABLES (is_serialized=False)
        # Category A: Fiber Cables & Drop Lines
        cables_item = Item(
            name="Fiber Optic Drop Cable", 
            category="Cables & Wiring",
            description="Armored low-loss optical fiber drop line with steel strength messenger wire",
            is_serialized=False
        )
        db.add(cables_item)
        db.commit()
        cables_variants = [
            ItemVariant(item_id=cables_item.item_id, variant_name="1-Core Armored (1000m Drum)", unit_cost=3400.0, reorder_threshold=40, reorder_quantity=100),
            ItemVariant(item_id=cables_item.item_id, variant_name="2-Core Aerial Flat (500m Reel)", unit_cost=2200.0, reorder_threshold=50, reorder_quantity=120),
            ItemVariant(item_id=cables_item.item_id, variant_name="24-Core Outdoor Trunk (2000m Drum)", unit_cost=18500.0, reorder_threshold=10, reorder_quantity=25),
        ]
        db.add_all(cables_variants)

        # Patch Cords
        patch_item = Item(
            name="Optical Fiber Patch Cords", 
            category="Cables & Wiring",
            description="Ultra low-loss single-mode bend-insensitive SC/APC fiber patch cables",
            is_serialized=False
        )
        db.add(patch_item)
        db.commit()
        patch_variants = [
            ItemVariant(item_id=patch_item.item_id, variant_name="SC/APC Simplex 3m", unit_cost=120.0, reorder_threshold=300, reorder_quantity=800),
            ItemVariant(item_id=patch_item.item_id, variant_name="SC/APC Simplex 10m", unit_cost=210.0, reorder_threshold=200, reorder_quantity=500),
            ItemVariant(item_id=patch_item.item_id, variant_name="SC/APC to LC/UPC Duplex 5m", unit_cost=280.0, reorder_threshold=150, reorder_quantity=400),
        ]
        db.add_all(patch_variants)

        # Category B: Passive Optical Splitters & Distribution
        splitter_item = Item(
            name="PLC Optical Splitter", 
            category="Accessories",
            description="Planar Lightwave Circuit optical power splitter with SC/APC connectors",
            is_serialized=False
        )
        db.add(splitter_item)
        db.commit()
        splitter_variants = [
            ItemVariant(item_id=splitter_item.item_id, variant_name="1:8 Steel Tube SC/APC", unit_cost=380.0, reorder_threshold=100, reorder_quantity=300),
            ItemVariant(item_id=splitter_item.item_id, variant_name="1:16 ABS Box SC/APC", unit_cost=750.0, reorder_threshold=60, reorder_quantity=150),
            ItemVariant(item_id=splitter_item.item_id, variant_name="1:4 Mini Module SC/APC", unit_cost=240.0, reorder_threshold=80, reorder_quantity=200),
        ]
        db.add_all(splitter_variants)

        # Distribution Boxes & Closures
        fat_box_item = Item(
            name="Fiber Distribution Hub & Closures", 
            category="Accessories",
            description="Weatherproof IP68 outdoor pole & wall mount Fiber Access Terminal (FAT) boxes",
            is_serialized=False
        )
        db.add(fat_box_item)
        db.commit()
        fat_box_variants = [
            ItemVariant(item_id=fat_box_item.item_id, variant_name="16-Port FAT / NAP Box", unit_cost=1450.0, reorder_threshold=40, reorder_quantity=100),
            ItemVariant(item_id=fat_box_item.item_id, variant_name="Dome Splice Closure 48-Fiber IP68", unit_cost=2600.0, reorder_threshold=25, reorder_quantity=60),
            ItemVariant(item_id=fat_box_item.item_id, variant_name="24-Port Rackmount ODF", unit_cost=3200.0, reorder_threshold=15, reorder_quantity=40),
        ]
        db.add_all(fat_box_variants)

        # Category C: Installation Accessories & Hardware
        ties_item = Item(
            name="Industrial Cable Zip Ties", 
            category="Accessories",
            description="Weather-resistant UV-stabilized heavy-duty nylon ties for pole/riser cabling",
            is_serialized=False
        )
        db.add(ties_item)
        db.commit()
        ties_variant = ItemVariant(item_id=ties_item.item_id, variant_name="Pack of 500 (300mm)", unit_cost=350.0, reorder_threshold=150, reorder_quantity=600)
        db.add(ties_variant)

        hardware_item = Item(
            name="Field Installation Hardware", 
            category="Accessories",
            description="Galvanized steel pole suspension brackets, drop clamps, and fiber protection",
            is_serialized=False
        )
        db.add(hardware_item)
        db.commit()
        hardware_variants = [
            ItemVariant(item_id=hardware_item.item_id, variant_name="Stainless Steel Drop Wire Clamps (200-pk)", unit_cost=850.0, reorder_threshold=80, reorder_quantity=250),
            ItemVariant(item_id=hardware_item.item_id, variant_name="Heat Shrink Sleeves 60mm (1000-pk)", unit_cost=420.0, reorder_threshold=120, reorder_quantity=400),
            ItemVariant(item_id=hardware_item.item_id, variant_name="99.9% IPA Cleaning Wipes Tub (100 wipes)", unit_cost=290.0, reorder_threshold=90, reorder_quantity=300),
        ]
        db.add_all(hardware_variants)

        # Category D: Uniforms & Safety Equipment
        tshirt_item = Item(
            name="Tata Play Field Technician Uniform", 
            category="Apparel",
            description="High-grade breathable moisture-wicking branded uniform field staff polo",
            is_serialized=False
        )
        db.add(tshirt_item)
        db.commit()
        tshirt_variants = [
            ItemVariant(item_id=tshirt_item.item_id, variant_name="Polo Shirt (Size M)", unit_cost=450.0, reorder_threshold=60, reorder_quantity=150),
            ItemVariant(item_id=tshirt_item.item_id, variant_name="Polo Shirt (Size L)", unit_cost=450.0, reorder_threshold=60, reorder_quantity=150),
            ItemVariant(item_id=tshirt_item.item_id, variant_name="Polo Shirt (Size XL)", unit_cost=450.0, reorder_threshold=50, reorder_quantity=120),
        ]
        db.add_all(tshirt_variants)

        safety_item = Item(
            name="Field Safety Gear & Apparel", 
            category="Apparel",
            description="High-visibility safety vests with reflective stripes & certified industrial hard hats",
            is_serialized=False
        )
        db.add(safety_item)
        db.commit()
        safety_variants = [
            ItemVariant(item_id=safety_item.item_id, variant_name="High-Vis Reflective Safety Vest (Class 2)", unit_cost=320.0, reorder_threshold=50, reorder_quantity=150),
            ItemVariant(item_id=safety_item.item_id, variant_name="Industrial Helmet with Chin Strap", unit_cost=650.0, reorder_threshold=40, reorder_quantity=100),
            ItemVariant(item_id=safety_item.item_id, variant_name="Ballistic Nylon Field Tool Backpack", unit_cost=1450.0, reorder_threshold=30, reorder_quantity=80),
        ]
        db.add_all(safety_variants)

        db.commit()

        # Consumables Stock Seeding
        all_consumable_variants = (
            cables_variants + 
            patch_variants + 
            splitter_variants + 
            fat_box_variants + 
            [ties_variant] + 
            hardware_variants + 
            tshirt_variants + 
            safety_variants
        )

        consumable_stock = {
            "Fiber Optic Drop Cable - 1-Core Armored (1000m Drum)": 140,
            "Fiber Optic Drop Cable - 2-Core Aerial Flat (500m Reel)": 210,
            "Fiber Optic Drop Cable - 24-Core Outdoor Trunk (2000m Drum)": 38,
            "Optical Fiber Patch Cords - SC/APC Simplex 3m": 1420,
            "Optical Fiber Patch Cords - SC/APC Simplex 10m": 850,
            "Optical Fiber Patch Cords - SC/APC to LC/UPC Duplex 5m": 620,
            "PLC Optical Splitter - 1:8 Steel Tube SC/APC": 480,
            "PLC Optical Splitter - 1:16 ABS Box SC/APC": 215,
            "PLC Optical Splitter - 1:4 Mini Module SC/APC": 310,
            "Fiber Distribution Hub & Closures - 16-Port FAT / NAP Box": 165,
            "Fiber Distribution Hub & Closures - Dome Splice Closure 48-Fiber IP68": 84,
            "Fiber Distribution Hub & Closures - 24-Port Rackmount ODF": 46,
            "Industrial Cable Zip Ties - Pack of 500 (300mm)": 920,
            "Field Installation Hardware - Stainless Steel Drop Wire Clamps (200-pk)": 340,
            "Field Installation Hardware - Heat Shrink Sleeves 60mm (1000-pk)": 580,
            "Field Installation Hardware - 99.9% IPA Cleaning Wipes Tub (100 wipes)": 410,
            "Tata Play Field Technician Uniform - Polo Shirt (Size M)": 320,
            "Tata Play Field Technician Uniform - Polo Shirt (Size L)": 380,
            "Tata Play Field Technician Uniform - Polo Shirt (Size XL)": 240,
            "Field Safety Gear & Apparel - High-Vis Reflective Safety Vest (Class 2)": 260,
            "Field Safety Gear & Apparel - Industrial Helmet with Chin Strap": 190,
            "Field Safety Gear & Apparel - Ballistic Nylon Field Tool Backpack": 115,
        }

        for v in all_consumable_variants:
            k = f"{v.item.name} - {v.variant_name}"
            qty = consumable_stock.get(k, 120)
            stock = InventoryStock(variant_id=v.variant_id, current_quantity=qty)
            db.add(stock)

        db.commit()

        # 5. Product Catalog: SERIALIZED ASSETS (is_serialized=True)
        # Serialized Item 1: Nokia Wi-Fi 6 GPON ONT
        nokia_item = Item(
            name="Fiber Modem - Nokia GPON ONT", 
            category="Networking",
            description="High-speed Gigabit GPON Dual-Band Wi-Fi 6 Customer Premises Equipment (CPE) with VoIP ports",
            is_serialized=True
        )
        db.add(nokia_item)
        db.commit()
        nokia_variant = ItemVariant(item_id=nokia_item.item_id, variant_name="Dual-Band Wi-Fi 6 (G-2425G-A)", unit_cost=3800.0, reorder_threshold=100, reorder_quantity=250)
        db.add(nokia_variant)
        db.commit()

        # Seed 185 AssetUnit rows for Nokia Modem
        for i in range(1, 186):
            db.add(AssetUnit(
                variant_id=nokia_variant.variant_id,
                serial_number=f"TPF-NOK-W6-{10000 + i}",
                status=AssetStatusEnum.IN_WAREHOUSE.value
            ))

        # Serialized Item 2: Huawei OptiXstar Wi-Fi 6 ONT
        huawei_item = Item(
            name="Fiber Modem - Huawei OptiXstar", 
            category="Networking",
            description="Carrier-grade Gigabit GPON terminal with 4 GE ports + 2 POTS + Wi-Fi 6 AX3000",
            is_serialized=True
        )
        db.add(huawei_item)
        db.commit()
        huawei_variant = ItemVariant(item_id=huawei_item.item_id, variant_name="OptiXstar AX3000 (HG8145X6)", unit_cost=4200.0, reorder_threshold=80, reorder_quantity=200)
        db.add(huawei_variant)
        db.commit()

        # Seed 140 AssetUnit rows for Huawei Modem
        for i in range(1, 141):
            db.add(AssetUnit(
                variant_id=huawei_variant.variant_id,
                serial_number=f"TPF-HUA-AX-{20000 + i}",
                status=AssetStatusEnum.IN_WAREHOUSE.value
            ))

        # Serialized Item 3: Syrotech Gigabit ONT (Low Stock breach: 45 units vs threshold 60)
        syrotech_item = Item(
            name="Fiber Modem - Syrotech GPON", 
            category="Networking",
            description="Standard Gigabit GPON ONT with 1 GE + 1 FE + 1 VoIP port for residential subscriber connections",
            is_serialized=True
        )
        db.add(syrotech_item)
        db.commit()
        syrotech_variant = ItemVariant(item_id=syrotech_item.item_id, variant_name="Gigabit Dual-Band AC1200", unit_cost=2950.0, reorder_threshold=60, reorder_quantity=150)
        db.add(syrotech_variant)
        db.commit()

        # Seed 45 AssetUnit rows for Syrotech Modem (Low Stock Breach)
        for i in range(1, 46):
            db.add(AssetUnit(
                variant_id=syrotech_variant.variant_id,
                serial_number=f"TPF-SYR-AC-{30000 + i}",
                status=AssetStatusEnum.IN_WAREHOUSE.value
            ))

        # Serialized Item 4: TP-Link Archer Gigabit Mesh Router
        tplink_item = Item(
            name="Gigabit Wi-Fi Router - TP-Link", 
            category="Networking",
            description="Enterprise High-Gain Dual Band MU-MIMO Gigabit Wi-Fi Router with OneMesh compatibility",
            is_serialized=True
        )
        db.add(tplink_item)
        db.commit()
        tplink_variant = ItemVariant(item_id=tplink_item.item_id, variant_name="Archer C6 Gigabit MU-MIMO", unit_cost=2450.0, reorder_threshold=50, reorder_quantity=120)
        db.add(tplink_variant)
        db.commit()

        for i in range(1, 95):
            db.add(AssetUnit(
                variant_id=tplink_variant.variant_id,
                serial_number=f"TPF-TPL-C6-{40000 + i}",
                status=AssetStatusEnum.IN_WAREHOUSE.value
            ))

        # Serialized Item 5: Fujikura 90S+ Core Alignment Fusion Splicer (Low Stock breach: 8 units vs threshold 15)
        fujikura_item = Item(
            name="Fujikura Fusion Splicer", 
            category="Tools & Equipment",
            description="World-leading automated core-to-core alignment optical fiber fusion splicer with NanoTune technology",
            is_serialized=True
        )
        db.add(fujikura_item)
        db.commit()
        fujikura_variant = ItemVariant(item_id=fujikura_item.item_id, variant_name="Fujikura 90S+ Core Alignment Unit", unit_cost=325000.0, reorder_threshold=15, reorder_quantity=20)
        db.add(fujikura_variant)
        db.commit()

        # Seed 8 AssetUnit rows for Fujikura (High-value equipment, low stock breach)
        for i in range(1, 9):
            db.add(AssetUnit(
                variant_id=fujikura_variant.variant_id,
                serial_number=f"TPF-FJK-90S-{50000 + i}",
                status=AssetStatusEnum.IN_WAREHOUSE.value
            ))

        # Serialized Item 6: Sumitomo Precision Optical Splicer
        sumitomo_item = Item(
            name="Sumitomo Optical Fusion Splicer", 
            category="Tools & Equipment",
            description="Ultra-fast high-definition dual-heater core alignment splicer with rugged drop resistance",
            is_serialized=True
        )
        db.add(sumitomo_item)
        db.commit()
        sumitomo_variant = ItemVariant(item_id=sumitomo_item.item_id, variant_name="Sumitomo Z2C Standard Kit", unit_cost=285000.0, reorder_threshold=10, reorder_quantity=15)
        db.add(sumitomo_variant)
        db.commit()

        for i in range(1, 14):
            db.add(AssetUnit(
                variant_id=sumitomo_variant.variant_id,
                serial_number=f"TPF-SUM-Z2C-{60000 + i}",
                status=AssetStatusEnum.IN_WAREHOUSE.value
            ))

        # Serialized Item 7: EXFO FTB-1 OTDR Optical Tester
        exfo_item = Item(
            name="EXFO Optical Time Domain Reflectometer", 
            category="Tools & Equipment",
            description="High-dynamic-range modular OTDR platform for tier-2 link validation and fault identification",
            is_serialized=True
        )
        db.add(exfo_item)
        db.commit()
        exfo_variant = ItemVariant(item_id=exfo_item.item_id, variant_name="EXFO FTB-1v2 Pro 1310/1550nm", unit_cost=215000.0, reorder_threshold=12, reorder_quantity=15)
        db.add(exfo_variant)
        db.commit()

        for i in range(1, 16):
            db.add(AssetUnit(
                variant_id=exfo_variant.variant_id,
                serial_number=f"TPF-EXF-OTDR-{70000 + i}",
                status=AssetStatusEnum.IN_WAREHOUSE.value
            ))

        # Serialized Item 8: Triband Optical Power Meter (-70 to +10 dBm)
        opm_item = Item(
            name="Triband Optical Power Meter", 
            category="Tools & Equipment",
            description="Handheld optical tester calibrated for 850/1300/1310/1490/1550/1625nm with integrated RJ45 tracker",
            is_serialized=True
        )
        db.add(opm_item)
        db.commit()
        opm_variant = ItemVariant(item_id=opm_item.item_id, variant_name="Pro OPM-500 (-70 to +10 dBm)", unit_cost=4500.0, reorder_threshold=40, reorder_quantity=80)
        db.add(opm_variant)
        db.commit()

        for i in range(1, 65):
            db.add(AssetUnit(
                variant_id=opm_variant.variant_id,
                serial_number=f"TPF-OPM-500-{80000 + i}",
                status=AssetStatusEnum.IN_WAREHOUSE.value
            ))

        # Serialized Item 9: Visual Fault Locator 30mW Red Laser
        vfl_item = Item(
            name="Visual Fault Locator (Red Laser)", 
            category="Tools & Equipment",
            description="30mW high-power pen-type optical fiber fault locator for finding breaks up to 30km",
            is_serialized=True
        )
        db.add(vfl_item)
        db.commit()
        vfl_variant = ItemVariant(item_id=vfl_item.item_id, variant_name="30mW Aluminum Pen (30km Range)", unit_cost=1800.0, reorder_threshold=50, reorder_quantity=100)
        db.add(vfl_variant)
        db.commit()

        for i in range(1, 85):
            db.add(AssetUnit(
                variant_id=vfl_variant.variant_id,
                serial_number=f"TPF-VFL-30M-{90000 + i}",
                status=AssetStatusEnum.IN_WAREHOUSE.value
            ))

        # Serialized Item 10: Precision Fiber Cleaver CT-50
        cleaver_item = Item(
            name="Optical Precision Fiber Cleaver", 
            category="Tools & Equipment",
            description="Automated rotating blade single-action precision optical fiber cleaver with scrap collector",
            is_serialized=True
        )
        db.add(cleaver_item)
        db.commit()
        cleaver_variant = ItemVariant(item_id=cleaver_item.item_id, variant_name="Fujikura CT-50 Precision Cleaver", unit_cost=38000.0, reorder_threshold=15, reorder_quantity=30)
        db.add(cleaver_variant)
        db.commit()

        for i in range(1, 28):
            db.add(AssetUnit(
                variant_id=cleaver_variant.variant_id,
                serial_number=f"TPF-CLV-CT50-{95000 + i}",
                status=AssetStatusEnum.IN_WAREHOUSE.value
            ))

        # 6. Seed Repair Locations (1 per Region)
        repair_locations_data = [
            ("Delhi North Repair & Splicing Facility", loc_objs["Delhi"].location_id, region_objs["North Region"].region_id, "Okhla Industrial Area Phase III, New Delhi", "+91 11 2681 4401"),
            ("Mumbai West Hardware Diagnostics Lab", loc_objs["Mumbai"].location_id, region_objs["West Region"].region_id, "MIDC Andheri East, Mumbai", "+91 22 6123 9900"),
            ("Bangalore Tech Park Service Center", loc_objs["Bangalore"].location_id, region_objs["South Region"].region_id, "Electronic City Phase 1, Bangalore", "+91 80 4155 7700"),
            ("Kolkata Eastern Optical Repair Center", loc_objs["Kolkata"].location_id, region_objs["East Region"].region_id, "Sector V Salt Lake, Kolkata", "+91 33 2357 8800")
        ]
        repair_fac_objs = {}
        for r_name, c_id, reg_id, addr, phone in repair_locations_data:
            rf = RepairLocation(
                name=r_name,
                city_id=c_id,
                region_id=reg_id,
                address=addr,
                contact_phone=phone,
                is_active=True
            )
            db.add(rf)
            db.commit()
            db.refresh(rf)
            repair_fac_objs[r_name] = rf

        # 7. Assign some assets to Field Technicians for testing
        delhi_worker = worker_objs["delhi.worker@tataplay.com"]
        mumbai_worker = worker_objs["mumbai.worker@tataplay.com"]

        # Assign Nokia modem #1 to Delhi worker
        modem_1 = db.query(AssetUnit).filter(AssetUnit.serial_number == "TPF-NOK-W6-10001").first()
        if modem_1:
            modem_1.status = AssetStatusEnum.ASSIGNED.value
            modem_1.current_holder_id = delhi_worker.user_id
            modem_1.current_location_id = loc_objs["Delhi"].location_id

        # Assign Fujikura Splicer #1 to Delhi worker
        splicer_1 = db.query(AssetUnit).filter(AssetUnit.serial_number == "TPF-FJK-90S-50001").first()
        if splicer_1:
            splicer_1.status = AssetStatusEnum.ASSIGNED.value
            splicer_1.current_holder_id = delhi_worker.user_id
            splicer_1.current_location_id = loc_objs["Delhi"].location_id

        # Assign TP-Link Router #1 to Mumbai worker
        router_1 = db.query(AssetUnit).filter(AssetUnit.serial_number == "TPF-TPL-C6-40001").first()
        if router_1:
            router_1.status = AssetStatusEnum.ASSIGNED.value
            router_1.current_holder_id = mumbai_worker.user_id
            router_1.current_location_id = loc_objs["Mumbai"].location_id

        # Dedicated Exit / Offboarding Demo Technician: Vikram Sharma
        # Holds 3 active field worker assets: Splicer, Nokia ONT, and Triband Optical Power Meter
        vikram_worker = worker_objs.get("vikram.exit@tataplay.com")
        if vikram_worker:
            vikram_worker.is_leaving = True
            vikram_worker.clearance_status = "PENDING_CLEARANCE"

            # 1. Fujikura Splicer (Unit Cost: ₹3,25,000)
            vikram_splicer = db.query(AssetUnit).filter(AssetUnit.serial_number == "TPF-FJK-90S-50003").first()
            if vikram_splicer:
                vikram_splicer.status = AssetStatusEnum.ASSIGNED.value
                vikram_splicer.current_holder_id = vikram_worker.user_id
                vikram_splicer.current_location_id = loc_objs["Delhi"].location_id

            # 2. Nokia GPON Wi-Fi 6 ONT (Unit Cost: ₹3,800)
            vikram_nokia = db.query(AssetUnit).filter(AssetUnit.serial_number == "TPF-NOK-W6-10003").first()
            if vikram_nokia:
                vikram_nokia.status = AssetStatusEnum.ASSIGNED.value
                vikram_nokia.current_holder_id = vikram_worker.user_id
                vikram_nokia.current_location_id = loc_objs["Delhi"].location_id

            # 3. Triband Optical Power Meter (Unit Cost: ₹4,500)
            vikram_opm = db.query(AssetUnit).filter(AssetUnit.serial_number == "TPF-OPM-500-80003").first()
            if vikram_opm:
                vikram_opm.status = AssetStatusEnum.ASSIGNED.value
                vikram_opm.current_holder_id = vikram_worker.user_id
                vikram_opm.current_location_id = loc_objs["Delhi"].location_id

        db.commit()

        # 8. Seed Lifecycle Events for Modem #1
        lifecycle_events_modem1 = [
            AssetLifecycleEvent(
                asset_id=modem_1.asset_id,
                event_type="REGISTERED",
                performed_by=super_admin.user_id,
                notes="Serial number registered into Central Warehouse pool during procurement batch #TPF-2026-Q1",
                timestamp=datetime(2026, 1, 10, 10, 0, 0)
            ),
            AssetLifecycleEvent(
                asset_id=modem_1.asset_id,
                event_type="DISPATCHED",
                from_location_id=None,
                to_location_id=loc_objs["Delhi"].location_id,
                performed_by=super_admin.user_id,
                notes="Dispatched via Tata Play Express Logistics to Delhi Hub",
                timestamp=datetime(2026, 1, 15, 14, 30, 0)
            ),
            AssetLifecycleEvent(
                asset_id=modem_1.asset_id,
                event_type="ASSIGNED",
                to_holder_id=delhi_worker.user_id,
                to_location_id=loc_objs["Delhi"].location_id,
                performed_by=mgr_objs["delhi@tataplay.com"].user_id,
                notes=f"Assigned by City Manager Rajesh Kumar to Field Technician {delhi_worker.name} for FTTH installations",
                timestamp=datetime(2026, 1, 18, 9, 15, 0)
            )
        ]
        db.add_all(lifecycle_events_modem1)
        db.commit()

        # 9. Seed Sample Complaint and Repair Request
        complaint_1 = AssetComplaint(
            asset_id=modem_1.asset_id,
            reported_by=delhi_worker.user_id,
            description="Optical PON RX laser signal degradation (intermittent packet loss & RED light flashing)",
            status="OPEN",
            created_at=datetime(2026, 1, 28, 11, 20, 0)
        )
        db.add(complaint_1)
        db.commit()
        db.refresh(complaint_1)

        repair_req_1 = RepairRequest(
            asset_id=modem_1.asset_id,
            requested_by=delhi_worker.user_id,
            region_id=region_objs["North Region"].region_id,
            city_id=loc_objs["Delhi"].location_id,
            repair_location_id=repair_fac_objs["Delhi North Repair & Splicing Facility"].repair_location_id,
            complaint_id=complaint_1.complaint_id,
            status="PENDING",
            notes="Field Worker reported PON RX laser signal loss",
            created_at=datetime(2026, 1, 28, 11, 20, 0),
            updated_at=datetime(2026, 1, 28, 11, 20, 0)
        )
        db.add(repair_req_1)

        # Log fault event
        fault_event = AssetLifecycleEvent(
            asset_id=modem_1.asset_id,
            event_type="FAULT_REPORTED",
            from_holder_id=delhi_worker.user_id,
            from_location_id=loc_objs["Delhi"].location_id,
            performed_by=delhi_worker.user_id,
            notes=f"Fault report filed: {complaint_1.description}",
            timestamp=datetime(2026, 1, 28, 11, 20, 0)
        )
        db.add(fault_event)
        db.commit()

        # 10. Pre-seed Sample Requests for immediate demo testing
        sample_requests = [
            RequestModel(
                requested_by=mgr_objs["delhi@tataplay.com"].user_id,
                location_id=loc_objs["Delhi"].location_id,
                variant_id=nokia_variant.variant_id,
                quantity_requested=25,
                status=RequestStatusEnum.PENDING.value,
                created_at=datetime.utcnow()
            ),
            RequestModel(
                requested_by=mgr_objs["mumbai@tataplay.com"].user_id,
                location_id=loc_objs["Mumbai"].location_id,
                variant_id=fujikura_variant.variant_id,
                quantity_requested=2,
                status=RequestStatusEnum.PENDING.value,
                created_at=datetime.utcnow()
            ),
            RequestModel(
                requested_by=mgr_objs["bangalore@tataplay.com"].user_id,
                location_id=loc_objs["Bangalore"].location_id,
                variant_id=cables_variants[0].variant_id,
                quantity_requested=15,
                status=RequestStatusEnum.APPROVED.value,
                created_at=datetime.utcnow()
            ),
            RequestModel(
                requested_by=mgr_objs["pune@tataplay.com"].user_id,
                location_id=loc_objs["Pune"].location_id,
                variant_id=patch_variants[0].variant_id,
                quantity_requested=150,
                status=RequestStatusEnum.DISPATCHED.value,
                created_at=datetime.utcnow()
            ),
            RequestModel(
                requested_by=mgr_objs["hyderabad@tataplay.com"].user_id,
                location_id=loc_objs["Hyderabad"].location_id,
                variant_id=splitter_variants[0].variant_id,
                quantity_requested=40,
                status=RequestStatusEnum.DELIVERED.value,
                created_at=datetime.utcnow()
            )
        ]
        db.add_all(sample_requests)
        db.commit()

        # 11. Check threshold alerts
        all_variants = db.query(ItemVariant).all()
        for v in all_variants:
            await check_and_update_threshold_alerts(db, v.variant_id)

        print("\n" + "=" * 70)
        print(" FOUNDATION & LIFECYCLE: 4-TIER ROLES, REPAIRS & ASSETS SEEDED ")
        print("=" * 70)
        print(f" Super Admin       : admin@tataplay.com / {admin_pass}")
        print(f" North Reg Admin   : north.admin@tataplay.com / {admin_pass}")
        print(f" West Reg Admin    : west.admin@tataplay.com / {admin_pass}")
        print(f" South Reg Admin   : south.admin@tataplay.com / {admin_pass}")
        print(f" Delhi Manager     : delhi@tataplay.com / {mgr_pass}")
        print(f" Mumbai Manager    : mumbai@tataplay.com / {mgr_pass}")
        print(f" Delhi Field Tech  : delhi.worker@tataplay.com / {worker_pass}")
        print("=" * 70 + "\n")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(seed_database(force_reseed=True))


