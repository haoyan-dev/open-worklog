# Open Worklog — Copilot / AI Agent Instructions

## General

- Make the smallest change that solves the task.
- Follow existing code conventions and patterns in nearby files.
- If you change a backend API shape, update the frontend types and API calls accordingly.
- Do not add telemetry/debug ingestors (e.g. `fetch("http://127.0.0.1:.../ingest")`) or leave temporary debug scaffolding behind.

## Time & timezone invariants (critical)

- Backend stores timestamps as **naive UTC datetimes**; API serializes timestamps as ISO 8601 (typically with `Z`).
- Frontend should treat backend timestamps as UTC and send timestamps with timezone info (prefer `Z`).

## Backend routing (Option B)

- Prefer adding new endpoints in `backend/routes/*.py` using `APIRouter`, and ensure `backend/main.py` includes those routers under `/api/v1`.

## Backend (Python)

- **Use type hints strictly** for all new/modified code.
  - Annotate all function parameters and return types.
  - Prefer precise types; avoid `Any` unless unavoidable and localized.
  - Use Python 3.11+ typing: `list[T]`, `dict[K, V]`, `T | None`, `Literal`, `TypedDict` (when appropriate).

## Frontend (TypeScript / React)

- **Use types explicitly** for all new/modified code.
  - No implicit `any`. Type props, state, function signatures, and API responses.
  - Prefer `unknown` over `any`, then narrow.
  - Prefer reusing/expanding types in `frontend/src/types.ts`.

