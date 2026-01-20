from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from db import Base, engine, ensure_schema
from routes.logs import router as logs_router
from routes.projects import router as projects_router
from routes.reports import router as reports_router
from routes.stats import router as stats_router
from routes.timers import router as timers_router
from routes.timespans import router as timespans_router


def create_app() -> FastAPI:
    Base.metadata.create_all(bind=engine)
    ensure_schema(engine)

    app = FastAPI(title="Open Worklog API", openapi_url="/api/v1/openapi.json")

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(logs_router, prefix="/api/v1")
    app.include_router(stats_router, prefix="/api/v1")
    app.include_router(reports_router, prefix="/api/v1")
    app.include_router(timers_router, prefix="/api/v1")
    app.include_router(timespans_router, prefix="/api/v1")
    app.include_router(projects_router, prefix="/api/v1")

    return app


app = create_app()


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}
