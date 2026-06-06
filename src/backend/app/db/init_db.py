"""Create all tables and run the initial seed."""
from __future__ import annotations

from sqlmodel import Session, SQLModel

import app.models  # noqa: F401  (ensures models are registered on metadata)
from app.db.seed import seed_regions
from app.db.session import engine


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_regions(session)


if __name__ == "__main__":
    init_db()
    print("OrbitGuard database initialized.")
