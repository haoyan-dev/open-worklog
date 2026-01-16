from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from models import Category


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

