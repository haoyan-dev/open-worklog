from datetime import date, datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_serializer, field_validator

from models import Category, TimerStatus


class ProjectBase(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectRead(ProjectBase):
    id: int
    created_at: datetime

    @field_serializer('created_at')
    def serialize_datetime(self, dt: datetime, _info):
        """Serialize datetime as ISO 8601 with UTC timezone indicator (Z)."""
        if dt is None:
            return None
        # Ensure timezone-aware and serialize with Z
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')

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

    @field_serializer('start_timestamp', 'end_timestamp', 'created_at')
    def serialize_datetime(self, dt: datetime, _info):
        """Serialize datetime as ISO 8601 with UTC timezone indicator (Z)."""
        if dt is None:
            return None
        # Ensure timezone-aware and serialize with Z
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')

    class Config:
        from_attributes = True


class TimeSpanAdjustRequest(BaseModel):
    hours: float  # Hours to add (positive) or subtract (negative) from end_timestamp


class TimeSpanUpdate(BaseModel):
    start_timestamp: datetime
    end_timestamp: Optional[datetime] = None

    @field_validator('start_timestamp', 'end_timestamp', mode='before')
    @classmethod
    def parse_datetime(cls, v):
        """Parse datetime string, treating timezone-naive strings as UTC.
        All timestamps are stored in the database as naive UTC datetime objects.
        """
        if v is None:
            return None
        if isinstance(v, str):
            # Handle 'Z' suffix (replace with +00:00 for fromisoformat)
            if v.endswith('Z'):
                v = v[:-1] + '+00:00'
            # Parse ISO format
            dt = datetime.fromisoformat(v)
            # If timezone-naive, assume UTC
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            # Convert to UTC and make naive for database storage
            # (SQLAlchemy DateTime columns store as naive UTC)
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        # If already a datetime object, ensure it's naive UTC
        if isinstance(v, datetime):
            if v.tzinfo is not None:
                v = v.astimezone(timezone.utc).replace(tzinfo=None)
            return v
        return v


class TimeSpanCreateRequest(TimeSpanUpdate):
    # Require end_timestamp when manually creating a session
    end_timestamp: datetime


class TimeSpanStartRequest(BaseModel):
    """Start (or resume) a running session as an open TimeSpan.

    Provide either:
    - log_entry_id: start/resume session for existing log entry
    - or (date, category, project_id, task): create a new LogEntry then start
    """

    log_entry_id: Optional[int] = None
    date: Optional[date] = None
    category: Optional[Category] = None
    project_id: Optional[int] = None
    task: Optional[str] = None


class TimerRead(BaseModel):
    id: int
    log_entry_id: Optional[int] = None
    started_at: datetime
    status: TimerStatus
    date: Optional[date] = None
    category: Optional[Category] = None
    project_id: Optional[int] = None
    task: Optional[str] = None

    @field_serializer('started_at')
    def serialize_datetime(self, dt: datetime, _info):
        """Serialize datetime as ISO 8601 with UTC timezone indicator (Z)."""
        if dt is None:
            return None
        # Ensure timezone-aware and serialize with Z
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')

    class Config:
        from_attributes = True


class TimerStartRequest(BaseModel):
    log_entry_id: Optional[int] = None
    date: Optional[date] = None
    category: Optional[Category] = None
    project_id: Optional[int] = None
    task: Optional[str] = None

