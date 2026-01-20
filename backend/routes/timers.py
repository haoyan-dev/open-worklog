from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import schemas
from db import get_db

router = APIRouter()


@router.post("/timers/start", response_model=schemas.TimerRead)
def start_timer(request: schemas.TimerStartRequest, db: Session = Depends(get_db)):
    try:
        return crud.create_timer(db, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/timers/active", response_model=schemas.TimerRead | None)
def get_active_timer(db: Session = Depends(get_db)):
    return crud.get_active_timer(db)


@router.post("/timers/{timer_id}/pause", response_model=schemas.TimerRead)
def pause_timer(timer_id: int, db: Session = Depends(get_db)):
    timer = crud.pause_timer(db, timer_id)
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")
    return timer


@router.post("/timers/{timer_id}/resume", response_model=schemas.TimerRead)
def resume_timer(timer_id: int, db: Session = Depends(get_db)):
    timer = crud.resume_timer(db, timer_id)
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")
    return timer


@router.post("/timers/{timer_id}/stop", response_model=schemas.LogEntryRead)
def stop_timer(timer_id: int, db: Session = Depends(get_db)):
    entry = crud.stop_timer(db, timer_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Timer not found")
    return entry


@router.delete("/timers/{timer_id}")
def cancel_timer(timer_id: int, db: Session = Depends(get_db)):
    timer = crud.delete_timer(db, timer_id)
    if not timer:
        raise HTTPException(status_code=404, detail="Timer not found")
    return {"deleted": True}

