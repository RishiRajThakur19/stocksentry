# StockSentry API Reference & System Architecture
### Enterprise Telecom Inventory, Field Operations & Asset Governance Platform (Tata Play Fiber)

---

## 📌 1. System Overview & Local Hosting Guide

StockSentry is an enterprise-grade ERP designed for nationwide telecom operations. It features:
- **Single Central Warehouse & Multi-Region Topology**: Central master inventory in New Delhi supplying 7 regional hubs across 4 zones (North, West, South, East).
- **Strict 4-Tier RBAC Governance**:
  - `SUPER_ADMIN`: Central Headquarters governance, PO approvals, master catalog.
  - `REGIONAL_ADMIN`: Regional zone approvals, repair facility triage, scrap sign-offs.
  - `MANAGER`: City Hub inventory refill store, dispatch confirmation, team offboarding.
  - `FIELD_WORKER`: Mobile Ground Ops desk, barcode scanning, fault reports, field handovers.
- **Air-Gapped Intelligence**: 100% on-premise deterministic query engine with 1-click UI action links.
- **Zero-Config Database**: On startup, SQLite automatically initializes and seeds all 7 hubs, catalog SKUs, serialized assets, and test accounts.

### 🚀 Running Locally (2-Minute Setup)

#### Prerequisites
- **Python**: 3.9+ 
- **Node.js**: 18+ (with npm)

