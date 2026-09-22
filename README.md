# StockSentry: Enterprise Telecom Inventory, Field Operations & Asset Governance Platform
### Production Platform Built for Tata Play Fiber Network Operations

StockSentry is an enterprise-grade ERP designed for high-scale telecom infrastructure. It tracks central warehouse inventory and regional hub distribution across 7 major Indian cities, enforces strict 4-tier Role-Based Access Control (RBAC), tracks serialized equipment lifecycles from purchase to scrap, empowers 600+ field technicians with mobile ground ops tools, and automates employee offboarding with tamper-evident No Objection Certificates (NOC).

---

## 🌟 Key Enterprise Capabilities

1. 🏢 **Single Central Warehouse & Multi-Region Topology**:
   - Master central warehouse in New Delhi feeding 7 regional hubs across 4 zones (**North**, **West**, **South**, **East**).
   - Regional Stock Matrix with regions folding hierarchically into cities.
2. 👥 **4-Tier Strict Role-Based Access Control (RBAC)**:
   - **Super Admin**: Nationwide jurisdiction, central PO approval, item master configuration, bulk Excel onboarding.
   - **Regional Admin**: Regional division approvals, lab triage, decommission/scrap authorization.
   - **City Hub Manager**: Stock refill store, courier delivery confirmation, team offboarding & asset recovery.
   - **Field Worker (Technician)**: Barcode scanning, subscriber installations, instant fault complaint logging, field handovers.
3. 🛠️ **Dedicated Field Operations & 4-Way Repair Resolution**:
   - Direct fault complaint logging from customer premises.
   - Automated routing to Central Repair Facility benches.
   - 4-Way certified resolution: `RETURN_TO_TECH`, `RETURN_TO_HUB`, `RETURN_TO_CENTRAL`, or `ROUTE_TO_SCRAP` (with ISO 9001 calibration & salvage audit trail).
4. 📋 **Staff Offboarding & NOC Clearance Desk**:
   - Pre-exit asset audit: blocks clearance until 100% of assigned devices are returned.
   - Digital, tamper-evident No Objection Certificate (NOC) generation.
5. ⚡ **"Today's Requests" & "Today's Tracking" Operational Filters**:
   - 1-click timeline toggles to instantly isolate today's active purchase orders and shipments.
6. 🤖 **100% On-Premise Air-Gapped Intelligence Assistant**:
   - Zero external LLM dependency, zero cloud API calls, zero corporate data exposure.
   - Live database querying across managers, stock levels, open alerts, and technician complaints.
   - **Interactive 1-click action navigation** directly on chat responses.
7. 📡 **Real-Time Telemetry & WebSockets**:
   - Live notifications for PO dispatches, threshold breaches, and repair completions.

---

## 🔑 Pre-Seeded Demonstration Accounts

The platform pre-seeds complete demonstration datasets on startup. Log in with any of the following accounts:

| Role | Email | Password | Jurisdiction / Hub |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@tataplay.com` | `admin123` | Central Headquarters (Nationwide) |
| **Regional Admin** | `north.admin@tataplay.com` | `admin123` | North Region (Delhi Hub) |
| **City Hub Manager** | `delhi@tataplay.com` | `manager123` | Delhi Regional Hub |
| **Field Technician** | `delhi.worker@tataplay.com` | `worker123` | Delhi Ground Force |
| **Offboarding Sample** | `vikram.exit@tataplay.com` | `worker123` | Delhi Hub (Holds 3 Field Assets) |

---

## 🚀 Local Hosting Quickstart (Run in 2 Minutes)

### Prerequisites
- **Python 3.9+**
- **Node.js 18+** & npm

### 1. Start the Backend API
```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # Default configuration runs immediately
uvicorn app.main:app --reload --port 8000
```
> **FastAPI Interactive Docs**: [`http://localhost:8000/docs`](http://localhost:8000/docs)  
> **ReDoc Alternative Explorer**: [`http://localhost:8000/redoc`](http://localhost:8000/redoc)

### 2. Start the Frontend Application
```bash
cd frontend
npm install
npm run dev
```
> **Web Application**: Open [`http://localhost:5173`](http://localhost:5173) in your browser.

---

## 📚 Complete REST API Documentation

For the comprehensive catalog of all 15 API routers, authentication schemas, and cURL examples, consult the dedicated guide:
👉 **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)**

---

## 🧪 Automated Verification Suite

Run the full end-to-end audit suite verifying all 8 enterprise modules:
```bash
cd backend
python verify_all_requirements.py
```
