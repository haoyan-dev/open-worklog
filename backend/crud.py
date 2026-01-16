from datetime import date, datetime, timedelta

from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from models import LogEntry, Project, TimeSpan, Timer, TimerStatus
from schemas import LogEntryCreate, LogEntryUpdate, ProjectCreate, TimeSpanCreate, TimeSpanUpdate, TimerStartRequest


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


def create_log(db: Session, log: LogEntryCreate):
    log_dict = log.dict()
    additional_hours = log_dict.pop("additional_hours", 0.0)
    # Remove hours since we'll recalculate it
    log_dict.pop("hours", None)
    
    # Set initial hours to 0, will be recalculated
    entry = LogEntry(**log_dict, additional_hours=round(additional_hours * 4) / 4.0, hours=0.0)
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
    
    log_dict = log.dict()
    additional_hours = log_dict.pop("additional_hours", entry.additional_hours)
    
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
    return (
        db.query(TimeSpan)
        .filter(TimeSpan.log_entry_id == log_entry_id)
        .order_by(TimeSpan.created_at.asc())
        .all()
    )


def get_timespan(db: Session, timespan_id: int):
    return db.query(TimeSpan).filter(TimeSpan.id == timespan_id).first()


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
    
    # Ensure new_end is after start_timestamp
    if new_end <= timespan.start_timestamp:
        new_end = timespan.start_timestamp + timedelta(minutes=15)  # Minimum 0.25h
    
    timespan.end_timestamp = new_end
    db.commit()
    db.refresh(timespan)
    
    # Recalculate total hours for the log entry
    entry = get_log(db, timespan.log_entry_id)
    if entry:
        entry.hours = calculate_total_hours(db, entry.id, entry.additional_hours)
        db.commit()
        db.refresh(entry)
    
    return timespan


def update_timespan(db: Session, timespan_id: int, update: TimeSpanUpdate):
    """Update TimeSpan start_timestamp and end_timestamp.
    Rounds to nearest 0.25 hour increment and ensures minimum duration of 0.25h."""
    timespan = get_timespan(db, timespan_id)
    if not timespan:
        return None
    
    # Round timestamps to nearest 0.25h increment
    def round_to_quarter_hour(dt: datetime) -> datetime:
        """Round datetime to nearest 0.25 hour (15 minutes)."""
        total_minutes = dt.hour * 60 + dt.minute + dt.second / 60.0
        rounded_minutes = round(total_minutes / 15.0) * 15
        hours = int(rounded_minutes // 60)
        minutes = int(rounded_minutes % 60)
        return dt.replace(hour=hours, minute=minutes, second=0, microsecond=0)
    
    new_start = round_to_quarter_hour(update.start_timestamp)
    new_end = update.end_timestamp
    if new_end:
        new_end = round_to_quarter_hour(new_end)
        
        # Validate: end must be after start
        if new_end <= new_start:
            # Ensure minimum duration of 0.25h
            new_end = new_start + timedelta(minutes=15)
        
        # Calculate duration
        duration = (new_end - new_start).total_seconds() / 3600.0
        if duration < 0.25:
            # Ensure minimum duration of 0.25h
            new_end = new_start + timedelta(minutes=15)
    
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
    
    return timespan


def calculate_timespan_hours(db: Session, log_entry_id: int) -> float:
    """Calculate hours from all TimeSpans for an entry.
    Rounds to nearest 0.25 hour increment."""
    timespans = get_timespans_for_entry(db, log_entry_id)
    total_hours = 0.0
    now = datetime.utcnow()
    
    for span in timespans:
        end_time = span.end_timestamp if span.end_timestamp else now
        duration = (end_time - span.start_timestamp).total_seconds() / 3600.0
        total_hours += duration
    
    # Round to nearest 0.25 hour increment
    if total_hours > 0:
        total_hours = round(total_hours * 4) / 4.0
    
    return total_hours


def calculate_total_hours(db: Session, log_entry_id: int, additional_hours: float = 0.0) -> float:
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
    timer = Timer(
        log_entry_id=log_entry_id,
        started_at=datetime.utcnow(),
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
    now = datetime.utcnow()
    timespan = TimeSpan(
        log_entry_id=timer.log_entry_id,
        start_timestamp=timer.started_at,
        end_timestamp=now,
    )
    db.add(timespan)
    
    # Update timer status
    timer.status = TimerStatus.PAUSED
    db.commit()
    db.refresh(timer)
    return timer


def resume_timer(db: Session, timer_id: int):
    """Resume paused timer with new started_at timestamp."""
    timer = db.query(Timer).filter(Timer.id == timer_id).first()
    if not timer:
        return None
    
    if timer.status != TimerStatus.PAUSED:
        return timer
    
    # Set new started_at and status
    timer.started_at = datetime.utcnow()
    timer.status = TimerStatus.RUNNING
    db.commit()
    db.refresh(timer)
    return timer


def stop_timer(db: Session, timer_id: int):
    """Stop timer, create final TimeSpan, calculate hours, and delete timer."""
    timer = db.query(Timer).filter(Timer.id == timer_id).first()
    if not timer:
        return None
    
    now = datetime.utcnow()
    
    # Create final TimeSpan
    timespan = TimeSpan(
        log_entry_id=timer.log_entry_id,
        start_timestamp=timer.started_at,
        end_timestamp=now,
    )
    db.add(timespan)
    
    # Update log entry hours = TimeSpan hours + additional hours
    entry = get_log(db, timer.log_entry_id)
    if entry:
        entry.hours = calculate_total_hours(db, timer.log_entry_id, entry.additional_hours)
        db.commit()
        db.refresh(entry)
    
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
