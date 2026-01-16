from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from models import Category, TimerStatus


class ProjectBase(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectRead(ProjectBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class LogEntryBase(BaseModel):
    date: date
    category: Category
    project_id: int
    task: str
    hours: float = Field(..., ge=0)  # Total hours (calculated: TimeSpan hours + additional_hours)
    additional_hours: float = Field(default=0.0, ge=0)  # Manually added hours
    status: Optional[str] = "Completed"
    notes: Optional[str] = None


class LogEntryCreate(LogEntryBase):
    pass


class LogEntryUpdate(LogEntryBase):
    pass


class LogEntryRead(LogEntryBase):
    id: int
    project_name: Optional[str] = None  # Populated from relationship

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


class TimeSpanAdjustRequest(BaseModel):
    hours: float  # Hours to add (positive) or subtract (negative) from end_timestamp


class TimeSpanUpdate(BaseModel):
    start_timestamp: datetime
    end_timestamp: Optional[datetime] = None


class TimerRead(BaseModel):
    id: int
    log_entry_id: Optional[int] = None
    started_at: datetime
    status: TimerStatus
    date: Optional[date] = None
    category: Optional[Category] = None
    project_id: Optional[int] = None
    task: Optional[str] = None

    class Config:
        from_attributes = True


class TimerStartRequest(BaseModel):
    log_entry_id: Optional[int] = None
    date: Optional[date] = None
    category: Optional[Category] = None
    project_id: Optional[int] = None
    task: Optional[str] = None

