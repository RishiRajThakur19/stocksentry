"""
One-off script to copy existing SQLite data into PostgreSQL.
Usage:
  SQLITE_URL=sqlite:///./stocksentry.db POSTGRES_URL=postgresql://user:pass@host:5432/db python scripts/migrate_sqlite_to_postgres.py
"""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base
import app.models  # noqa: F401


def migrate():
    sqlite_url = os.getenv("SQLITE_URL", f"sqlite:///{BACKEND_DIR / 'stocksentry.db'}")
    postgres_url = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not postgres_url or not postgres_url.startswith("postgres"):
        raise SystemExit("ERROR: Set POSTGRES_URL (or DATABASE_URL) to a postgresql:// connection string.")

    src_engine = create_engine(sqlite_url)
    dst_engine = create_engine(postgres_url)

    Base.metadata.create_all(bind=dst_engine)

    SrcSession = sessionmaker(bind=src_engine)
    DstSession = sessionmaker(bind=dst_engine)

    src_db = SrcSession()
    dst_db = DstSession()
    try:
        for table in Base.metadata.sorted_tables:
            rows = src_db.execute(table.select()).mappings().all()
            if not rows:
                continue
            dst_db.execute(table.delete())
            dst_db.execute(table.insert(), [dict(r) for r in rows])
            print(f"Copied {len(rows)} rows into {table.name}")

            # Reset PostgreSQL SERIAL sequences
            if len(table.primary_key.columns) == 1:
                pk_col = list(table.primary_key.columns)[0]
                if pk_col.autoincrement:
                    dst_db.execute(text(
                        f"SELECT setval(pg_get_serial_sequence('{table.name}', '{pk_col.name}'), "
                        f"COALESCE((SELECT MAX({pk_col.name}) FROM {table.name}), 1), true)"
                    ))
        dst_db.commit()
        print("SQLite -> PostgreSQL migration completed successfully.")
    finally:
        src_db.close()
        dst_db.close()


if __name__ == "__main__":
    migrate()
