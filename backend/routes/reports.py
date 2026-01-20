from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

import crud
import schemas
from db import get_db

router = APIRouter()


@router.get("/reports/daily", response_model=schemas.DailyReport)
def export_daily_report(
    report_date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
):
    report = crud.build_daily_report(db, report_date)
    filename = f"daily-report-{report_date.isoformat()}.json"
    return JSONResponse(
        content=jsonable_encoder(report),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/weekly", response_model=schemas.WeeklyReport)
def export_weekly_report(
    week_start: date = Query(...),
    author: Optional[str] = Query(None),
    summary_qualitative: Optional[str] = Query(None),
    summary_quantitative: Optional[str] = Query(None),
    next_week_plan: Optional[list[str]] = Query(None),
    db: Session = Depends(get_db),
):
    report = crud.build_weekly_report(
        db,
        week_start,
        author=author,
        summary_qualitative=summary_qualitative,
        summary_quantitative=summary_quantitative,
        next_week_plan=next_week_plan,
    )
    filename = f"weekly-report-{report.week_id}.json"
    return JSONResponse(
        content=jsonable_encoder(report),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

