import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, RoleEnum
from app.auth import create_access_token

client = TestClient(app)

def test_communications():
    db = SessionLocal()
    try:
        super_admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN.value).first()
        delhi_worker = db.query(User).filter(User.email == "delhi.worker@tataplay.com").first()
        delhi_mgr = db.query(User).filter(User.email == "delhi@tataplay.com").first()

        assert super_admin is not None, "Super admin user missing"
        assert delhi_worker is not None, "Delhi worker missing"
        assert delhi_mgr is not None, "Delhi manager missing"

        admin_token = create_access_token({"sub": super_admin.email})
        worker_token = create_access_token({"sub": delhi_worker.email})
        mgr_token = create_access_token({"sub": delhi_mgr.email})

        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        worker_headers = {"Authorization": f"Bearer {worker_token}"}
        mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

        print("--- Testing Contacts Endpoint ---")
        res = client.get("/api/communications/contacts", headers=worker_headers)
        assert res.status_code == 200, f"Worker contacts failed: {res.text}"
        worker_contacts = res.json()
        print(f"Worker sees {len(worker_contacts)} contacts. Sample: {[c['name'] + ' (' + c['hierarchy_relation'] + ')' for c in worker_contacts[:3]]}")

        res = client.get("/api/communications/contacts", headers=admin_headers)
        assert res.status_code == 200, f"Admin contacts failed: {res.text}"
        admin_contacts = res.json()
        print(f"Super Admin sees {len(admin_contacts)} contacts.")

        print("\n--- Testing Channels Endpoint ---")
        res = client.get("/api/communications/channels", headers=worker_headers)
        assert res.status_code == 200, f"Worker channels failed: {res.text}"
        channels = res.json()
        print(f"Channels returned: {[c['name'] + ' (can_post=' + str(c['can_post']) + ')' for c in channels]}")

        print("\n--- Testing Hierarchy Restriction: Worker attempting Nationwide Broadcast ---")
        res = client.post("/api/communications/send", headers=worker_headers, json={
            "channel_type": "BROADCAST_NATIONWIDE",
            "content": "This should be blocked by hierarchy permissions!",
            "priority": "NORMAL"
        })
        print(f"Status code for unauthorized broadcast: {res.status_code} (Expected 403)")
        assert res.status_code == 403, f"Expected 403 but got {res.status_code}: {res.text}"
        print(f"Correctly blocked: {res.json()['detail']}")

        print("\n--- Testing Super Admin Nationwide Broadcast ---")
        res = client.post("/api/communications/send", headers=admin_headers, json={
            "channel_type": "BROADCAST_NATIONWIDE",
            "subject": "Executive Update: Q4 Safety Standards",
            "content": "All operational teams must verify high-voltage insulated tool certification.",
            "priority": "OPERATIONAL_DIRECTIVE"
        })
        assert res.status_code == 200, f"Admin broadcast failed: {res.text}"
        print(f"Super Admin sent broadcast #{res.json()['message_id']}")

        print("\n--- Testing Direct Message between Worker & Hub Manager ---")
        res = client.post("/api/communications/send", headers=worker_headers, json={
            "channel_type": "DIRECT",
            "recipient_id": delhi_mgr.user_id,
            "subject": "Kit Check Complete",
            "content": "All 12 tools accounted for in vehicle DEL-VAN-04.",
            "priority": "NORMAL"
        })
        assert res.status_code == 200, f"Worker DM failed: {res.text}"
        print(f"Worker sent direct message #{res.json()['message_id']} to Manager")

        print("\n--- Testing Unread Count ---")
        res = client.get("/api/communications/unread-count", headers=mgr_headers)
        assert res.status_code == 200, f"Unread count failed: {res.text}"
        print(f"Delhi Manager unread count: {res.json()}")

        print("\nALL BACKEND HIERARCHY & COMMS TESTS PASSED PERFECTLY!")

    finally:
        db.close()

if __name__ == "__main__":
    test_communications()
