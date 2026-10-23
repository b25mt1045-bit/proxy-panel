# Proxy Panel

A pre-launch focus group for consumer products, built on real taste data. Describe a product, and a panel of personas built from Qloo data tells you which audience to launch to first, what will stop them buying, and what price band they sit in. Every claim cites the Qloo data behind it.

**Status:** early build. The backend Qloo client and scoring engine exist; the rest is in progress.

## Docs
- [Product & Technical Spec](<Proxy Panel — Product & Technical Spec.md>): what we're building and why, the scope, validation and build plan.
- [Technical Design](<Proxy Panel — Technical Design.md>): how each feature is built, including data shapes, prompts, algorithms, tests and deployment.

## Stack (planned)
Python 3.12 + FastAPI backend, Next.js + Tailwind frontend, Postgres (SQLite locally). 

## Setup

Backend (from `backend/`, needs [uv](https://docs.astral.sh/uv/)): `uv sync`, copy `.env.example` to `.env`, then `uv run uvicorn app.main:app --reload` (port 8000). Mock mode (`QLOO_MOCK=1 LLM_MOCK=1`) needs no keys and runs the three example briefs. Tests: `uv run pytest`.

Frontend (from `frontend/`): `npm install`, then `npm run dev` (port 3000). It calls the API at `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

## License
[MIT](LICENSE)
