from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import models
import schemas
from db import get_db

router = APIRouter()


# Running (open) TimeSpan lifecycle endpoints
@router.get("/timespans/active", response_model=schemas.TimeSpanRead | None)
def get_active_timespan(db: Session = Depends(get_db)):
    return crud.get_active_timespan(db)


@router.post("/timespans/start", response_model=schemas.TimeSpanRead)
def start_timespan(request: schemas.TimeSpanStartRequest, db: Session = Depends(get_db)):
    # Start on an existing entry
    if request.log_entry_id is not None:
        timespan = crud.start_timespan_for_entry(db, request.log_entry_id)
        if not timespan:
            raise HTTPException(status_code=404, detail="Log entry not found")
        return timespan

    # Otherwise create a new entry then start
    if not all([request.date, request.category, request.project_id, request.task]):
        raise HTTPException(
            status_code=400,
            detail="Missing required fields: provide log_entry_id OR (date, category, project_id, task)",
        )

    new_entry = models.LogEntry(
        date=request.date,
        category=request.category,
        project_id=request.project_id,
        task=request.task,
        hours=0.0,
        additional_hours=0.0,
        status="Completed",
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    timespan = crud.start_timespan_for_entry(db, new_entry.id)
    if not timespan:
        raise HTTPException(status_code=500, detail="Failed to start session")
    return timespan


@router.post("/timespans/{timespan_id}/pause", response_model=schemas.TimeSpanRead)
def pause_timespan(timespan_id: int, db: Session = Depends(get_db)):
    timespan = crud.end_timespan(db, timespan_id)
    if not timespan:
        raise HTTPException(status_code=404, detail="TimeSpan not found")
    return timespan


# TimeSpan API endpoints
@router.get("/logs/{log_id}/timespans", response_model=list[schemas.TimeSpanRead])
def get_timespans(log_id: int, db: Session = Depends(get_db)):
    entry = crud.get_log(db, log_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return crud.get_timespans_for_entry(db, log_id)


@router.post("/logs/{log_id}/timespans", response_model=schemas.TimeSpanRead)
def create_timespan(
    log_id: int,
    request: schemas.TimeSpanCreateRequest,
    db: Session = Depends(get_db),
):
    timespan = crud.create_timespan_for_entry(
        db, log_id, request.start_timestamp, request.end_timestamp
    )
    if not timespan:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return timespan


@router.post("/timespans/{timespan_id}/adjust", response_model=schemas.TimeSpanRead)
def adjust_timespan(
    timespan_id: int,
    request: schemas.TimeSpanAdjustRequest,
    db: Session = Depends(get_db),
):
    timespan = crud.adjust_timespan(db, timespan_id, request.hours)
    if not timespan:
        raise HTTPException(status_code=404, detail="TimeSpan not found")
    return timespan


@router.put("/timespans/{timespan_id}", response_model=schemas.TimeSpanRead)
def update_timespan(
    timespan_id: int,
    request: schemas.TimeSpanUpdate,
    db: Session = Depends(get_db),
):
    timespan = crud.update_timespan(db, timespan_id, request)
    if not timespan:
        raise HTTPException(status_code=404, detail="TimeSpan not found")
    return timespan


@router.delete("/timespans/{timespan_id}")
def delete_timespan(timespan_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_timespan(db, timespan_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="TimeSpan not found")
    return {"deleted": True}

