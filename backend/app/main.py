import os
import sys
import time
import json
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
    complaints, decommission, transfers, offboarding,
    forecasting, camera_ocr, whatsapp_bot, communications, field_requisitions,
    tickets, loss_reports, audits, receipt_batches, exports
)
from .websocket_manager import ws_manager

try:
    from seed_data import seed_database
except ImportError:
    from ..seed_data import seed_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stocksentry.main")

APP_START_TIME = datetime.utcnow()
IS_PROD = os.getenv("ENVIRONMENT", "development").lower() == "production"
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "false" if IS_PROD else "true").lower() == "true"

SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=float(os.getenv("SENTRY_TRACES_RATE", "0.1")))
    except Exception:
        pass

# Slowapi Limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="StockSentry API - Tata Play Fiber Enterprise ERP",
    description="Single Central Warehouse, Nationwide Regional Governance & Asset Lifecycle API",
    version="2.1.0",
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
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
        response.headers["Permissions-Policy"] = "camera=(self), microphone=(self), geolocation=(self)"

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
app.include_router(forecasting.router)
app.include_router(camera_ocr.router)
app.include_router(whatsapp_bot.router)
app.include_router(communications.router)
app.include_router(field_requisitions.router)
app.include_router(tickets.router)
app.include_router(loss_reports.router)
app.include_router(audits.router)
app.include_router(receipt_batches.router)
app.include_router(exports.router)

@app.on_event("startup")
async def startup_event():
    from .database import ensure_sqlite_dev_columns
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_dev_columns()
    logger.info("Database schema initialized. Running seed data check...")
    await seed_database()
    await ws_manager.start_redis_listener()


@app.on_event("shutdown")
async def shutdown_event():
    await ws_manager.stop_redis_listener()

# ================= HEALTH & READINESS PROBES =================

@app.get("/health", tags=["System Health"])
@app.get("/healthz", tags=["System Health"])
def liveness_probe():
    """
    Shallow liveness probe for Kubernetes / Cloud Load Balancers.
    """
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}

@app.get("/ready", tags=["System Health"])
@app.get("/api/health", tags=["System Health"])
def readiness_probe(db: Session = Depends(get_db)):
    """
    Deep readiness probe verifying database connectivity and Redis connectivity (if configured).
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

    redis_status = "disabled"
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            import redis as sync_redis
            r = sync_redis.from_url(redis_url, socket_connect_timeout=2)
            r.ping()
            redis_status = "healthy"
        except Exception as e:
            logger.error(f"Readiness probe Redis failure: {e}")
            redis_status = "unhealthy"

    overall_ready = db_status == "healthy" and redis_status != "unhealthy"
    uptime_seconds = int((datetime.utcnow() - APP_START_TIME).total_seconds())

    return {
        "status": "ready" if overall_ready else "degraded",
        "organization": "Tata Play Fiber",
        "version": "2.1.0",
        "database": {
            "status": db_status,
            "dialect": engine.dialect.name,
            "latency_ms": db_latency_ms
        },
        "redis": {"status": redis_status},
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
    from .auth import decode_token_payload
    from .database import SessionLocal
    from .models import User

    token = websocket.query_params.get("token")
    if not token:
        auth_header = websocket.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()

    if not token:
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    try:
        payload = decode_token_payload(token)
        email = payload.get("sub")
        tv = payload.get("tv")
        user = db.query(User).filter(User.email == email).first() if email else None
        if not user or not user.is_active or (tv is not None and user.token_version != tv):
            await websocket.close(code=1008)
            return
        user_scope = {
            "user_id": user.user_id,
            "role": user.role,
            "region_id": user.region_id,
            "city_id": user.city_id,
            "territory_ids": user.territory_ids,
        }
    except Exception:
        await websocket.close(code=1008)
        return
    finally:
        db.close()

    await ws_manager.connect(websocket, user_scope)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(json.dumps({"type": "ACK", "message": f"Received {data}"}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)
