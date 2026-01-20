from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

import crud
import schemas
from db import get_db

router = APIRouter()


@router.get("/stats", response_model=list[schemas.DailyStat])
def get_stats(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
):
    return crud.get_stats(db, start_date, end_date)

