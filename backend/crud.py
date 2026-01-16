from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import LogEntry, TimeSpan, Timer, TimerStatus
from schemas import LogEntryCreate, LogEntryUpdate, TimeSpanCreate, TimerStartRequest


def get_logs_by_date(db: Session, target_date: date):
    return (
        db.query(LogEntry)
        .filter(LogEntry.date == target_date)
        .order_by(LogEntry.id.asc())
        .all()
    )


def get_log(db: Session, log_id: int):
    return db.query(LogEntry).filter(LogEntry.id == log_id).first()


def create_log(db: Session, log: LogEntryCreate):
    entry = LogEntry(**log.dict())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    # Note: Hours are calculated from TimeSpans only when timer stops
    # Manual hours input takes precedence
    return entry


def update_log(db: Session, log_id: int, log: LogEntryUpdate):
    entry = get_log(db, log_id)
    if not entry:
        return None
    for field, value in log.dict().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    # Note: Hours are calculated from TimeSpans only when timer stops
    # Manual hours input takes precedence
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


# TimeSpan CRUD operations
def get_timespans_for_entry(db: Session, log_entry_id: int):
    return (
        db.query(TimeSpan)
        .filter(TimeSpan.log_entry_id == log_entry_id)
        .order_by(TimeSpan.created_at.asc())
        .all()
    )


def calculate_entry_hours(db: Session, log_entry_id: int) -> float:
    """Calculate total hours from all TimeSpans for an entry."""
    timespans = get_timespans_for_entry(db, log_entry_id)
    total_hours = 0.0
    now = datetime.utcnow()
    
    for span in timespans:
        end_time = span.end_timestamp if span.end_timestamp else now
        duration = (end_time - span.start_timestamp).total_seconds() / 3600.0
        total_hours += duration
    
    return total_hours


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
        if not all([request.date, request.category, request.project, request.task]):
            raise ValueError("Missing required fields for new log entry")
        
        new_entry = LogEntry(
            date=request.date,
            category=request.category,
            project=request.project,
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
    
    # Calculate total hours from all TimeSpans
    total_hours = calculate_entry_hours(db, timer.log_entry_id)
    
    # Update log entry hours
    entry = get_log(db, timer.log_entry_id)
    if entry:
        entry.hours = total_hours
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
