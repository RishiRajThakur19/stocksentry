import sys
import uuid
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
from app.database import SessionLocal
from app.models import Item, ItemVariant


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def admin_token(client):
    r = client.post("/api/auth/login", json={"email": "admin@tataplay.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_bulk_serial_intake_200_and_duplicates(client, admin_token):
    db = SessionLocal()
    var = db.query(ItemVariant).join(Item).filter(Item.is_serialized.is_(True)).first()
    assert var is not None
    vid = var.variant_id
    db.close()

    prefix = f"TPF-S3-{uuid.uuid4().hex[:6].upper()}"
    serials_200 = [f"{prefix}-{i:04d}" for i in range(1, 201)]
    with_dupes = serials_200 + [serials_200[0], "BAD SERIAL!"]

    # Preview catches duplicate in file and invalid format
    prev = client.post(
        "/api/inventory/bulk-serials/preview",
        data={"variant_id": str(vid), "serials_text": "\n".join(with_dupes)},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert prev.status_code == 200
    pdata = prev.json()
    assert len(pdata["valid"]) == 200
    assert serials_200[0] in pdata["duplicate_in_file"]
    assert "BAD SERIAL!" in pdata["invalid"]

    # Commit 200 valid serials atomically
    commit = client.post(
        "/api/inventory/bulk-serials/commit",
        json={"variant_id": vid, "serials": pdata["valid"], "reference_note": "Stage 3 200-unit test"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert commit.status_code == 200
    cdata = commit.json()
    assert cdata["unit_count"] == 200
    batch_id = cdata["batch_id"]

    # Retrieve batch for QR printing
    batch_detail = client.get(f"/api/inventory/receipt-batches/{batch_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert batch_detail.status_code == 200
    assert len(batch_detail.json()["serials"]) == 200

    # Re-previewing one of the committed serials catches duplicate_in_db
    recheck = client.post(
        "/api/inventory/bulk-serials/preview",
        data={"variant_id": str(vid), "serials_text": serials_200[0]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert recheck.status_code == 200
    assert serials_200[0] in recheck.json()["duplicate_in_db"]
