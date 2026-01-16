from datetime import date

from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import crud
import models
import schemas
from db import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Open Worklog API", openapi_url="/api/v1/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/logs/{log_date}", response_model=list[schemas.LogEntryRead])
def get_logs_for_date(log_date: date, db: Session = Depends(get_db)):
    return crud.get_logs_by_date(db, log_date)


@app.get("/api/v1/stats", response_model=list[schemas.DailyStat])
def get_stats(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
):
    return crud.get_stats(db, start_date, end_date)


@app.post("/api/v1/logs", response_model=schemas.LogEntryRead)
def create_log(log: schemas.LogEntryCreate, db: Session = Depends(get_db)):
    return crud.create_log(db, log)


@app.put("/api/v1/logs/{log_id}", response_model=schemas.LogEntryRead)
def update_log(
    log_id: int, log: schemas.LogEntryUpdate, db: Session = Depends(get_db)
):
    entry = crud.update_log(db, log_id, log)
    if not entry:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return entry


@app.delete("/api/v1/logs/{log_id}")
def delete_log(log_id: int, db: Session = Depends(get_db)):
    entry = crud.delete_log(db, log_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return {"deleted": True}


# Timer API endpoints
@app.post("/api/v1/timers/start", response_model=schemas.TimerRead)
def start_timer(request: schemas.TimerStartRequest, db: Session = Depends(get_db)):
    try:
        return crud.create_timer(db, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/v1/timers/active", response_model=schemas.TimerRead | None)
def get_active_timer(db: Session = Depends(get_db)):
    return crud.get_active_timer(db)


@app.post("/api/v1/timers/{timer_id}/pause", response_model=schemas.TimerRead)
def pause_timer(timer_id: int, db: Session = Depends(get_db)):
    timer = crud.pause_timer(db, timer_id)
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")
    return timer


@app.post("/api/v1/timers/{timer_id}/resume", response_model=schemas.TimerRead)
def resume_timer(timer_id: int, db: Session = Depends(get_db)):
    timer = crud.resume_timer(db, timer_id)
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")
    return timer


@app.post("/api/v1/timers/{timer_id}/stop", response_model=schemas.LogEntryRead)
def stop_timer(timer_id: int, db: Session = Depends(get_db)):
    entry = crud.stop_timer(db, timer_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Timer not found")
    return entry


@app.delete("/api/v1/timers/{timer_id}")
def cancel_timer(timer_id: int, db: Session = Depends(get_db)):
    timer = crud.delete_timer(db, timer_id)
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")
    return {"deleted": True}


# TimeSpan API endpoints
@app.get("/api/v1/logs/{log_id}/timespans", response_model=list[schemas.TimeSpanRead])
def get_timespans(log_id: int, db: Session = Depends(get_db)):
    entry = crud.get_log(db, log_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return crud.get_timespans_for_entry(db, log_id)


@app.post("/api/v1/timespans/{timespan_id}/adjust", response_model=schemas.TimeSpanRead)
def adjust_timespan(
    timespan_id: int,
    request: schemas.TimeSpanAdjustRequest,
    db: Session = Depends(get_db),
):
    timespan = crud.adjust_timespan(db, timespan_id, request.hours)
    if not timespan:
        raise HTTPException(status_code=404, detail="TimeSpan not found")
    return timespan


@app.put("/api/v1/timespans/{timespan_id}", response_model=schemas.TimeSpanRead)
def update_timespan(
    timespan_id: int,
    request: schemas.TimeSpanUpdate,
    db: Session = Depends(get_db),
):
    timespan = crud.update_timespan(db, timespan_id, request)
    if not timespan:
        raise HTTPException(status_code=404, detail="TimeSpan not found")
    return timespan


# Project API endpoints
@app.get("/api/v1/projects", response_model=list[schemas.ProjectRead])
def get_projects(
    search: Optional[str] = Query(None, description="Search term to filter projects by name"),
    db: Session = Depends(get_db),
):
    return crud.get_projects(db, search)


@app.post("/api/v1/projects", response_model=schemas.ProjectRead)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_project(db, project)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/v1/projects/{project_id}", response_model=schemas.ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
