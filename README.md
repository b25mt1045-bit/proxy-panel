# Proxy Panel

A pre-launch focus group for consumer products, built on real taste data. Describe a product, and a panel of personas built from Qloo data tells you which audience to launch to first, what will stop them buying, and what price band they sit in. Every claim cites the Qloo data behind it.

**Live:** https://proxy-panel-kohl.vercel.app (API: https://proxy-panel-api.onrender.com)

## Docs
- [Product & Technical Spec](<Proxy Panel — Product & Technical Spec.md>): what we're building and why, the scope, validation and build plan.
- [Technical Design](<Proxy Panel — Technical Design.md>): how each feature is built, including data shapes, prompts, algorithms, tests and deployment.

## Stack
Python 3.12 + FastAPI backend (`backend/`), Next.js + Tailwind frontend (`frontend/`), Postgres on Neon (SQLite locally). LLM: Gemini through its REST API. Taste data: Qloo Insights API.

## Run it locally
Needs Python 3.12 with [uv](https://docs.astral.sh/uv/) and Node 20+.

```bash
# Backend (http://localhost:8000)
cd backend
cp .env.example .env          # add QLOO_API_KEY and LLM_API_KEY; set QLOO_MOCK=0 and LLM_MOCK=0 for live calls
uv sync
uv run uvicorn app.main:app --reload

# Frontend (http://localhost:3000), in a second terminal
cd frontend
npm install
npm run dev
```

With the mocks on (the default in `.env.example`), the app runs on saved fixtures and needs no keys. Tests: `cd backend && uv run pytest`.

## Deploy
| Piece | Host | How |
|---|---|---|
| Database | Neon (free) | Create a project and copy the **direct** (non-pooler) connection string. The backend adapts it for asyncpg as pasted. |
| Backend | Render (free) | New → Blueprint → this repo. `render.yaml` sets the build, start command and settings. Fill in `QLOO_API_KEY`, `LLM_API_KEY`, `DATABASE_URL` and `CORS_ORIGINS` (the frontend URL). Keep it at **one instance**: the live stream tails in-process queues. |
| Frontend | Vercel (free) | Root directory `frontend`, env `NEXT_PUBLIC_API_URL` = the Render URL. Or from `frontend/`: `npx vercel deploy --prod`. |

The free Render service sleeps after 15 idle minutes, so a cron job (e.g. cron-job.org, `*/10 * * * *`) calls `GET /presets`, which doesn't touch the database.

## License
[MIT](LICENSE)
