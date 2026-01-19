"""
Backend TimeSpan test script (no pytest required).

This script creates a throwaway SQLite database, then exercises the backend
session (TimeSpan) creation/update functions in `crud.py`, including:
- overlap + <=15m-gap merging
- merge into a running/open span (end_timestamp = NULL)
- adjust/update paths that could create overlaps

Run from repo root:
  python backend/test_timespans.py

Optional:
  python backend/test_timespans.py --db "C:/tmp/open-worklog-timespans-test.db"
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable


BACKEND_DIR = Path(__file__).resolve().parent


def _configure_imports_and_db(db_path: Path) -> None:
    # Ensure backend modules can be imported as top-level modules (they use `import db`, `import models`, etc.)
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))

    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()

    # Point backend/db.py at our test DB before importing it (engine is created at import time).
    db_url = f"sqlite:///{db_path.resolve().as_posix()}"
    os.environ["DATABASE_URL"] = db_url


def _utc_now_naive() -> datetime:
    # Backend stores naive UTC datetimes in SQLite.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _fmt(dt: datetime | None) -> str:
    return "OPEN" if dt is None else dt.isoformat(timespec="seconds")


@dataclass(frozen=True)
class SpanView:
    id: int
    start: datetime
    end: datetime | None


def _fetch_spans(crud, db_session, entry_id: int) -> list[SpanView]:
    spans = crud.get_timespans_for_entry(db_session, entry_id)
    return [
        SpanView(id=s.id, start=s.start_timestamp, end=s.end_timestamp) for s in spans
    ]


def _assert_non_overlapping(spans: Iterable[SpanView]) -> None:
    spans_list = list(spans)
    for i in range(1, len(spans_list)):
        prev = spans_list[i - 1]
        cur = spans_list[i]
        if prev.end is None:
            raise AssertionError(
                f"Open span must be last, but span#{prev.id} is open before span#{cur.id}"
            )
        if prev.end > cur.start:
            raise AssertionError(
                "Overlapping spans detected: "
                f"prev#{prev.id} [{_fmt(prev.start)} → {_fmt(prev.end)}] "
                f"cur#{cur.id} [{_fmt(cur.start)} → {_fmt(cur.end)}]"
            )


def _dump(title: str, spans: list[SpanView]) -> None:
    print(f"\n{title}")
    if not spans:
        print("  (no spans)")
        return
    for s in spans:
        print(f"  - id={s.id}  {_fmt(s.start)}  ->  {_fmt(s.end)}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db",
        type=str,
        default="",
        help="Path to sqlite file to use (default: temp file).",
    )
    args = parser.parse_args()

    if args.db:
        db_path = Path(args.db)
    else:
        tmp_dir = Path(tempfile.gettempdir()) / "open-worklog-tests"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        db_path = tmp_dir / f"timespans-test-{int(time.time())}.db"

    _configure_imports_and_db(db_path)

    import db  # noqa: E402
    import models  # noqa: E402
    import crud  # noqa: E402
    import schemas  # noqa: E402

    models.Base.metadata.create_all(bind=db.engine)
    db.ensure_schema(db.engine)

    db_session = db.SessionLocal()
    try:
        # Shared project
        project = crud.create_project(
            db_session,
            schemas.ProjectCreate(name="Test Project", description="Timespan tests"),
        )

        def create_entry(task: str):
            return crud.create_log(
                db_session,
                schemas.LogEntryCreate(
                    date=date(2026, 1, 1),
                    category=models.Category.ROUTINE,
                    project_id=project.id,
                    task=task,
                    hours=0.0,
                    additional_hours=0.0,
                    status="Completed",
                    notes="",
                ),
            )

        # Scenario 1: overlap + <=15m gap merge, but not larger gaps
        entry1 = create_entry("scenario1")
        t = datetime(2026, 1, 1, 10, 0, 0)
        crud.create_timespan_for_entry(
            db_session, entry1.id, t, t + timedelta(minutes=30)
        )  # 10:00-10:30
        crud.create_timespan_for_entry(
            db_session, entry1.id, t + timedelta(minutes=15), t + timedelta(minutes=45)
        )  # 10:15-10:45 (overlaps)
        crud.create_timespan_for_entry(
            db_session, entry1.id, t + timedelta(minutes=60), t + timedelta(minutes=75)
        )  # 11:00-11:15 (gap 15m from 10:45)
        crud.create_timespan_for_entry(
            db_session,
            entry1.id,
            t + timedelta(minutes=120),
            t + timedelta(minutes=135),
        )  # 12:00-12:15 (gap 45m)

        spans1 = _fetch_spans(crud, db_session, entry1.id)
        _dump("Scenario 1 result (expect 2 spans: 10:00->11:15, 12:00->12:15)", spans1)
        _assert_non_overlapping(spans1)
        assert len(spans1) == 2, f"expected 2 spans, got {len(spans1)}"
        assert spans1[0].start == datetime(2026, 1, 1, 10, 0, 0)
        assert spans1[0].end == datetime(2026, 1, 1, 11, 15, 0)
        assert spans1[1].start == datetime(2026, 1, 1, 12, 0, 0)
        assert spans1[1].end == datetime(2026, 1, 1, 12, 15, 0)

        # Scenario 2: adjust causes connectability -> merge
        entry2 = create_entry("scenario2")
        base = datetime(2026, 1, 1, 9, 0, 0)
        a = crud.create_timespan_for_entry(
            db_session, entry2.id, base, base + timedelta(minutes=15)
        )  # 9:00-9:15
        crud.create_timespan_for_entry(
            db_session,
            entry2.id,
            base + timedelta(minutes=60),
            base + timedelta(minutes=75),
        )  # 10:00-10:15
        crud.adjust_timespan(
            db_session, a.id, hours=0.75
        )  # extend by 45m => end at 10:00 (touch)

        spans2 = _fetch_spans(crud, db_session, entry2.id)
        _dump("Scenario 2 result (expect 1 span: 09:00->10:15)", spans2)
        _assert_non_overlapping(spans2)
        assert len(spans2) == 1, f"expected 1 span, got {len(spans2)}"
        assert spans2[0].start == datetime(2026, 1, 1, 9, 0, 0)
        assert spans2[0].end == datetime(2026, 1, 1, 10, 15, 0)

        # Scenario 3: merge into running/open span (start_timespan_for_entry uses now)
        entry3 = create_entry("scenario3")
        now_q = crud.round_to_quarter_hour(_utc_now_naive())
        ended = crud.create_timespan_for_entry(
            db_session, entry3.id, now_q - timedelta(minutes=15), now_q
        )  # ended right up to now_q

        open_span = crud.start_timespan_for_entry(db_session, entry3.id)
        assert open_span is not None
        # If start is connectable to the previous ended span, we should reopen the
        # previous span (no new row persisted).
        assert open_span.id == ended.id, "expected to reopen the previous span"

        spans3 = _fetch_spans(crud, db_session, entry3.id)
        _dump("Scenario 3 result after start (expect 1 OPEN span)", spans3)
        _assert_non_overlapping(spans3)
        assert len(spans3) == 1, f"expected 1 span, got {len(spans3)}"
        assert spans3[0].id == ended.id, "expected previous span to be reopened"
        assert spans3[0].end is None, "expected open span end=None"
        assert spans3[0].start == now_q - timedelta(minutes=15)

        # End it and ensure still non-overlapping
        crud.end_timespan(db_session, spans3[0].id)
        spans3b = _fetch_spans(crud, db_session, entry3.id)
        _dump("Scenario 3 result after end (expect 1 ended span)", spans3b)
        _assert_non_overlapping(spans3b)
        assert len(spans3b) == 1
        assert spans3b[0].end is not None

        # Scenario 4: manual create in the future auto-closes open span
        entry4 = create_entry("scenario4")
        open_span4 = crud.start_timespan_for_entry(db_session, entry4.id)
        assert open_span4 is not None
        assert open_span4.end_timestamp is None
        now_q = crud.round_to_quarter_hour(_utc_now_naive())
        future_start = now_q + timedelta(hours=1)
        future_end = future_start + timedelta(minutes=15)
        crud.create_timespan_for_entry(db_session, entry4.id, future_start, future_end)

        spans4 = _fetch_spans(crud, db_session, entry4.id)
        _dump("Scenario 4 result (expect open span auto-closed)", spans4)
        _assert_non_overlapping(spans4)
        assert all(s.end is not None for s in spans4), "expected no open span after manual create"
        assert crud.get_active_timespan(db_session) is None

        # Scenario 5: past manual span does not close open span unless it overlaps
        entry5 = create_entry("scenario5")
        open_span5 = crud.start_timespan_for_entry(db_session, entry5.id)
        assert open_span5 is not None
        assert open_span5.end_timestamp is None

        past_start = now_q - timedelta(hours=2)
        past_end = past_start + timedelta(minutes=15)
        past_span = crud.create_timespan_for_entry(db_session, entry5.id, past_start, past_end)
        assert past_span is not None
        assert crud.get_active_timespan(db_session) is not None

        # Update past span into an overlapping window -> should close the open span
        update = schemas.TimeSpanUpdate(
            start_timestamp=now_q - timedelta(minutes=15),
            end_timestamp=now_q + timedelta(minutes=15),
        )
        crud.update_timespan(db_session, past_span.id, update)
        assert crud.get_active_timespan(db_session) is None

        # Scenario 6: dedupe identical spans on fetch
        entry6 = create_entry("scenario6")
        t0 = datetime(2026, 1, 1, 17, 15, 0)
        dup_a = models.TimeSpan(
            log_entry_id=entry6.id,
            start_timestamp=t0,
            end_timestamp=t0 + timedelta(minutes=15),
        )
        dup_b = models.TimeSpan(
            log_entry_id=entry6.id,
            start_timestamp=t0,
            end_timestamp=t0 + timedelta(minutes=15),
        )
        db_session.add_all([dup_a, dup_b])
        db_session.commit()

        spans6 = _fetch_spans(crud, db_session, entry6.id)
        _dump("Scenario 6 result (expect 1 merged span)", spans6)
        _assert_non_overlapping(spans6)
        assert len(spans6) == 1, f"expected 1 span after merge, got {len(spans6)}"

        print("\nAll TimeSpan scenarios passed.")
        print(f"Test DB: {db_path}")
        return 0
    finally:
        db_session.close()


if __name__ == "__main__":
    raise SystemExit(main())
