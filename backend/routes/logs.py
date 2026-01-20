from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import schemas
from db import get_db

router = APIRouter()


@router.get("/logs/{log_date}", response_model=list[schemas.LogEntryRead])
def get_logs_for_date(log_date: date, db: Session = Depends(get_db)):
    return crud.get_logs_by_date(db, log_date)


@router.get("/logs/uuid/{log_uuid}", response_model=schemas.LogEntryRead)
def get_log_by_uuid(log_uuid: str, db: Session = Depends(get_db)):
    entry = crud.get_log_by_uuid(db, log_uuid)
    if not entry:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return entry


@router.post("/logs", response_model=schemas.LogEntryRead)
def create_log(log: schemas.LogEntryCreate, db: Session = Depends(get_db)):
    return crud.create_log(db, log)


@router.put("/logs/{log_id}", response_model=schemas.LogEntryRead)
def update_log(log_id: int, log: schemas.LogEntryUpdate, db: Session = Depends(get_db)):
    entry = crud.update_log(db, log_id, log)
    if not entry:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return entry


@router.delete("/logs/{log_id}")
def delete_log(log_id: int, db: Session = Depends(get_db)):
    entry = crud.delete_log(db, log_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return {"deleted": True}

