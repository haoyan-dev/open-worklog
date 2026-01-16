from datetime import date, datetime
from enum import Enum

from sqlalchemy import Column, Date, DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from db import Base


class Category(str, Enum):
    ROUTINE = "Routine Work"
    OKR = "OKR"
    TEAM = "Team Contribution"
    COMPANY = "Company Contribution"


class TimerStatus(str, Enum):
    RUNNING = "running"
    PAUSED = "paused"


class LogEntry(Base):
    __tablename__ = "log_entries"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    category = Column(SqlEnum(Category), nullable=False)
    project = Column(String(200), nullable=False)
    task = Column(Text, nullable=False)
    hours = Column(Float, nullable=False)
    status = Column(String(50), nullable=True, default="Completed")
    notes = Column(Text, nullable=True)
    timespans = relationship("TimeSpan", back_populates="log_entry", cascade="all, delete-orphan")


class TimeSpan(Base):
    __tablename__ = "time_spans"

    id = Column(Integer, primary_key=True, index=True)
    log_entry_id = Column(Integer, ForeignKey("log_entries.id"), nullable=False, index=True)
    start_timestamp = Column(DateTime, nullable=False)
    end_timestamp = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    log_entry = relationship("LogEntry", back_populates="timespans")


class Timer(Base):
    __tablename__ = "timers"

    id = Column(Integer, primary_key=True, index=True)
    log_entry_id = Column(Integer, ForeignKey("log_entries.id"), nullable=True, index=True)
    started_at = Column(DateTime, nullable=False)
    status = Column(SqlEnum(TimerStatus), nullable=False)
    date = Column(Date, nullable=True)
    category = Column(SqlEnum(Category), nullable=True)
    project = Column(String(200), nullable=True)
    task = Column(Text, nullable=True)
