from datetime import date
from enum import Enum

from sqlalchemy import Column, Date, Enum as SqlEnum, Float, Integer, String, Text

from db import Base


class Category(str, Enum):
    ROUTINE = "Routine Work"
    OKR = "OKR"
    TEAM = "Team Contribution"
    COMPANY = "Company Contribution"


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
