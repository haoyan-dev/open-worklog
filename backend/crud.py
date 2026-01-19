from datetime import date, datetime, timedelta, timezone
import uuid as uuidlib

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import LogEntry, Project, TimeSpan, Timer, TimerStatus
from time_merge import SpanLike, plan_connectable_timespan_merges
from schemas import (
    LogEntryCreate,
    LogEntryUpdate,
    ProjectCreate,
    TimeSpanUpdate,
    TimerStartRequest,
)


QUARTER_HOUR_MINUTES = 15


def round_to_quarter_hour(dt: datetime) -> datetime:
    """Round a datetime to the nearest 15-minute boundary.

    Notes:
    - Works for naive UTC datetimes (as stored in the DB).
    - Includes seconds/microseconds in rounding.
    - Handles day rollover (e.g., 23:59:50 rounding up to next day 00:00).
    """
    total_minutes = (
        dt.hour * 60 + dt.minute + dt.second / 60.0 + dt.microsecond / 60_000_000.0
    )
    rounded_minutes = int(
        round(total_minutes / QUARTER_HOUR_MINUTES) * QUARTER_HOUR_MINUTES
    )
    midnight = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight + timedelta(minutes=rounded_minutes)


def normalize_span(
    start_timestamp: datetime, end_timestamp: datetime | None
) -> tuple[datetime, datetime | None]:
    """Normalize a span by rounding to quarter-hour and enforcing min duration."""
    new_start = round_to_quarter_hour(start_timestamp)
    if end_timestamp is None:
        return new_start, None

    new_end = round_to_quarter_hour(end_timestamp)
    if new_end <= new_start:
        new_end = new_start + timedelta(minutes=QUARTER_HOUR_MINUTES)

    duration = (new_end - new_start).total_seconds() / 3600.0
    if duration < 0.25:
        new_end = new_start + timedelta(minutes=QUARTER_HOUR_MINUTES)

    return new_start, new_end


def maybe_close_open_timespan(
    db: Session,
    *,
    incoming_start: datetime,
    incoming_end: datetime | None,
    exclude_timespan_id: int | None = None,
) -> None:
    """Close a running span if a manual change would overlap or be in the future."""
    active = get_active_timespan(db)
    if not active:
        return
    if exclude_timespan_id is not None and active.id == exclude_timespan_id:
        return

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if incoming_start > now:
        end_timespan(db, active.id)
        return

    open_start = active.start_timestamp
    open_end = now
    candidate_end = incoming_end or now
    overlaps = incoming_start <= open_end and candidate_end >= open_start
    if overlaps:
        end_timespan(db, active.id)


def merge_connectable_timespans_for_entry(
    db: Session,
    log_entry_id: int,
    gap_minutes: int = QUARTER_HOUR_MINUTES,
    prefer_timespan_id: int | None = None,
) -> None:
    """Merge connectable TimeSpans for an entry so they never overlap.

    Connectable rule (inclusive): next.start <= current.end + gap
    - Overlaps are included (next.start < current.end)
    - Touching spans are included (next.start == current.end)
    - Small gaps up to gap_minutes are included

    Open/running spans (end_timestamp is NULL) are treated as end=now for
    connectability checks so they do not absorb future spans.
    """
    spans = (
        db.query(TimeSpan)
        .filter(TimeSpan.log_entry_id == log_entry_id)
        .order_by(TimeSpan.start_timestamp.asc(), TimeSpan.id.asc())
        .all()
    )
    if len(spans) <= 1:
        return

    span_likes = [
        SpanLike(id=s.id, start_timestamp=s.start_timestamp, end_timestamp=s.end_timestamp)
        for s in spans
    ]
    reference_now = datetime.now(timezone.utc).replace(tzinfo=None)
    plans = plan_connectable_timespan_merges(
        span_likes,
        gap_minutes=gap_minutes,
        prefer_timespan_id=prefer_timespan_id,
        reference_now=reference_now,
    )
    if not plans:
        return

    by_id: dict[int, TimeSpan] = {s.id: s for s in spans}
    for plan in plans:
        keeper = by_id.get(plan.keeper_id)
        if keeper is None:
            # Should not happen; be defensive.
            continue
        keeper.start_timestamp = plan.merged_start
        keeper.end_timestamp = plan.merged_end
        for delete_id in plan.delete_ids:
            span = by_id.get(delete_id)
            if span is not None:
                db.delete(span)

    db.commit()

    entry = get_log(db, log_entry_id)
    if entry:
        entry.hours = calculate_total_hours(db, entry.id, entry.additional_hours)
        db.commit()


