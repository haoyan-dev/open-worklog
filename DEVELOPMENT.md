# Local Development Setup

This guide describes how to run the backend and frontend locally without Docker.

## Prerequisites

- Node.js 20+.
- Python 3.11+.

## Local Backend (Without Docker)

- `cd backend`.
- `python -m venv .venv`.
- Activate the venv.
- `pip install -r requirements.txt`.
- `set DATABASE_URL=sqlite:///./app.db` (Windows PowerShell).
- `uvicorn main:app --host 0.0.0.0 --port 8000`.

## Local Frontend (Without Docker)

- `cd frontend`.
- `npm install`.
- `npm run dev`.
- Open `http://localhost:5173/`.

## Notes

- The frontend dev server proxies `/api` to `http://localhost:8000`.
- The local SQLite file defaults to `backend/app.db` when running without Docker.
