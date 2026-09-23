
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_field_worker_restrictions_and_capabilities():
    print("--- 1. Login as Field Tech ---")
    res = client.post('/api/auth/login', json={'email': 'delhi.worker@tataplay.com', 'password': 'worker123'})
    assert res.status_code == 200, res.text
    worker_token = res.json()['access_token']
    worker_headers = {'Authorization': f'Bearer {worker_token}'}
    print("  ✓ Field Tech logged in successfully.")

    print("\n--- 2. Verify Field Tech CANNOT Create Stock Orders (403 Forbidden) ---")
    order_payload = {
        "variant_id": 1,
        "quantity_requested": 10,
        "location_id": 1
    }
    res = client.post('/api/requests', json=order_payload, headers=worker_headers)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"
    print(f"  ✓ Ordering blocked with 403: {res.json()['detail']}")

    print("\n--- 3. Query Field Tech Assigned Devices ---")
    res = client.get('/api/lifecycle/my-assets', headers=worker_headers)
    assert res.status_code == 200, res.text
    assets = res.json()
    print(f"  ✓ Found {len(assets)} devices held by technician.")
    assert len(assets) > 0
    target_asset = assets[0]
    print(f"    • Test asset: {target_asset['item_name']} (SN: {target_asset['serial_number']}, ID: {target_asset['asset_id']})")

    print("\n--- 4. Verify Subscriber Wi-Fi Setup & ONT Activation ---")
    install_payload = {
        "asset_id": target_asset['asset_id'],
        "subscriber_id": "TPF-SUB-98214",
        "subscriber_name": "Pooja Verma",
        "subscriber_address": "Flat 402, Block C, Green Park Extension, New Delhi",
        "wifi_ssid": "TataPlayFiber_5G_Pooja",
        "wifi_password": "TPF@Secure99",
        "optical_rx_power_dbm": -19.4,
        "work_order_no": "WO-DEL-2026-081",
        "installation_notes": "Optical core verified. Splice loss 0.02 dB."
    }
    res = client.post('/api/lifecycle/subscriber-installation', json=install_payload, headers=worker_headers)
    assert res.status_code == 200, f"Setup failed: {res.text}"
    install_data = res.json()
    print(f"  ✓ Wi-Fi Activated: Slip #{install_data['installation_id']}")
    print(f"    • Signal Status: {install_data['signal_status']} (Power: {install_data['optical_rx_power_dbm']} dBm)")
    print(f"    • Assigned to Subscriber: {install_data['subscriber_name']} at {install_data['subscriber_address']}")

    print("\n--- 5. Verify Immutable Lifecycle Milestone Recorded ---")
    res = client.get(f"/api/lifecycle/events/{target_asset['asset_id']}", headers=worker_headers)
    assert res.status_code == 200, res.text
    events = res.json()
    install_event = next((e for e in events if e['event_type'] == 'CUSTOMER_INSTALLATION'), None)
    assert install_event, "CUSTOMER_INSTALLATION event not found in lifecycle timeline!"
    print(f"  ✓ Lifecycle event logged: [{install_event['event_type']}] {install_event['notes']}")

    print("\n========================================================")
    print("🎉 ALL FIELD TECHNICIAN RESTRICTIONS & CAPABILITIES PASSED!")
    print("========================================================")

if __name__ == "__main__":
    test_field_worker_restrictions_and_capabilities()
