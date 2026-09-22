import os
import sys
import time
import uuid
import logging
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Ensure backend directory is in sys.path for direct module imports
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Load .env file at startup
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from .routers import (
    auth, inventory, requests, alerts, analytics, ai_copilot, 
    notifications, audit_logs, users, lifecycle, repairs, 
    complaints, decommission, transfers, offboarding
)
from .websocket_manager import ws_manager

try:
    from seed_data import seed_database
except ImportError:
    from ..seed_data import seed_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stocksentry.main")

APP_START_TIME = datetime.utcnow()

# Slowapi Limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="StockSentry API - Tata Play Fiber Enterprise ERP",
    description="Single Central Warehouse, Nationwide Regional Governance & Asset Lifecycle API",
    version="2.1.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ================= PRODUCTION MIDDLEWARE =================

class ProductionSecurityAndTracingMiddleware(BaseHTTPMiddleware):
    """
    Enforces enterprise security headers and correlates requests with X-Request-ID.
    """
    async def dispatch(self, request: Request, call_next):
        # Generate or capture trace ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        start_time = time.time()

        response: Response = await call_next(request)

        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = f"{process_time:.4f}s"
        response.headers["X-Request-ID"] = request_id

        # Enterprise Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        return response

app.add_middleware(ProductionSecurityAndTracingMiddleware)

# CORS middleware with environment-based origins
cors_origins_env = os.getenv(
    "CORS_ORIGINS", 
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://localhost:3000"
)
allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time"],
)

# Mount API Routers
app.include_router(auth.router)
app.include_router(inventory.router)
app.include_router(requests.router)
app.include_router(alerts.router)
app.include_router(analytics.router)
app.include_router(ai_copilot.router)
app.include_router(notifications.router)
app.include_router(audit_logs.router)
app.include_router(users.router)
app.include_router(lifecycle.router)
app.include_router(repairs.router)
app.include_router(complaints.router)
app.include_router(decommission.router)
app.include_router(transfers.router)
app.include_router(offboarding.router)

@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema initialized. Running seed data check...")
    await seed_database()

# ================= HEALTH & READINESS PROBES =================

@app.get("/healthz", tags=["System Health"])
def liveness_probe():
    """
    Shallow liveness probe for Kubernetes / Cloud Load Balancers.
    """
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/health", tags=["System Health"])
def readiness_probe(db: Session = Depends(get_db)):
    """
    Deep readiness probe verifying database connectivity, database dialect, and engine status.
    """
    db_status = "healthy"
    db_latency_ms = None
    try:
        t0 = time.time()
        db.execute(text("SELECT 1"))
        db_latency_ms = round((time.time() - t0) * 1000, 2)
    except Exception as e:
        logger.error(f"Readiness probe DB failure: {e}")
        db_status = "unhealthy"

    uptime_seconds = int((datetime.utcnow() - APP_START_TIME).total_seconds())

    return {
        "status": "ready" if db_status == "healthy" else "degraded",
        "organization": "Tata Play Fiber",
        "version": "2.1.0",
        "database": {
            "status": db_status,
            "dialect": engine.dialect.name,
            "latency_ms": db_latency_ms
        },
        "uptime_seconds": uptime_seconds,
        "environment": os.getenv("ENVIRONMENT", "production")
    }

@app.get("/")
def root():
    return {
        "system": "StockSentry ERP",
        "organization": "Tata Play Fiber",
        "status": "Online",
        "environment": os.getenv("ENVIRONMENT", "production"),
        "docs": "/docs",
        "health": "/api/health"
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection open and receive optional ping messages
            data = await websocket.receive_text()
            # Echo or acknowledge ping
            await websocket.send_text(f'{{"type": "ACK", "message": "Received {data}"}}')
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)
