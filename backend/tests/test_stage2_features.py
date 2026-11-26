import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
from app.database import SessionLocal
from app.models import AssetUnit, AssetStatusEnum

# Minimal valid 1x1 PNG bytes
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00\x00"
    b"\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def tokens(client):
    res = {}
    for role, creds in [
        ("SUPER_ADMIN", ("admin@tataplay.com", "admin123")),
        ("REGIONAL_ADMIN", ("north.admin@tataplay.com", "admin123")),
        ("MANAGER", ("delhi@tataplay.com", "manager123")),
        ("FIELD_WORKER", ("delhi.worker@tataplay.com", "worker123")),
    ]:
        r = client.post("/api/auth/login", json={"email": creds[0], "password": creds[1]})
        assert r.status_code == 200, r.text
        res[role] = r.json()["access_token"]
    return res


def test_support_ticket_lifecycle_and_attachments(client, tokens):
    # Field worker raises ticket
    t_res = client.post(
        "/api/tickets",
        json={
            "category": "STOCK_ISSUE",
            "priority": "HIGH",
            "subject": "Need replacement OTDR connector",
            "description": "Connector damaged during field splice",
        },
        headers={"Authorization": f"Bearer {tokens['FIELD_WORKER']}"},
    )
    assert t_res.status_code == 200
    tid = t_res.json()["ticket_id"]
    assert t_res.json()["ticket_code"].startswith("TKT-")

    # Upload valid PNG attachment
    att_res = client.post(
        f"/api/tickets/{tid}/attachments",
        files={"file": ("photo.png", PNG_BYTES, "image/png")},
        headers={"Authorization": f"Bearer {tokens['FIELD_WORKER']}"},
    )
    assert att_res.status_code == 200
    att_id = att_res.json()["attachment_id"]

    # Reject disguised non-image file
    bad_att = client.post(
        f"/api/tickets/{tid}/attachments",
        files={"file": ("fake.png", b"not-a-png", "image/png")},
        headers={"Authorization": f"Bearer {tokens['FIELD_WORKER']}"},
    )
    assert bad_att.status_code == 400

    # Manager adds internal note + public reply
    client.post(
        f"/api/tickets/{tid}/comments",
        json={"body": "Internal: check Delhi hub spare bin", "is_internal": True},
        headers={"Authorization": f"Bearer {tokens['MANAGER']}"},
    )
    client.post(
        f"/api/tickets/{tid}/comments",
        json={"body": "Spare connector dispatched to you", "is_internal": False},
        headers={"Authorization": f"Bearer {tokens['MANAGER']}"},
    )

    # Field worker sees public reply only, Manager sees both
    fw_detail = client.get(f"/api/tickets/{tid}", headers={"Authorization": f"Bearer {tokens['FIELD_WORKER']}"}).json()
    mgr_detail = client.get(f"/api/tickets/{tid}", headers={"Authorization": f"Bearer {tokens['MANAGER']}"}).json()
    assert len(fw_detail["comments"]) == 1
    assert len(mgr_detail["comments"]) == 2

    # Authenticated attachment download works
    dl = client.get(f"/api/tickets/attachments/{att_id}", headers={"Authorization": f"Bearer {tokens['MANAGER']}"})
    assert dl.status_code == 200

    # Resolve & Confirm Close
    assert client.put(f"/api/tickets/{tid}/action", json={"action": "RESOLVE"}, headers={"Authorization": f"Bearer {tokens['MANAGER']}"}).status_code == 200
    assert client.put(f"/api/tickets/{tid}/action", json={"action": "CONFIRM_CLOSE"}, headers={"Authorization": f"Bearer {tokens['FIELD_WORKER']}"}).status_code == 200


def test_loss_report_writeoff_and_recovery(client, tokens):
    db = SessionLocal()
    asset = db.query(AssetUnit).filter(AssetUnit.status == AssetStatusEnum.IN_WAREHOUSE.value).first()
    assert asset is not None
    aid = asset.asset_id
    db.close()

    rep = client.post(
        "/api/loss-reports",
        json={"asset_id": aid, "loss_type": "LOST", "circumstances": "Lost during transit", "date_last_seen": "2026-11-25"},
        headers={"Authorization": f"Bearer {tokens['SUPER_ADMIN']}"},
    )
    assert rep.status_code == 200
    lid = rep.json()["loss_id"]

    # Approve write-off
    app_res = client.put(f"/api/loss-reports/{lid}/approve", json={}, headers={"Authorization": f"Bearer {tokens['SUPER_ADMIN']}"})
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "APPROVED"

    # Recover asset back to stock
    rec_res = client.put(f"/api/loss-reports/{lid}/recover", json={}, headers={"Authorization": f"Bearer {tokens['SUPER_ADMIN']}"})
    assert rec_res.status_code == 200
    assert rec_res.json()["status"] == "RECOVERED"


def test_stock_audit_cycle_count_and_csv(client, tokens):
    start = client.post(
        "/api/audits",
        json={"scope_type": "CITY", "location_id": 1, "notes": "Stage 2 cycle count"},
        headers={"Authorization": f"Bearer {tokens['MANAGER']}"},
    )
    assert start.status_code == 200
    aid = start.json()["audit_id"]

    detail = client.get(f"/api/audits/{aid}", headers={"Authorization": f"Bearer {tokens['MANAGER']}"}).json()
    assert len(detail["lines"]) > 0

    assert client.post(f"/api/audits/{aid}/submit", headers={"Authorization": f"Bearer {tokens['MANAGER']}"}).status_code == 200
    assert client.post(f"/api/audits/{aid}/approve", headers={"Authorization": f"Bearer {tokens['REGIONAL_ADMIN']}"}).status_code == 200

    csv_res = client.get(f"/api/audits/{aid}/export", headers={"Authorization": f"Bearer {tokens['MANAGER']}"})
    assert csv_res.status_code == 200
    assert "Audit Code" in csv_res.text