def get_logs_by_date(db: Session, target_date: date):
    from sqlalchemy.orm import joinedload

    return (
        db.query(LogEntry)
        .options(joinedload(LogEntry.project_rel))
        .filter(LogEntry.date == target_date)
        .order_by(LogEntry.id.asc())
        .all()
    )


def get_log(db: Session, log_id: int):
    from sqlalchemy.orm import joinedload

    return (
        db.query(LogEntry)
        .options(joinedload(LogEntry.project_rel))
        .filter(LogEntry.id == log_id)
        .first()
    )


def get_log_by_uuid(db: Session, log_uuid: str):
    from sqlalchemy.orm import joinedload

    return (
        db.query(LogEntry)
        .options(joinedload(LogEntry.project_rel))
        .filter(LogEntry.uuid == log_uuid)
        .first()
    )


def create_log(db: Session, log: LogEntryCreate):
    log_dict = log.model_dump()
    additional_hours = log_dict.pop("additional_hours", 0.0)
    # Remove hours since we'll recalculate it
    log_dict.pop("hours", None)
    # Ensure server-side UUID exists even if DB didn't apply default (or client omitted).
    log_dict.setdefault("uuid", str(uuidlib.uuid4()))

    # Set initial hours to 0, will be recalculated
    entry = LogEntry(
        **log_dict, additional_hours=round(additional_hours * 4) / 4.0, hours=0.0
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Calculate total hours = TimeSpan hours + additional hours
    entry.hours = calculate_total_hours(db, entry.id, entry.additional_hours)

    db.commit()
    db.refresh(entry)
    # Eager load project relationship
    from sqlalchemy.orm import joinedload

    entry = (
        db.query(LogEntry)
        .options(joinedload(LogEntry.project_rel))
        .filter(LogEntry.id == entry.id)
        .first()
    )
    return entry


def update_log(db: Session, log_id: int, log: LogEntryUpdate):
    entry = get_log(db, log_id)
    if not entry:
        return None

    # Use exclude_unset so omitted optional fields (like previous_task_uuid) won't be overwritten.
    log_dict = log.model_dump(exclude_unset=True)
    additional_hours = log_dict.pop("additional_hours", entry.additional_hours)
    # Never allow uuid to change via update payload.
    log_dict.pop("uuid", None)

    # Update all fields except hours (which will be recalculated)
    for field, value in log_dict.items():
        if field != "hours":
            setattr(entry, field, value)

    # Update additional_hours
    entry.additional_hours = round(additional_hours * 4) / 4.0

    # Calculate total hours = TimeSpan hours + additional hours
    entry.hours = calculate_total_hours(db, entry.id, entry.additional_hours)

    db.commit()
    db.refresh(entry)
    # Eager load project relationship
    from sqlalchemy.orm import joinedload

    entry = (
        db.query(LogEntry)
        .options(joinedload(LogEntry.project_rel))
        .filter(LogEntry.id == entry.id)
        .first()
    )
    return entry


def delete_log(db: Session, log_id: int):
    entry = get_log(db, log_id)
    if not entry:
        return None
    db.delete(entry)
    db.commit()
    return entry


def get_stats(db: Session, start_date: date, end_date: date):
    rows = (
        db.query(
            LogEntry.date.label("date"),
            LogEntry.category.label("category"),
            func.sum(LogEntry.hours).label("hours"),
        )
        .filter(LogEntry.date >= start_date, LogEntry.date <= end_date)
        .group_by(LogEntry.date, LogEntry.category)
        .all()
    )

    stats_map: dict[date, dict] = {}
    for row in rows:
        day = stats_map.setdefault(
            row.date, {"date": row.date, "total_hours": 0.0, "category_hours": {}}
        )
        day["total_hours"] += float(row.hours)
        day["category_hours"][row.category.value] = float(row.hours)

    return list(stats_map.values())


# Project CRUD operations
def get_projects(db: Session, search: Optional[str] = None):
    """Get all projects, optionally filtered by search term."""
    query = db.query(Project)
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(Project.name.ilike(search_term))
    return query.order_by(Project.name.asc()).all()


def get_project(db: Session, project_id: int):
    """Get a single project by ID."""
    return db.query(Project).filter(Project.id == project_id).first()


def create_project(db: Session, project: ProjectCreate):
    """Create a new project. Enforces uniqueness of project name."""
    # Check if project with same name already exists
    existing = db.query(Project).filter(Project.name == project.name).first()
    if existing:
        raise ValueError(f"Project with name '{project.name}' already exists")

    project_dict = project.dict()
    new_project = Project(**project_dict)
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project


def search_projects(db: Session, query: str):
    """Search projects by name (case-insensitive partial match)."""
    search_term = f"%{query.lower()}%"
    return (
        db.query(Project)
        .filter(Project.name.ilike(search_term))
        .order_by(Project.name.asc())
        .all()
    )


# TimeSpan CRUD operations
def get_timespans_for_entry(db: Session, log_entry_id: int):
    merge_connectable_timespans_for_entry(db, log_entry_id)
    return (
        db.query(TimeSpan)
        .filter(TimeSpan.log_entry_id == log_entry_id)
        .order_by(TimeSpan.start_timestamp.asc(), TimeSpan.id.asc())
        .all()
    )


def get_timespan(db: Session, timespan_id: int):
    return db.query(TimeSpan).filter(TimeSpan.id == timespan_id).first()


def get_active_timespan(db: Session) -> TimeSpan | None:
    """Return the currently running (open) TimeSpan, if any.

    Running/open is defined as end_timestamp == NULL.

    Note: we enforce at most one open TimeSpan via start_timespan_for_entry(),
    but we still pick the most recent one defensively.
    """
    return (
        db.query(TimeSpan)
        .filter(TimeSpan.end_timestamp.is_(None))
        .order_by(TimeSpan.created_at.desc())
        .first()
    )


def end_timespan(db: Session, timespan_id: int) -> TimeSpan | None:
    """End an open TimeSpan (set end_timestamp) and recalc LogEntry.hours.

    - Rounds to nearest 15 minutes.
    - Ensures minimum duration of 0.25h.
    """
    timespan = get_timespan(db, timespan_id)
    if not timespan:
        return None

    if timespan.end_timestamp:
        # Already ended; no-op.
        merge_connectable_timespans_for_entry(
            db, timespan.log_entry_id, prefer_timespan_id=timespan.id
        )
        return timespan

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start_ts, end_ts = normalize_span(timespan.start_timestamp, now)

    timespan.start_timestamp = start_ts
    timespan.end_timestamp = end_ts
    db.commit()
    db.refresh(timespan)

    entry = get_log(db, timespan.log_entry_id)
    if entry:
        entry.hours = calculate_total_hours(db, entry.id, entry.additional_hours)
        db.commit()
        db.refresh(entry)

    merge_connectable_timespans_for_entry(
        db, timespan.log_entry_id, prefer_timespan_id=timespan.id
    )
    return timespan


def start_timespan_for_entry(db: Session, log_entry_id: int) -> TimeSpan | None:
    """Start a new running TimeSpan (end_timestamp=NULL) for the given LogEntry.

    Active policy: if another TimeSpan is currently running (open), we auto-end it
    (auto-pause) before creating the new running TimeSpan.
    """
    entry = get_log(db, log_entry_id)
    if not entry:
        return None

    active = get_active_timespan(db)
    if active:
        # If the active session is already for this entry, just return it.
        if active.log_entry_id == log_entry_id:
            return active
        # Otherwise auto-pause the existing active session.
        end_timespan(db, active.id)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start_ts = round_to_quarter_hour(now)

    # If the most recent span for this entry is connectable (<= 15m gap),
    # reopen it instead of creating a new row.
    last_span = (
        db.query(TimeSpan)
        .filter(TimeSpan.log_entry_id == log_entry_id)
        .order_by(TimeSpan.start_timestamp.desc(), TimeSpan.id.desc())
        .first()
    )
    if last_span:
        if last_span.end_timestamp is None:
            return last_span
        if last_span.end_timestamp is not None:
            if start_ts <= last_span.end_timestamp + timedelta(
                minutes=QUARTER_HOUR_MINUTES
            ):
                last_span.end_timestamp = None
                db.commit()
                db.refresh(last_span)

                # Recalculate total hours for the log entry (open spans don't count).
                entry.hours = calculate_total_hours(
                    db, entry.id, entry.additional_hours
                )
                db.commit()
                db.refresh(entry)
                return last_span

    timespan = TimeSpan(
        log_entry_id=log_entry_id,
        start_timestamp=start_ts,
        end_timestamp=None,
    )
    db.add(timespan)
    db.commit()
    db.refresh(timespan)
    merge_connectable_timespans_for_entry(
        db, log_entry_id, prefer_timespan_id=timespan.id
    )
    return timespan


def adjust_timespan(db: Session, timespan_id: int, hours: float):
    """Adjust TimeSpan end_timestamp by adding/subtracting hours.
    Rounds to nearest 0.25 hour increment."""
    timespan = get_timespan(db, timespan_id)
    if not timespan:
        return None

    if not timespan.end_timestamp:
        # If no end_timestamp, can't adjust
        return timespan

    # Calculate new end_timestamp
    hours_rounded = round(hours * 4) / 4.0
    adjustment = timedelta(hours=hours_rounded)
    new_end = timespan.end_timestamp + adjustment

    maybe_close_open_timespan(
        db,
        incoming_start=timespan.start_timestamp,
        incoming_end=new_end,
        exclude_timespan_id=timespan.id,
    )

    # Ensure new_end is after start_timestamp
    new_start, new_end = normalize_span(timespan.start_timestamp, new_end)

    timespan.start_timestamp = new_start
    timespan.end_timestamp = new_end
    db.commit()
    db.refresh(timespan)

    # Recalculate total hours for the log entry
    entry = get_log(db, timespan.log_entry_id)
    if entry:
        entry.hours = calculate_total_hours(db, entry.id, entry.additional_hours)
        db.commit()
        db.refresh(entry)

    merge_connectable_timespans_for_entry(
        db, timespan.log_entry_id, prefer_timespan_id=timespan.id
    )
    return timespan


def update_timespan(db: Session, timespan_id: int, update: TimeSpanUpdate):
    """Update TimeSpan start_timestamp and end_timestamp.
    Rounds to nearest 0.25 hour increment and ensures minimum duration of 0.25h."""
    timespan = get_timespan(db, timespan_id)
    if not timespan:
        return None

    new_start, new_end = normalize_span(update.start_timestamp, update.end_timestamp)
    maybe_close_open_timespan(
        db,
        incoming_start=new_start,
        incoming_end=new_end,
        exclude_timespan_id=timespan.id,
    )

    timespan.start_timestamp = new_start
    timespan.end_timestamp = new_end
    db.commit()
    db.refresh(timespan)

    # Recalculate total hours for the log entry
    entry = get_log(db, timespan.log_entry_id)
    if entry:
        entry.hours = calculate_total_hours(db, entry.id, entry.additional_hours)
        db.commit()
        db.refresh(entry)

    merge_connectable_timespans_for_entry(
        db, timespan.log_entry_id, prefer_timespan_id=timespan.id
    )
    return timespan


def create_timespan_for_entry(
    db: Session, log_entry_id: int, start_timestamp: datetime, end_timestamp: datetime
):
    """Create a new TimeSpan for a log entry.

    Rounds to nearest 0.25 hour increment and ensures minimum duration of 0.25h.
    """
    entry = get_log(db, log_entry_id)
    if not entry:
        return None

    new_start, new_end = normalize_span(start_timestamp, end_timestamp)
    maybe_close_open_timespan(
        db,
        incoming_start=new_start,
        incoming_end=new_end,
    )

    timespan = TimeSpan(
        log_entry_id=log_entry_id,
        start_timestamp=new_start,
        end_timestamp=new_end,
    )
    db.add(timespan)
    db.commit()
    db.refresh(timespan)

    # Recalculate total hours for the log entry
    entry.hours = calculate_total_hours(db, entry.id, entry.additional_hours)
    db.commit()
    db.refresh(entry)

    merge_connectable_timespans_for_entry(
        db, log_entry_id, prefer_timespan_id=timespan.id
    )
    return timespan


def delete_timespan(db: Session, timespan_id: int):
    """Delete a TimeSpan and recalculate log entry hours."""
    timespan = get_timespan(db, timespan_id)
    if not timespan:
        return None

    log_entry_id = timespan.log_entry_id
    db.delete(timespan)
    db.commit()

    # Recalculate total hours for the log entry
    entry = get_log(db, log_entry_id)
    if entry:
        entry.hours = calculate_total_hours(db, entry.id, entry.additional_hours)
        db.commit()
        db.refresh(entry)

    return True


def calculate_timespan_hours(db: Session, log_entry_id: int) -> float:
    """Calculate hours from all TimeSpans for an entry.
    Rounds to nearest 0.25 hour increment."""
    timespans = get_timespans_for_entry(db, log_entry_id)
    total_hours = 0.0

    for span in timespans:
        # Settled-hours policy: open sessions (end_timestamp is NULL) don't count
        # toward LogEntry.hours until they are ended.
        if not span.end_timestamp:
            continue
        end_time = span.end_timestamp
        duration = (end_time - span.start_timestamp).total_seconds() / 3600.0
        total_hours += duration

    # Round to nearest 0.25 hour increment
    if total_hours > 0:
        total_hours = round(total_hours * 4) / 4.0

    return total_hours


def calculate_total_hours(
    db: Session, log_entry_id: int, additional_hours: float = 0.0
) -> float:
    """Calculate total hours = TimeSpan hours + additional hours.
    Rounds to nearest 0.25 hour increment."""
    timespan_hours = calculate_timespan_hours(db, log_entry_id)
    additional_hours_rounded = round(additional_hours * 4) / 4.0
    total = timespan_hours + additional_hours_rounded
    return round(total * 4) / 4.0


# Timer CRUD operations
def get_active_timer(db: Session):
    """Get the currently active timer (running or paused)."""
    return db.query(Timer).first()


def create_timer(db: Session, request: TimerStartRequest):
    """Create a new timer, enforcing only one active timer."""
    # Stop/delete any existing active timer
    existing_timer = get_active_timer(db)
    if existing_timer:
        db.delete(existing_timer)
        db.commit()

    log_entry_id = request.log_entry_id

    # If no log_entry_id provided, create new log entry
    if not log_entry_id:
        if not all([request.date, request.category, request.project_id, request.task]):
            raise ValueError("Missing required fields for new log entry")

        new_entry = LogEntry(
            date=request.date,
            category=request.category,
            project_id=request.project_id,
            task=request.task,
            hours=0.0,
            status="Completed",
        )
        db.add(new_entry)
        db.commit()
        db.refresh(new_entry)
        log_entry_id = new_entry.id

    # Create new timer
    # Use timezone-aware UTC datetime, then convert to naive for database storage
    # (SQLAlchemy DateTime columns store as naive UTC)
    timer = Timer(
        log_entry_id=log_entry_id,
        started_at=round_to_quarter_hour(
            datetime.now(timezone.utc).replace(tzinfo=None)
        ),
        status=TimerStatus.RUNNING,
    )
    db.add(timer)
    db.commit()
    db.refresh(timer)
    return timer


def pause_timer(db: Session, timer_id: int):
    """Pause timer and create TimeSpan record."""
    timer = db.query(Timer).filter(Timer.id == timer_id).first()
    if not timer:
        return None

    if timer.status != TimerStatus.RUNNING:
        return timer

    # Create TimeSpan for the current session
    # Use timezone-aware UTC datetime, then convert to naive for database storage
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start_ts, end_ts = normalize_span(timer.started_at, now)
    timespan = TimeSpan(
        log_entry_id=timer.log_entry_id,
        start_timestamp=start_ts,
        end_timestamp=end_ts,
    )
    db.add(timespan)

    # Update timer status
    timer.status = TimerStatus.PAUSED
    db.commit()
    db.refresh(timer)
    merge_connectable_timespans_for_entry(
        db, timer.log_entry_id, prefer_timespan_id=timespan.id
    )
    return timer


def resume_timer(db: Session, timer_id: int):
    """Resume paused timer with new started_at timestamp."""
    timer = db.query(Timer).filter(Timer.id == timer_id).first()
    if not timer:
        return None

    if timer.status != TimerStatus.PAUSED:
        return timer

    # Set new started_at and status
    # Use timezone-aware UTC datetime, then convert to naive for database storage
    timer.started_at = round_to_quarter_hour(
        datetime.now(timezone.utc).replace(tzinfo=None)
    )
    timer.status = TimerStatus.RUNNING
    db.commit()
    db.refresh(timer)
    return timer


def stop_timer(db: Session, timer_id: int):
    """Stop timer, create final TimeSpan, calculate hours, and delete timer."""
    timer = db.query(Timer).filter(Timer.id == timer_id).first()
    if not timer:
        return None

    # Use timezone-aware UTC datetime, then convert to naive for database storage
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start_ts, end_ts = normalize_span(timer.started_at, now)

    # Create final TimeSpan
    timespan = TimeSpan(
        log_entry_id=timer.log_entry_id,
        start_timestamp=start_ts,
        end_timestamp=end_ts,
    )
    db.add(timespan)

    # Update log entry hours = TimeSpan hours + additional hours
    entry = get_log(db, timer.log_entry_id)
    if entry:
        entry.hours = calculate_total_hours(
            db, timer.log_entry_id, entry.additional_hours
        )
        db.commit()
        db.refresh(entry)

    merge_connectable_timespans_for_entry(
        db, timer.log_entry_id, prefer_timespan_id=timespan.id
    )

    # Delete timer
    db.delete(timer)
    db.commit()

    return entry


def delete_timer(db: Session, timer_id: int):
    """Cancel timer without saving."""
    timer = db.query(Timer).filter(Timer.id == timer_id).first()
    if not timer:
        return None

    db.delete(timer)
    db.commit()
    return timer
