import sys
from pathlib import Path
from datetime import datetime, timedelta

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import engine, Base, SessionLocal
from app.models import CommunicationMessage, User, RoleEnum, Region, Location

def seed_communications():
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing_count = db.query(CommunicationMessage).count()
        if existing_count > 0:
            print(f"Communication messages already exist ({existing_count} records). Skipping seeding.")
            return

        print("Seeding initial hierarchical communication messages...")

        # Retrieve key users
        super_admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN.value).first()
        north_admin = db.query(User).filter(User.email == "north.admin@tataplay.com").first()
        delhi_mgr = db.query(User).filter(User.email == "delhi@tataplay.com").first()
        delhi_worker = db.query(User).filter(User.email == "delhi.worker@tataplay.com").first()

        north_region = db.query(Region).filter(Region.name == "North Region").first()
        delhi_loc = db.query(Location).filter(Location.city == "Delhi").first()

        if not (super_admin and north_admin and delhi_mgr and delhi_worker):
            print("Required demo users not found. Please ensure seed_data has run first.")
            return

        now = datetime.utcnow()

        messages = [
            # 1. Nationwide Directive
            CommunicationMessage(
                sender_id=super_admin.user_id,
                recipient_id=None,
                channel_type="BROADCAST_NATIONWIDE",
                target_region_id=None,
                target_city_id=None,
                subject="[URGENT] High-Precision OTDR Testing Protocol Mandate (Q4 FY26)",
                content="All regional fiber teams and city hubs: Effective immediately, all newly spliced fiber drops and optical splitter nodes must be verified with calibrated OTDR reflection tests (<0.05 dB splice loss threshold) before subscriber ONT provisioning. Please ensure strict adherence.",
                priority="OPERATIONAL_DIRECTIVE",
                is_read=False,
                created_at=now - timedelta(hours=4)
            ),
            # 2. Regional Directive
            CommunicationMessage(
                sender_id=north_admin.user_id,
                recipient_id=None,
                channel_type="BROADCAST_REGION",
                target_region_id=north_region.region_id if north_region else None,
                target_city_id=None,
                subject="North Circle Monsoon Preparedness & Buffer Stock Rebalancing",
                content="Attention Delhi & surrounding hubs: Monsoon fiber protection sleeves and waterproof splice closures are being expedited from Central Warehouse. Ensure all field technicians have sufficient drop cable coils and patch cords in their vehicle kits.",
                priority="URGENT",
                is_read=False,
                created_at=now - timedelta(hours=2, minutes=30)
            ),
            # 3. City Hub Dispatch Memo
            CommunicationMessage(
                sender_id=delhi_mgr.user_id,
                recipient_id=None,
                channel_type="BROADCAST_CITY",
                target_region_id=delhi_loc.region_id if delhi_loc else None,
                target_city_id=delhi_loc.location_id if delhi_loc else None,
                subject="Daily Shift Dispatch: Connaught Place & Okhla Sector Splice Operations",
                content="Field Tech Team: Amit Verma is assigned to Okhla Phase III feeder line restoration today. Backup Splicing Machine SN-SPL-DEL-001 has been recalibrated and is available for pickup at Bay 3. Report any optic attenuation above -20 dBm immediately.",
                priority="NORMAL",
                is_read=False,
                created_at=now - timedelta(hours=1, minutes=15)
            ),
            # 4. Direct message from Field Worker to Manager
            CommunicationMessage(
                sender_id=delhi_worker.user_id,
                recipient_id=delhi_mgr.user_id,
                channel_type="DIRECT",
                target_region_id=None,
                target_city_id=None,
                subject="Feeder Line Splice Complete - Optical Power Verified",
                content="Sir, completed the 24-core ribbon splice at Okhla Phase III distribution node. Measured optical power at subscriber terminal is -18.2 dBm, well within tolerance. Returning spare fast connectors to Delhi hub inventory by 17:30.",
                priority="NORMAL",
                is_read=True,
                read_at=now - timedelta(minutes=40),
                created_at=now - timedelta(minutes=45)
            ),
            # 5. Direct message from Manager to Field Worker
            CommunicationMessage(
                sender_id=delhi_mgr.user_id,
                recipient_id=delhi_worker.user_id,
                channel_type="DIRECT",
                target_region_id=None,
                target_city_id=None,
                subject="Acknowledged: Great job on Okhla Node",
                content="Well done Amit! Once you return the connectors, please sign off the kit manifest on your mobile device. Take tomorrow's morning shift off as comp-off.",
                priority="NORMAL",
                is_read=False,
                created_at=now - timedelta(minutes=30)
            ),
        ]

        db.add_all(messages)
        db.commit()
        print(f"Successfully seeded {len(messages)} hierarchical communication messages!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding communications: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_communications()
