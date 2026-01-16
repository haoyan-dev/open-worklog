from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from models import Category, TimerStatus


class LogEntryBase(BaseModel):
    date: date
    category: Category
    project: str = Field(..., max_length=200)
    task: str
    hours: float = Field(..., gt=0)
    status: Optional[str] = "Completed"
    notes: Optional[str] = None


class LogEntryCreate(LogEntryBase):
    pass


class LogEntryUpdate(LogEntryBase):
    pass


class LogEntryRead(LogEntryBase):
    id: int

    class Config:
        from_attributes = True


class DailyStat(BaseModel):
    date: date
    total_hours: float
    category_hours: dict[str, float]


class TimeSpanBase(BaseModel):
    log_entry_id: int
    start_timestamp: datetime
    end_timestamp: Optional[datetime] = None


class TimeSpanCreate(TimeSpanBase):
    pass


class TimeSpanRead(TimeSpanBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TimerRead(BaseModel):
    id: int
    log_entry_id: Optional[int] = None
    started_at: datetime
    status: TimerStatus
    date: Optional[date] = None
    category: Optional[Category] = None
    project: Optional[str] = None
    task: Optional[str] = None

    class Config:
        from_attributes = True


class TimerStartRequest(BaseModel):
    log_entry_id: Optional[int] = None
    date: Optional[date] = None
    category: Optional[Category] = None
    project: Optional[str] = None
    task: Optional[str] = None

