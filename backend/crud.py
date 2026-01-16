from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import LogEntry
from schemas import LogEntryCreate, LogEntryUpdate


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
    return entry


def update_log(db: Session, log_id: int, log: LogEntryUpdate):
    entry = get_log(db, log_id)
    if not entry:
        return None
    for field, value in log.dict().items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
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
