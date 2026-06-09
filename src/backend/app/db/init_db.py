"""Create all tables and run the initial seed."""
from __future__ import annotations

from sqlmodel import Session, SQLModel, text

import app.models  # noqa: F401  (ensures models are registered on metadata)
from app.db.seed import seed_regions
from app.db.session import engine


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_sqlite_columns()
    with Session(engine) as session:
        seed_regions(session)


def _ensure_sqlite_columns() -> None:
    """Tiny SQLite schema upgrade path for POC databases created before new fields."""
    if not str(engine.url).startswith("sqlite"):
        return
    with engine.begin() as conn:
        cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(firefocus)").all()}
        if "frp" not in cols:
            conn.exec_driver_sql("ALTER TABLE firefocus ADD COLUMN frp FLOAT")


if __name__ == "__main__":
    init_db()
    print("OrbitGuard database initialized.")