#### Step A: Start the Backend (FastAPI)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # Default configuration works out-of-the-box
uvicorn app.main:app --reload --port 8000
```
> **Interactive Swagger UI**: Visit [`http://localhost:8000/docs`](http://localhost:8000/docs)  
> **ReDoc API Explorer**: Visit [`http://localhost:8000/redoc`](http://localhost:8000/redoc)

#### Step B: Start the Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
> **Frontend Application**: Visit [`http://localhost:5173`](http://localhost:5173)

---

## 🔑 2. Pre-Seeded Demonstration Accounts

| Role | Email | Password | Scope & Assigned Hub |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@tataplay.com` | `admin123` | Nationwide / Central Headquarters |
| **Regional Admin** | `north.admin@tataplay.com` | `admin123` | North Region (Delhi Zone) |
| **City Hub Manager** | `delhi@tataplay.com` | `manager123` | Delhi Regional Hub |
| **Field Technician** | `delhi.worker@tataplay.com` | `worker123` | Delhi Ground Ops Team |
| **Offboarding Sample** | `vikram.exit@tataplay.com` | `worker123` | Delhi Hub (Holds 3 Field Assets) |

---

## 🔒 3. Authentication & Headers

All protected endpoints require an `Authorization` header containing the JWT Bearer token obtained from `POST /api/auth/login`:
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 📋 4. Complete REST API Endpoint Directory

### 4.1 Authentication & Profile (`/api/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticates user with email & password; returns JWT token & role metadata. |
| `POST` | `/api/auth/signup` | Public | Self-registration with role and city/region assignment. |
| `POST` | `/api/auth/verify-otp` | Public | Verifies 6-digit OTP during multi-factor authentication or recovery. |
| `GET` | `/api/auth/me` | Authenticated | Retrieves active user profile, jurisdiction, and assigned hub. |

#### Sample Login Request:
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "delhi@tataplay.com", "password": "manager123"}'
```

---

### 4.2 Inventory Master & Regional Matrix (`/api/inventory`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/inventory/items` | All Roles | Lists all equipment items, variants, costs, thresholds, and images. |
| `POST` | `/api/inventory/items` | Super Admin | Creates a new equipment master SKU with variant specifications. |
| `GET` | `/api/inventory/regional-stock` | All Roles | Aggregates stock with regions folding into cities (Central + Regional matrix). |
| `POST` | `/api/inventory/receive` | Super Admin | Records incoming vendor stock shipments into the Central Warehouse. |
| `GET` | `/api/inventory/stock-summary` | All Roles | High-level KPI metrics (Total units, valuation, low stock items). |
| `GET` | `/api/inventory/regions` | All Roles | Lists all 4 telecom operating regions in India. |
| `GET` | `/api/inventory/locations` | All Roles | Lists all 7 city distribution hubs with geo-coordinates and managers. |

---

### 4.3 City Stock Replenishment & In-Transit Tracking (`/api/requests`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/requests` | All Roles (Scoped) | Retrieves stock requests queue. Automatically scoped to user hub/region. Supports status & today filter. |
| `POST` | `/api/requests` | Manager / Admin | Submits a bulk replenishment purchase order (PO) for city hub restocking. |
| `PUT` | `/api/requests/{id}/approve` | Super / Regional Admin | Approves city replenishment request for central warehouse fulfillment. |
| `PUT` | `/api/requests/{id}/reject` | Super / Regional Admin | Rejects stock request with mandatory review note. |
| `PUT` | `/api/requests/{id}/dispatch` | Super Admin | Dispatches approved stock via courier (BlueDart / Express Logistics with AWB). |
| `PUT` | `/api/requests/{id}/confirm-delivery` | City Manager | Confirms physical receipt at city hub and restocks inventory. |

---

### 4.4 Ground-Force Equipment Complaints (`/api/complaints`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/complaints` | All Roles | Lists fault complaints logged by field technicians across India. |
| `POST` | `/api/complaints` | Field Tech / Manager | Logs an equipment defect report from subscriber installation site. Automatically generates a linked repair request. |
| `PUT` | `/api/complaints/{id}/status` | Regional Admin | Updates complaint workflow status (`OPEN`, `ROUTED_TO_REPAIR`, `RESOLVED`, `REJECTED`). |

---

### 4.5 Central Repair Facility & Scrap Governance (`/api/repairs` & `/api/decommission`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/repairs/requests` | All Roles | Lists active repair requests across all physical repair benches. |
| `POST` | `/api/repairs/requests` | All Roles | Manually routes a damaged serialized asset to the repair lab. |
| `PUT` | `/api/repairs/requests/{id}/approve` | Regional Admin | Authorizes repair intake and assigns bench station & engineer. |
| `PUT` | `/api/repairs/requests/{id}/complete` | Regional Admin | Completes 4-way repair resolution:<br>• `RETURN_TO_TECH`<br>• `RETURN_TO_HUB`<br>• `RETURN_TO_CENTRAL`<br>• `ROUTE_TO_SCRAP` |
| `GET` | `/api/decommission/requests` | Super / Regional Admin | Lists decommission and scrap audit records. |
| `POST` | `/api/decommission/requests` | Regional Admin | Submits scrap approval request for unrepairable hardware. |
| `PUT` | `/api/decommission/requests/{id}/approve` | Regional Admin | Authorizes equipment scrapping, marks asset decommissioned, and logs salvage audit trail. |

---

### 4.6 Serial Lifecycle & Physical Asset Tracking (`/api/lifecycle`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/lifecycle/assets` | All Roles | Lists all physical serialized assets with status, location, and holder. |
| `GET` | `/api/lifecycle/assets/{serial}` | All Roles | Queries specific asset by barcode/serial number (e.g. `TPF-NOK-W6-10001`). |
| `GET` | `/api/lifecycle/my-assets` | Field Worker | Returns live roster of hardware devices currently held by the logged-in field tech. |
| `GET` | `/api/lifecycle/events/{asset_id}` | All Roles | Chronological audit trail of every handover, dispatch, fault, and repair in the asset's history. |

---

### 4.7 Direct Field Equipment Handover (`/api/transfers`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/transfers` | All Roles | Lists peer-to-peer equipment transfers between technicians or hubs. |
| `POST` | `/api/transfers` | Field Tech / Manager | Initiates direct handover of an assigned asset to another technician (instant within same city). |
| `PUT` | `/api/transfers/{id}/accept` | Destination Manager | Accepts cross-city equipment transfer upon physical arrival. |

---

### 4.8 Staff Offboarding & NOC Clearance Desk (`/api/offboarding`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/offboarding/directory` | Manager / Admin | Lists staff members, active status, held assets count, and clearance status. |
| `GET` | `/api/offboarding/check-clearance/{user_id}` | Manager / Admin | Performs real-time audit check of assets held before offboarding. |
| `POST` | `/api/offboarding/initiate/{user_id}` | Manager / Admin | Initiates employee exit workflow and flags clearance pending. |
| `POST` | `/api/offboarding/recover-asset/{asset_id}` | Manager / Admin | Records physical recovery of field asset into hub warehouse stock. |
| `POST` | `/api/offboarding/issue-noc/{user_id}` | Manager / Admin | Generates tamper-evident No Objection Certificate (NOC) once 100% of assets are cleared. |
| `GET` | `/api/offboarding/noc-records` | All Roles | Retrieves historical issued NOC certificates with verification hashes. |

---

### 4.9 User Management & Bulk Spreadsheet Onboarding (`/api/users`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | Super / Regional Admin | Lists all enterprise personnel across regions and hubs. |
| `GET` | `/api/users/template` | Admin | Downloads official Excel (.xlsx) bulk user onboarding spreadsheet template. |
| `POST` | `/api/users/bulk-upload` | Super Admin | Parses uploaded Excel sheet to batch-create regional managers and field workers. |

---

### 4.10 Alert Telemetry & Inventory Health (`/api/alerts`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/alerts` | All Roles | Lists real-time stock threshold breaches and reorder alerts. |
| `PUT` | `/api/alerts/{id}/resolve` | Super Admin | Marks alert resolved following warehouse replenishment. |

---

### 4.11 Air-Gapped Intelligence Assistant (`/api/ai`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/copilot/chat` | All Roles | Air-gapped operational query engine (Zero external LLM calls). Returns live database answer with 1-click UI action links. |
| `GET` | `/api/ai/report/summary` | All Roles | Structured executive summary and stock health valuation score. |

---

### 4.12 Live Real-Time WebSockets (`/ws`)

| Endpoint | Protocol | Description |
| :--- | :--- | :--- |
| `/ws/{user_id}` | WebSocket | Broadcasts live order updates (`ORDER_CREATED`, `ORDER_DISPATCHED`), fault alerts, and NOC issuances across connected clients. |

---

## 🛡️ 5. Security & Air-Gapped Architecture

1. **Zero External API Leakage**: No corporate data, inventory records, or employee details leave the local network.
2. **Production Security Headers**: Includes `nosniff`, `SAMEORIGIN`, `XSS-Protection`, and `Strict-Transport-Security`.
3. **Audit Trail**: Every transaction, status change, and handover is logged in append-only tables (`asset_lifecycle_events`, `audit_logs`).
