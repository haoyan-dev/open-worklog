# Editor Instructions (Open Worklog)

This document describes the **coding rules** and **style constraints** to follow when editing this repository.

## Core requirements

### Backend (Python)

- **Use type hints strictly**:
  - Every new/modified function must have full annotations for parameters and return type.
  - Prefer precise types over `Any`. Avoid `Any` unless it is unavoidable and localized.
  - Use modern typing syntax (Python 3.11+): `list[T]`, `dict[K, V]`, `T | None`, `typing.Literal`, `typing.TypedDict` (when appropriate).
  - Keep types aligned with FastAPI/Pydantic models in `backend/schemas.py` and ORM models in `backend/models.py`.
- **No untyped public surfaces**:
  - API endpoints, CRUD functions, utilities, and helpers should all be typed.
- **Be explicit with optionality**:
  - If a value can be missing, use `T | None` and handle the `None` path.

### Frontend (TypeScript/React)

- **Use types explicitly**:
  - Components must have typed props; avoid implicit `any`.
  - API helpers must have typed inputs/outputs (use generics like `request<T>()` where applicable).
  - Prefer `unknown` over `any` when the type is not yet known, then narrow it.
- **Keep types centralized**:
  - Prefer reusing/expanding definitions in `frontend/src/types.ts` instead of duplicating shapes.

## General editing guidelines

- **Minimize scope**: change only what is needed for the task; avoid drive-by refactors.
- **Preserve existing patterns**: follow established conventions in nearby files (imports, naming, folder structure).
- **No breaking API contracts**: if backend response shapes change, update frontend types + API calls accordingly.

