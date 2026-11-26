"""
Idempotent production seeding script.
Creates base Regions, City Hubs, and Catalog Items WITHOUT creating default/demo credentials.
If INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are set in the environment,
creates the initial SUPER_ADMIN account with must_change_password=True.
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app.models import Region, Location, User, RoleEnum
from app.auth import get_password_hash


def seed_production():
    db = SessionLocal()
    try:
        regions_data = ["North Region", "West Region", "South Region", "East Region"]
        region_map = {}
        for r_name in regions_data:
            reg = db.query(Region).filter(Region.name == r_name).first()
            if not reg:
                reg = Region(name=r_name)
                db.add(reg)
                db.flush()
            region_map[r_name] = reg

        cities = [
            ("Delhi Central Hub", "New Delhi", "North Region", 28.6139, 77.2090),
            ("Mumbai Regional Hub", "Mumbai", "West Region", 19.0760, 72.8777),
            ("Pune Regional Hub", "Pune", "West Region", 18.5204, 73.8567),
            ("Bangalore Regional Hub", "Bangalore", "South Region", 12.9716, 77.5946),
            ("Hyderabad Regional Hub", "Hyderabad", "South Region", 17.3850, 78.4867),
            ("Chennai Regional Hub", "Chennai", "South Region", 13.0827, 80.2707),
            ("Kolkata Regional Hub", "Kolkata", "East Region", 22.5726, 88.3639),
        ]
        for name, city, reg_name, lat, lng in cities:
            exists = db.query(Location).filter(Location.name == name).first()
            if not exists:
                db.add(Location(
                    name=name,
                    city=city,
                    region_id=region_map[reg_name].region_id,
                    latitude=lat,
                    longitude=lng,
                ))

        admin_email = os.getenv("INITIAL_ADMIN_EMAIL")
        admin_password = os.getenv("INITIAL_ADMIN_PASSWORD")
        if admin_email and admin_password:
            existing_admin = db.query(User).filter(User.email == admin_email.strip().lower()).first()
            if not existing_admin:
                db.add(User(
                    name=os.getenv("INITIAL_ADMIN_NAME", "Production Super Admin"),
                    email=admin_email.strip().lower(),
                    password_hash=get_password_hash(admin_password),
                    role=RoleEnum.SUPER_ADMIN.value,
                    is_active=1,
                    must_change_password=True,
                    auth_provider="local",
                ))
                print(f"Created initial SUPER_ADMIN: {admin_email} (must_change_password=True)")
        else:
            print("INITIAL_ADMIN_EMAIL/INITIAL_ADMIN_PASSWORD not set; skipping admin user creation.")

        db.commit()
        print("Production seed completed idempotently.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_production()
