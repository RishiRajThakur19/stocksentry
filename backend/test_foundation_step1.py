import urllib.request
import urllib.error
import json

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

def test_roles_and_token_payloads():
    # 1. Super Admin
    super_token, super_data = get_token("admin@tataplay.com", "admin123")
    assert super_data["role"] == "SUPER_ADMIN"
    assert super_data["region_id"] is None
    assert super_data["city_id"] is None

    # 2. North Regional Admin
    north_token, north_data = get_token("north.admin@tataplay.com", "admin123")
    assert north_data["role"] == "REGIONAL_ADMIN"
    assert north_data["region_id"] == 1 # North Region
    assert north_data["region_name"] == "North Region"

    # 3. West Regional Admin
    west_token, west_data = get_token("west.admin@tataplay.com", "admin123")
    assert west_data["role"] == "REGIONAL_ADMIN"
    assert west_data["region_id"] == 2 # West Region

    # 4. Delhi Manager
    delhi_token, delhi_data = get_token("delhi@tataplay.com", "manager123")
    assert delhi_data["role"] == "MANAGER"
    assert delhi_data["city_id"] == 1 # Delhi Hub

    # 5. Delhi Field Tech
    tech_token, tech_data = get_token("delhi.worker@tataplay.com", "worker123")
    assert tech_data["role"] == "FIELD_WORKER"
    assert tech_data["city_id"] == 1

    print("✅ All 4-tier roles authenticated successfully with correct payload metadata.")

def test_geography_endpoints():
    super_token, _ = get_token("admin@tataplay.com", "admin123")

    # Regions
    status, regions = api_call("/api/inventory/regions", token=super_token)
    assert status == 200
    assert len(regions) == 4
    region_names = [r["name"] for r in regions]
    assert "North Region" in region_names
    assert "West Region" in region_names
    assert "South Region" in region_names
    assert "East Region" in region_names

    # Locations
    status, locations = api_call("/api/inventory/locations", token=super_token)
    assert status == 200
    assert len(locations) == 7
    delhi = next(l for l in locations if l["city"] == "Delhi")
    assert delhi["region_id"] == 1
    assert delhi["region_name"] == "North Region"

    mumbai = next(l for l in locations if l["city"] == "Mumbai")
    assert mumbai["region_id"] == 2
    assert mumbai["region_name"] == "West Region"

    print("✅ Geography hierarchy (Regions -> City Locations) verified.")

def test_inventory_classes_and_asset_units():
    super_token, _ = get_token("admin@tataplay.com", "admin123")

    # Stock listing
    status, stocks = api_call("/api/inventory/stock", token=super_token)
    assert status == 200

    # Consumable check (e.g. T-Shirt)
    tshirt_stock = next((s for s in stocks if "T-Shirt - M" in f"{s['item_name']} - {s['variant_name']}"), None)
    assert tshirt_stock is not None
    assert tshirt_stock["is_serialized"] is False
    assert tshirt_stock["current_quantity"] == 250

    # Serialized check (e.g. Nokia Modem)
    nokia_stock = next((s for s in stocks if "Nokia" in s["item_name"]), None)
    assert nokia_stock is not None
    assert nokia_stock["is_serialized"] is True
    assert nokia_stock["current_quantity"] == 120 # From 120 AssetUnit rows

    # Serialized check (e.g. Juniper Modem - Low Stock Breach)
    juniper_stock = next((s for s in stocks if "Juniper" in s["item_name"]), None)
    assert juniper_stock is not None
    assert juniper_stock["is_serialized"] is True
    assert juniper_stock["current_quantity"] == 45
    assert juniper_stock["is_low_stock"] is True

    # AssetUnit listing for Nokia
    nokia_variant_id = nokia_stock["variant_id"]
    status, asset_units = api_call(f"/api/inventory/variants/{nokia_variant_id}/assets", token=super_token)
    assert status == 200
    assert len(asset_units) == 120
    assert asset_units[0]["serial_number"].startswith("TPF-NOK-W6-")
    assert asset_units[0]["status"] == "IN_WAREHOUSE"

    print("✅ Inventory classes verified: Consumables (scalar) vs Serialized (AssetUnits dynamically aggregated).")

def test_scope_authorization_and_403_enforcement():
    north_token, _ = get_token("north.admin@tataplay.com", "admin123")
    west_token, _ = get_token("west.admin@tataplay.com", "admin123")
    delhi_token, _ = get_token("delhi@tataplay.com", "manager123")
    mumbai_token, _ = get_token("mumbai@tataplay.com", "manager123")
    worker_token, _ = get_token("delhi.worker@tataplay.com", "worker123")

    # 1. North Regional Admin only sees North requests
    status, north_reqs = api_call("/api/requests", token=north_token)
    assert status == 200
    for r in north_reqs:
        assert r["region_name"] == "North Region"

    # 2. Delhi Manager creates a request for Delhi (Allowed)
    status, new_req = api_call(
        "/api/requests", 
        method="POST", 
        token=delhi_token,
        data={"variant_id": 1, "quantity_requested": 15, "location_id": 1}
    )
    assert status == 200
    req_id = new_req["request_id"]

    # 3. West Regional Admin tries to APPROVE North (Delhi) request -> 403 Forbidden!
    status, west_res = api_call(
        f"/api/requests/{req_id}/approve",
        method="PUT",
        token=west_token
    )
    assert status == 403
    print(f"✅ West Regional Admin correctly blocked from approving North request (HTTP 403: {west_res['detail']})")

    # 4. North Regional Admin APPROVES North (Delhi) request -> 200 Success!
    status, north_res = api_call(
        f"/api/requests/{req_id}/approve",
        method="PUT",
        token=north_token
    )
    assert status == 200
    assert north_res["status"] == "APPROVED"
    print("✅ North Regional Admin approved North request within assigned scope.")

    # 5. Field Worker or Manager trying to approve -> 403 Forbidden
    status, worker_res = api_call(
        f"/api/requests/{req_id}/approve",
        method="PUT",
        token=worker_token
    )
    assert status == 403
    print("✅ Field Worker blocked from approval actions (HTTP 403).")

if __name__ == "__main__":
    print("\nStarting StockSentry Foundation (Prompt 1 of 3) Verification Suite...")
    test_roles_and_token_payloads()
    test_geography_endpoints()
    test_inventory_classes_and_asset_units()
    test_scope_authorization_and_403_enforcement()
    print("\n🎉 ALL STEP 1 FOUNDATION TESTS PASSED PERFECTLY!\n")
