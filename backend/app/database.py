import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("stocksentry.database")

# Read database URL from environment or default to local SQLite
DATABASE_URL = os.getenv("DATABASE_URL")

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if not DATABASE_URL:
    DB_PATH = os.path.join(BACKEND_DIR, "stocksentry.db")
    DATABASE_URL = f"sqlite:///{DB_PATH}"
elif DATABASE_URL.startswith("sqlite:///") and not DATABASE_URL.startswith("sqlite:////"):
    rel_path = DATABASE_URL[len("sqlite:///"):]
    abs_db_path = os.path.normpath(os.path.join(BACKEND_DIR, rel_path))
    DATABASE_URL = f"sqlite:///{abs_db_path}"

# Fix Heroku/Render/AWS URL format postgres:// -> postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Configure enterprise connection engine
if DATABASE_URL.startswith("sqlite"):
    # SQLite local development configuration
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30}
    )
    logger.info("Database initialized with SQLite engine (local development mode).")
else:
    # Enterprise PostgreSQL / Cloud SQL / AWS RDS configuration with connection pooling
    engine = create_engine(
        DATABASE_URL,
        pool_size=int(os.getenv("DB_POOL_SIZE", "20")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "30")),
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800")), # recycle idle connections after 30 mins
        pool_pre_ping=True # validates connection liveness before checking out from pool
    )
    logger.info("Database initialized with Enterprise PostgreSQL connection pool.")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_sqlite_dev_columns():
    """
    Local SQLite convenience helper: adds Stage 1 columns to an existing dev SQLite DB
    when Alembic hasn't been run on it yet. Never runs on PostgreSQL.
    """
    if not DATABASE_URL.startswith("sqlite"):
        return
    from sqlalchemy import text
    alters = [
        ("users", "must_change_password", "BOOLEAN NOT NULL DEFAULT 0"),
        ("users", "failed_login_attempts", "INTEGER NOT NULL DEFAULT 0"),
        ("users", "locked_until", "DATETIME"),
        ("users", "auth_provider", "VARCHAR(50) NOT NULL DEFAULT 'local'"),
        ("users", "token_version", "INTEGER NOT NULL DEFAULT 1"),
        ("asset_units", "is_reserved", "BOOLEAN NOT NULL DEFAULT 0"),
        ("asset_units", "reserved_for_request_id", "INTEGER"),
        ("asset_units", "receipt_batch_id", "INTEGER"),
        ("asset_units", "tech_delivery_status", "VARCHAR(30) NOT NULL DEFAULT 'DELIVERED'"),
        ("field_consumable_assignments", "delivery_status", "VARCHAR(30) NOT NULL DEFAULT 'DISPATCHED'"),
        ("field_consumable_assignments", "delivered_at", "DATETIME"),
        ("field_requisitions", "quantity_fulfilled", "INTEGER NOT NULL DEFAULT 0"),
        ("inventory_stocks", "reserved_quantity", "INTEGER NOT NULL DEFAULT 0"),
    ]
    with engine.begin() as conn:
        for table, col, col_def in alters:
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()}
            if existing and col not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))
