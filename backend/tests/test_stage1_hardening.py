import io
import os
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import openpyxl
import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
from app.database import SessionLocal
from app.models import User, InventoryStock, ItemVariant, RequestModel, RequestStatusEnum

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _login(client: TestClient, email: str, password: str):
    return client.post("/api/auth/login", json={"email": email, "password": password})


@pytest.fixture(scope="module")
def tokens(client):
    res_map = {}
    for role, creds in [
        ("SUPER_ADMIN", ("admin@tataplay.com", "admin123")),
        ("REGIONAL_ADMIN", ("north.admin@tataplay.com", "admin123")),
        ("MANAGER", ("delhi@tataplay.com", "manager123")),
        ("FIELD_WORKER", ("delhi.worker@tataplay.com", "worker123")),
    ]:
        r = _login(client, *creds)
        assert r.status_code == 200, f"Login failed for {role}: {r.status_code} {r.text}"
        res_map[role] = r.json()["access_token"]
    return res_map


def test_health_and_ready_probes(client):
    r1 = client.get("/health")
    assert r1.status_code == 200
    assert r1.json()["status"] == "alive"

    r2 = client.get("/ready")
    assert r2.status_code == 200
    assert r2.json()["database"]["status"] == "healthy"


@pytest.mark.parametrize(
    "role,method,path,expected_status",
    [
        ("SUPER_ADMIN", "GET", "/api/audit-logs", 200),
        ("REGIONAL_ADMIN", "GET", "/api/audit-logs", 403),
        ("MANAGER", "GET", "/api/audit-logs", 403),
        ("FIELD_WORKER", "GET", "/api/audit-logs", 403),
        ("FIELD_WORKER", "GET", "/api/field-requisitions/technicians", 403),
        ("MANAGER", "GET", "/api/field-requisitions/technicians", 200),
        ("REGIONAL_ADMIN", "GET", "/api/field-requisitions/technicians", 200),
        ("FIELD_WORKER", "GET", "/api/lifecycle/my-assets", 200),
    ],
)
def test_role_endpoint_scope_matrix(client, tokens, role, method, path, expected_status):
    res = client.request(method, path, headers={"Authorization": f"Bearer {tokens[role]}"})
    assert res.status_code == expected_status


def test_password_policy_and_account_lifecycle(client, tokens):
    # Create a temporary user with must_change_password=True
    temp_email = "stage1.temp@tataplay.com"
    db = SessionLocal()
    existing = db.query(User).filter(User.email == temp_email).first()
    if existing:
        db.delete(existing)
        db.commit()
    db.close()

    create_res = client.post(
        "/api/users",
        json={
            "name": "StageOne Temp",
            "email": temp_email,
            "password": "TempPassword123!",
            "role": "FIELD_WORKER",
            "city_id": 1,
        },
        headers={"Authorization": f"Bearer {tokens['SUPER_ADMIN']}"},
    )
    assert create_res.status_code == 200
    temp_user_id = create_res.json()["user_id"]

    # Login -> must_change_password=True blocks other endpoints
    login_res = _login(client, temp_email, "TempPassword123!")
    assert login_res.status_code == 200
    data = login_res.json()
    assert data["must_change_password"] is True
    temp_tok = data["access_token"]

    blocked = client.get("/api/lifecycle/my-assets", headers={"Authorization": f"Bearer {temp_tok}"})
    assert blocked.status_code == 403

    # Weak password rejected
    weak = client.post(
        "/api/auth/change-password",
        json={"current_password": "TempPassword123!", "new_password": "short"},
        headers={"Authorization": f"Bearer {temp_tok}"},
    )
    assert weak.status_code == 400

    # Name-containing password rejected
    name_pw = client.post(
        "/api/auth/change-password",
        json={"current_password": "TempPassword123!", "new_password": "StageOneStrong99!"},
        headers={"Authorization": f"Bearer {temp_tok}"},
    )
    assert name_pw.status_code == 400

    # Valid password change succeeds and unblocks endpoints
    ok_pw = client.post(
        "/api/auth/change-password",
        json={"current_password": "TempPassword123!", "new_password": "V@lidEnterprise#99"},
        headers={"Authorization": f"Bearer {temp_tok}"},
    )
    assert ok_pw.status_code == 200
    new_tok = ok_pw.json()["access_token"]
    assert client.get("/api/lifecycle/my-assets", headers={"Authorization": f"Bearer {new_tok}"}).status_code == 200

    # 5 failed logins trigger 15m lockout (423), then admin unlocks
    for _ in range(5):
        _login(client, temp_email, "WrongPassword!")
    locked = _login(client, temp_email, "V@lidEnterprise#99")
    assert locked.status_code == 423

    unlock = client.post(
        f"/api/users/{temp_user_id}/unlock",
        headers={"Authorization": f"Bearer {tokens['SUPER_ADMIN']}"},
    )
    assert unlock.status_code == 200
    assert _login(client, temp_email, "V@lidEnterprise#99").status_code == 200

    # Cleanup
    db = SessionLocal()
    u = db.query(User).filter(User.user_id == temp_user_id).first()
    if u:
        db.delete(u)
        db.commit()
    db.close()


