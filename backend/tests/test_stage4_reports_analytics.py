import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app


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


def test_notification_preferences_and_weekly_digest(client, tokens):
    upd = client.put(
        "/api/notifications/preferences",
        json={
            "email_requests": True,
            "email_requisitions": False,
            "email_tickets": True,
            "email_low_stock": True,
            "email_noc": True,
            "email_weekly_digest": False,
        },
        headers={"Authorization": f"Bearer {tokens['MANAGER']}"},
    )
    assert upd.status_code == 200
    assert upd.json()["email_weekly_digest"] is False

    got = client.get("/api/notifications/preferences", headers={"Authorization": f"Bearer {tokens['MANAGER']}"})
    assert got.status_code == 200
    assert got.json()["email_requisitions"] is False

    digest = client.get("/api/notifications/weekly-digest-preview", headers={"Authorization": f"Bearer {tokens['MANAGER']}"})
    assert digest.status_code == 200
    assert "pending_requests" in digest.json()

    sched = client.post("/api/notifications/run-scheduled", headers={"Authorization": f"Bearer {tokens['SUPER_ADMIN']}"})
    assert sched.status_code == 200


def test_scoped_exports_and_audit_logging(client, tokens):
    # Manager can export requests CSV/XLSX
    csv_r = client.get("/api/exports/requests?format=csv", headers={"Authorization": f"Bearer {tokens['MANAGER']}"})
    assert csv_r.status_code == 200
    assert "Request ID" in csv_r.text

    xlsx_r = client.get("/api/exports/assets?format=xlsx", headers={"Authorization": f"Bearer {tokens['MANAGER']}"})
    assert xlsx_r.status_code == 200

    # Non-super-admin cannot export system audit logs
    denied = client.get("/api/exports/audit_logs?format=csv", headers={"Authorization": f"Bearer {tokens['MANAGER']}"})
    assert denied.status_code == 403


def test_lifecycle_analytics_insights(client, tokens):
    r_super = client.get("/api/analytics/lifecycle-insights?days=90", headers={"Authorization": f"Bearer {tokens['SUPER_ADMIN']}"})
    assert r_super.status_code == 200
    data = r_super.json()
    assert "failure_rate_by_model" in data
    assert "repair_metrics" in data
    assert "idle_stock_ageing" in data
    assert "ticket_metrics" in data

    r_reg = client.get("/api/analytics/lifecycle-insights?days=30", headers={"Authorization": f"Bearer {tokens['REGIONAL_ADMIN']}"})
    assert r_reg.status_code == 200

    # Field worker forbidden
    assert client.get("/api/analytics/lifecycle-insights", headers={"Authorization": f"Bearer {tokens['FIELD_WORKER']}"}).status_code == 403
