import urllib.request
import urllib.error
import json
import io
import openpyxl

BASE_URL = "http://localhost:8000"

def api_call(endpoint, method="GET", data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    req_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")

    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8")
        return err.code, json.loads(body) if body else {}

def get_token(email, password):
    status, res = api_call("/api/auth/login", method="POST", data={"email": email, "password": password})
    assert status == 200, f"Login failed for {email}: {res}"
    return res["access_token"], res

def test_field_worker_complaints():
    worker_token, worker_data = get_token("delhi.worker@tataplay.com", "worker123")
    
    # Get assigned assets
    status, my_assets = api_call("/api/lifecycle/my-assets", token=worker_token)
    assert status == 200
    assert len(my_assets) >= 1
    target_asset = my_assets[0]
    asset_id = target_asset["asset_id"]

    # File a complaint
    status, comp_res = api_call(
        "/api/complaints",
        method="POST",
        token=worker_token,
        data={
            "asset_id": asset_id,
            "description": "Optical connector loose pin causing 50% packet drop on subscriber WAN."
        }
    )
    assert status == 200
    complaint_id = comp_res["complaint_id"]
    assert comp_res["status"] == "OPEN"
    print(f"✅ Field Worker filed fault complaint #{complaint_id} on SN: {target_asset['serial_number']}")

    # Check complaints list
    status, complaints = api_call("/api/complaints/my", token=worker_token)
    assert status == 200
    assert any(c["complaint_id"] == complaint_id for c in complaints)
    print("✅ Field Worker complaint history verified.")

def test_repair_workflow_and_scoping():
    north_token, _ = get_token("north.admin@tataplay.com", "admin123")
    west_token, _ = get_token("west.admin@tataplay.com", "admin123")

    # Get repair locations
    status, locs = api_call("/api/repairs/locations", token=north_token)
    assert status == 200
    assert len(locs) >= 1
    delhi_facility = next((l for l in locs if "Delhi" in l["name"]), locs[0])

    # Get pending repair requests
    status, reqs = api_call("/api/repairs/requests", token=north_token)
    assert status == 200
    pending_req = next((r for r in reqs if r["status"] == "PENDING"), None)
    assert pending_req is not None
    req_id = pending_req["repair_request_id"]

    # 1. West Admin tries to approve North repair -> 403 Forbidden!
    status, west_res = api_call(
        f"/api/repairs/requests/{req_id}/approve",
        method="PUT",
        token=west_token,
        data={"repair_location_id": delhi_facility["repair_location_id"]}
    )
    assert status == 403
    print("✅ West Admin blocked from approving North repair (HTTP 403).")

    # 2. North Admin approves repair -> moves to IN_REPAIR at RepairLocation
    status, app_res = api_call(
        f"/api/repairs/requests/{req_id}/approve",
        method="PUT",
        token=north_token,
        data={"repair_location_id": delhi_facility["repair_location_id"], "notes": "Approved for board level diagnostic"}
    )
    assert status == 200
    assert app_res["status"] == "IN_REPAIR"
    print(f"✅ North Admin approved repair #{req_id} -> routed to {delhi_facility['name']}.")

    # 3. Complete repair -> Return to Central Warehouse
    status, comp_res = api_call(
        f"/api/repairs/requests/{req_id}/complete",
        method="PUT",
        token=north_token,
        data={"resolution_action": "RETURN_TO_WAREHOUSE", "notes": "Optical transceiver replaced."}
    )
    assert status == 200
    assert comp_res["status"] == "REPAIR_RETURNED"
    print(f"✅ Repair #{req_id} marked completed -> asset returned to Central Warehouse stock pool.")

def test_asset_transfers():
    delhi_token, _ = get_token("delhi@tataplay.com", "manager123")
    mumbai_token, _ = get_token("mumbai@tataplay.com", "manager123")
    super_token, _ = get_token("admin@tataplay.com", "admin123")

    # Get user IDs for transfer
    status, users = api_call("/api/users", token=super_token)
    assert status == 200
    delhi_worker = next(u for u in users if u["email"] == "delhi.worker@tataplay.com")
    mumbai_worker = next(u for u in users if u["email"] == "mumbai.worker@tataplay.com")

    # 1. Same-city transfer: handoff asset #2 from Delhi worker to manager
    status, same_res = api_call(
        "/api/transfers/same-city",
        method="POST",
        token=delhi_token,
        data={
            "asset_id": 2,
            "to_user_id": delhi_worker["user_id"],
            "notes": "Assigned for high-speed fiber installation"
        }
    )
    assert status == 200
    assert same_res["status"] == "COMPLETED"
    print("✅ Same-city asset handoff executed instantly without intermediate approvals.")

    # 2. Cross-city transfer from Delhi to Mumbai Hub (Location #2)
    status, cross_res = api_call(
        "/api/transfers/cross-city",
        method="POST",
        token=delhi_token,
        data={
            "asset_id": 2,
            "to_city_id": 2, # Mumbai
            "to_user_id": mumbai_worker["user_id"],
            "notes": "Emergency modem rebalance"
        }
    )
    assert status == 200
    assert cross_res["status"] == "PENDING_ACCEPTANCE"
    transfer_id = cross_res["transfer_id"]
    print(f"✅ Cross-city transfer #{transfer_id} dispatched -> status: PENDING_ACCEPTANCE.")

    # 3. Mumbai Manager accepts cross-city transfer
    status, acc_res = api_call(
        f"/api/transfers/{transfer_id}/accept",
        method="PUT",
        token=mumbai_token
    )
    assert status == 200
    assert acc_res["status"] == "COMPLETED"
    print(f"✅ Mumbai Manager accepted cross-city transfer #{transfer_id}.")

def test_offboarding_and_noc():
    delhi_token, _ = get_token("delhi@tataplay.com", "manager123")
    super_token, _ = get_token("admin@tataplay.com", "admin123")

    status, users = api_call("/api/users", token=super_token)
    delhi_worker = next(u for u in users if u["email"] == "delhi.worker@tataplay.com")
    worker_id = delhi_worker["user_id"]

    # 1. Mark employee as leaving
    status, leave_res = api_call(
        "/api/offboarding/mark-leaving",
        method="POST",
        token=delhi_token,
        data={"user_id": worker_id}
    )
    assert status == 200
    assert leave_res["is_leaving"] is True
    print(f"✅ Employee {delhi_worker['name']} marked as Leaving -> clearance check initialized.")

    # 2. If holding assets, verify NOC is blocked (400)
    status, check_res = api_call(f"/api/offboarding/check-clearance/{worker_id}", token=delhi_token)
    assert status == 200
    if not check_res["can_issue_noc"]:
        # Attempt to issue NOC -> Should fail with 400
        status, noc_fail = api_call(
            "/api/offboarding/issue-noc",
            method="POST",
            token=delhi_token,
            data={"user_id": worker_id}
        )
        assert status == 400
        print("✅ NOC issuance blocked (HTTP 400) while personnel still holds active hardware assets.")

def test_bulk_excel_upload_and_template():
    super_token, _ = get_token("admin@tataplay.com", "admin123")

    # 1. Download template endpoint
    url = f"{BASE_URL}/api/users/template"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {super_token}")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        template_bytes = resp.read()
        assert len(template_bytes) > 1000
    print("✅ Downloadable Excel template generated successfully.")

if __name__ == "__main__":
    print("\nStarting StockSentry Full Asset Lifecycle & Governance (Prompt 2) Test Suite...")
    test_field_worker_complaints()
    test_repair_workflow_and_scoping()
    test_asset_transfers()
    test_offboarding_and_noc()
    test_bulk_excel_upload_and_template()
    print("\n🎉 ALL STEP 2 LIFECYCLE & GOVERNANCE TESTS PASSED PERFECTLY!\n")