def test_stock_reservation_and_concurrency(client, tokens):
    db = SessionLocal()
    stock = db.query(InventoryStock).join(ItemVariant).filter(InventoryStock.current_quantity >= 10).first()
    assert stock is not None
    vid = stock.variant_id
    initial_qty = stock.current_quantity
    initial_res = stock.reserved_quantity or 0
    db.close()

    # Create two requests each asking for more than half of available stock
    half_plus = max(1, (initial_qty - initial_res) // 2 + 1)
    r1 = client.post(
        "/api/requests",
        json={"variant_id": vid, "quantity_requested": half_plus, "location_id": 1},
        headers={"Authorization": f"Bearer {tokens['MANAGER']}"},
    )
    r2 = client.post(
        "/api/requests",
        json={"variant_id": vid, "quantity_requested": half_plus, "location_id": 1},
        headers={"Authorization": f"Bearer {tokens['MANAGER']}"},
    )
    assert r1.status_code == 200 and r2.status_code == 200
    id1, id2 = r1.json()["request_id"], r2.json()["request_id"]

    # Simultaneous approvals: at most one can succeed because unreserved stock < 2 * half_plus
    def _approve(rid):
        return client.put(f"/api/requests/{rid}/approve", headers={"Authorization": f"Bearer {tokens['REGIONAL_ADMIN']}"}).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(_approve, [id1, id2]))

    assert sorted(statuses) == [200, 400]

    # Reject the approved one to release reservation
    approved_id = id1 if statuses[0] == 200 else id2
    rej = client.put(f"/api/requests/{approved_id}/reject", headers={"Authorization": f"Bearer {tokens['REGIONAL_ADMIN']}"})
    assert rej.status_code == 200

    db = SessionLocal()
    refreshed = db.query(InventoryStock).filter(InventoryStock.variant_id == vid).first()
    assert (refreshed.reserved_quantity or 0) == initial_res
    db.close()


def test_bulk_upload_validation(client, tokens):
    # Reject non-xlsx
    bad_ext = client.post(
        "/api/users/bulk-upload",
        files={"file": ("users.csv", b"name,email\na,b@c.com", "text/csv")},
        headers={"Authorization": f"Bearer {tokens['SUPER_ADMIN']}"},
    )
    assert bad_ext.status_code == 400

    # Reject formula injection
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Name", "Email", "Role", "City", "Region"])
    ws.append(["=CMD()", "bad@tataplay.com", "FIELD_WORKER", "New Delhi", "North Region"])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    formula_res = client.post(
        "/api/users/bulk-upload",
        files={"file": ("bad.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"Authorization": f"Bearer {tokens['SUPER_ADMIN']}"},
    )
    assert formula_res.status_code == 400
