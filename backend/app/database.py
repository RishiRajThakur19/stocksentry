import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("stocksentry.database")

# Read database URL from environment or default to local SQLite
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "stocksentry.db")
    DATABASE_URL = f"sqlite:///{DB_PATH}"

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
