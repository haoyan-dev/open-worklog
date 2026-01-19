import os
from pathlib import Path
import uuid as uuidlib

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DEFAULT_DB_PATH = "sqlite:///./app.db"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_PATH)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

    if DATABASE_URL.startswith("sqlite:///"):
        db_path = DATABASE_URL.replace("sqlite:///", "", 1)
        if db_path and db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def ensure_schema(engine):
    """Best-effort schema upgrade for SQLite without Alembic.

    This project uses `Base.metadata.create_all()` (no migrations). SQLite won't
    add new columns automatically, so we patch the schema at startup.
    """
    if not str(engine.url).startswith("sqlite"):
        # No-op for non-sqlite (not currently used in this repo).
        return

    def _has_table(conn, table_name: str) -> bool:
        row = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
            {"name": table_name},
        ).fetchone()
        return row is not None

    def _get_columns(conn, table_name: str) -> set[str]:
        rows = conn.execute(text(f"PRAGMA table_info({table_name})")).mappings().all()
        return {str(r["name"]) for r in rows}

    with engine.begin() as conn:
        if not _has_table(conn, "log_entries"):
            return

        cols = _get_columns(conn, "log_entries")

        if "uuid" not in cols:
            conn.execute(text("ALTER TABLE log_entries ADD COLUMN uuid TEXT"))
        if "previous_task_uuid" not in cols:
            conn.execute(text("ALTER TABLE log_entries ADD COLUMN previous_task_uuid TEXT"))

        # Backfill UUIDs for existing rows.
        missing = conn.execute(
            text("SELECT id FROM log_entries WHERE uuid IS NULL OR uuid = ''")
        ).fetchall()
        for (row_id,) in missing:
            conn.execute(
                text("UPDATE log_entries SET uuid = :uuid WHERE id = :id"),
                {"uuid": str(uuidlib.uuid4()), "id": row_id},
            )

        # Create indexes (unique where possible).
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_log_entries_uuid ON log_entries (uuid)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_log_entries_previous_task_uuid ON log_entries (previous_task_uuid)"
            )
        )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
