from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import crud
import schemas
from db import get_db

router = APIRouter()


@router.get("/projects", response_model=list[schemas.ProjectRead])
def get_projects(
    search: Optional[str] = Query(None, description="Search term to filter projects by name"),
    db: Session = Depends(get_db),
):
    return crud.get_projects(db, search)


@router.post("/projects", response_model=schemas.ProjectRead)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_project(db, project)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/projects/{project_id}", response_model=schemas.ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

