from datetime import date

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
