from datetime import date, datetime, timezone
from enum import Enum

from sqlalchemy import Column, Date, DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from db import Base


def utc_now():
    """Return current UTC time as naive datetime for database storage.
    SQLAlchemy DateTime columns store as naive UTC datetime objects.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Category(str, Enum):
    ROUTINE = "Routine Work"
    OKR = "OKR"
    TEAM = "Team Contribution"
    COMPANY = "Company Contribution"


class TimerStatus(str, Enum):
    RUNNING = "running"
    PAUSED = "paused"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    log_entries = relationship("LogEntry", back_populates="project_rel")


class LogEntry(Base):
    __tablename__ = "log_entries"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    category = Column(SqlEnum(Category), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    task = Column(Text, nullable=False)
    hours = Column(Float, nullable=False)  # Total hours = TimeSpan hours + additional_hours
    additional_hours = Column(Float, nullable=False, default=0.0)  # Manually added hours
    status = Column(String(50), nullable=True, default="Completed")
    notes = Column(Text, nullable=True)
    timespans = relationship("TimeSpan", back_populates="log_entry", cascade="all, delete-orphan")
    project_rel = relationship("Project", back_populates="log_entries")

    @property
    def project_name(self) -> str | None:
        """Get project name from relationship for API responses."""
        return self.project_rel.name if self.project_rel else None


class TimeSpan(Base):
    __tablename__ = "time_spans"

    id = Column(Integer, primary_key=True, index=True)
    log_entry_id = Column(Integer, ForeignKey("log_entries.id"), nullable=False, index=True)
    start_timestamp = Column(DateTime, nullable=False)
    end_timestamp = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    log_entry = relationship("LogEntry", back_populates="timespans")


class Timer(Base):
    __tablename__ = "timers"

    id = Column(Integer, primary_key=True, index=True)
    log_entry_id = Column(Integer, ForeignKey("log_entries.id"), nullable=True, index=True)
    started_at = Column(DateTime, nullable=False)
    status = Column(SqlEnum(TimerStatus), nullable=False)
    date = Column(Date, nullable=True)
    category = Column(SqlEnum(Category), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    task = Column(Text, nullable=True)
