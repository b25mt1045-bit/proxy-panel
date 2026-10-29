# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Early build (days 1–3 of the build order done). Proxy Panel is a pre-launch focus group: a product brief goes in, 6 personas built from Qloo taste data debate it, and a report says which segment to launch to, the objections, and the price band. Every claim cites Qloo data. Hackathon project (MVP due Oct 30, 2026).

The two docs at the root are the source of truth. Read the relevant section before building a module:
- `Proxy Panel — Product & Technical Spec.md`: what and why (scope, MVP vs stretch, validation, judging).
- `Proxy Panel — Technical Design.md`: how, per module (interfaces, prompts, algorithms, tests). §0 records decisions on spec gaps (G1–G9); §13 is the repo layout; §T is the test plan and build order. Items marked **verify** depend on the real Qloo API and the day-1 probes at the top of that doc.

When code lands, keep this file and the README's setup section in sync with it.

## Commands

Built so far (days 1–3): `config, db, qloo, scoring, models, presets, prompts, llm, orchestrator, comparables, segments, personas, validator, panel, events, pipeline, report` and `scripts/record_fixtures.py`, `scripts/live_run.py`, with tests. `pipeline.run(db, qloo, run_id)` runs a whole grounded run (segments → personas → round 1 → moderator → round 2 → report → `done` event); `report.compute` stores the §9 JSON in `runs.report`. `main.py` serves the API (`POST /runs`, `PUT /runs/{id}/comparables`, `POST /runs/{id}/resume` (restarts a failed run at the stage it stopped on; `pipeline` skips stages already stored), `GET /runs/{id}`, `/stream`, `/report`, `GET /qloo/search`, `GET /examples`), with `guards.py` for the daily spend cap (no per-IP run limit, by decision); `test_api` covers it. Not built yet: `POST /runs/{id}/ungrounded` (day 6) and `PATCH /tiers/{qloo_id}`.
- Dev server: `python -m uv run uvicorn app.main:app --reload` (port 8000). `llm.py` calls Gemini (free tier) through the Interactions API (`POST /v1beta/interactions`, stateless `store: false`; new keys starting `AQ.` get a 404 from `generateContent`) over REST with httpx: `LLM_API_KEY`, `LLM_SMALL`, `LLM_BIG` from `backend/.env`; JSON via `response_format`, 120 s timeout, one retry on timeout/5xx/429, thought-step signatures sent back with tool turns. With `LLM_MOCK=1` it reads `fixtures/llm/<prompt>.json` instead (tests always force mocks; a fixture can be one reply, a rotating list, or `{"cases": [{"if_contains"...}]}` matched on prompt text). Backend uses `uv` with Python 3.12 (`backend/pyproject.toml`). On this machine `uv` isn't on PATH, so call it as `python -m uv`. Run from `backend/`:
- Install: `python -m uv sync`
- Tests: `python -m uv run pytest`. Single test: `python -m uv run pytest tests/test_scoring.py::test_price`. Tests use mocks and in-memory SQLite, with no keys needed.
- Lint: `python -m uv run ruff check .`
- Record Qloo fixtures: `python -m uv run python -m scripts.record_fixtures` (live Qloo; loads existing fixtures first, so only new calls cost quota). Re-run when a module adds Qloo calls; `test_examples_run_fully_in_mock_mode` fails if one is missing.
- One live end-to-end run (real Qloo + Gemini, prints events): `python -m uv run python -m scripts.live_run [0|1|2]` (example brief index).
- Real keys live in `backend/.env` (git-ignored; template in `backend/.env.example`). `QLOO_MOCK` defaults to on, so set `QLOO_MOCK=0` to hit live Qloo.

Planned, not built yet: scripts `scripts.seed_examples`, `scripts.backtest --brands "..."`.

Qloo API facts from the day-1 probes (also in Technical Design): insights entities carry the real type in `subtype` (`type` is just `urn:entity`); a search miss returns the nearest *wrong* brand, so check names; bad parameter values return a 400; some obscure brands have no data (left out of results, so `lift()` gives 0); `take` must be ≤ 50, so `insights(result_ids=...)` splits longer id lists into chunks. `Qloo._get` makes identical parallel requests share one call, and `Db.cache_put` tolerates a parallel insert of the same key. Don't use `:memory:` SQLite: concurrent writes on its single shared connection lose data.
- Env vars are listed in Technical Design §11 (`.env.example`).

Frontend: Next.js 16 App Router + Tailwind 4 in `frontend/` (read `frontend/AGENTS.md`: Next 16 has breaking changes and `cacheComponents` is on, so pages fetch client-side). API base from `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). Dev: `npm run dev` in `frontend/`. Built: `/` on branch `YAJAT`, a short page: hero with an example six-card panel (`components/Hero.tsx`), "How it works" in three steps plus what the report answers (`Steps.tsx`), then the brief form (`BriefForm.tsx`; `lib/api.ts`). No animation libraries; motion is CSS only and respects reduced motion. Run pages on branch `run-pages`: `/runs/[id]/confirm` (edit comparables, weights, prices, add via `/qloo/search`), `/panel` (live SSE via `lib/useRunStream.ts`; citations render as receipt chips), `/report`; shared bits in `components/run.tsx`. `app/runs/[id]/layout.tsx` wraps them in `<Suspense>` because `useParams()` needs it under `cacheComponents`. No chart library: bars are CSS. Design "Sticker" (2026-10-26, after btay.ca): cream paper, near-black ink, bright sticker fills (`sky`, `sun`, `mint`, `peach`, `tomato`, `lilac`) under dark text, the `sticker` utility (2px ink border + hard offset shadow), Averia Serif Libre headlines, Inter body, Caveat for handwritten notes, `pop` blue for links and focus, stance colours always labelled. Earlier designs: "Graphite" on branch `frontend-premium`, "Debate night" on `frontend/debate-night`. Tokens in `app/globals.css`. If the dev server returns 500 with `0xc0000142`, stop it, delete `frontend/.next`, and restart.

## Architecture (planned)

- **Code computes, the LLM explains.** Stance scores, price bands and segment ranking are pure Python in `scoring.py`, computed from Qloo data. LLM calls only turn text into Qloo signals and data into speech. Don't let an LLM produce these numbers.
- **The pipeline is plain async Python with a fixed order** (`pipeline.run`): segments → personas → round 1 → moderator → round 2 → report. The LLM "orchestrator" runs only on failure (too few comparables or seeds resolve), for at most 3 tool turns.
- **One gateway per external service.** Only `qloo.py` talks to Qloo, so every response goes through the `qloo_cache` table (no expiry; cache hits don't count toward `qloo_calls`). Only `llm.py` imports the LLM SDK. Both have mock modes that read fixtures (`backend/fixtures/qloo/<cache_key>.json`, `backend/fixtures/llm/<prompt_name>.json`); a missing fixture must raise loudly.
- **Per-run counters** (`qloo_calls`, `llm_cost_usd`, `warnings`) live in the `run_ctx` ContextVar rather than being passed around. `QlooPartial` is never fatal: it goes into `warnings` and the run continues.
- **Prompts** all live in `prompts.py` as `<NAME>_SYSTEM` / `<NAME>_USER` strings. User text is always wrapped in `<brief>`/`<segment>` tags and the system prompt says to treat it as data.
- **Validator** checks that panelist statements cite real receipt labels (`R1`…, unique per persona) and retries once before flagging.
- **SSE** (`GET /runs/{id}/stream`) replays stored events and then tails in-process queues, so the backend must run as **1 replica**.
- **Run status** goes `confirming → running → done | failed`, and each transition is a conditional `UPDATE ... WHERE status=<expected>` (a double PUT gets a 409).

## Conventions (Technical Design §A)

- `runs.id` is a UUID4 (used in public share URLs); other tables use int autoincrement ids.
- `snake_case` JSON both ways; frontend types mirror backend models exactly.
- Every non-2xx response: `{"error": {"code": "...", "message": "..."}}`, using the codes in §A.
- UTC timestamps, ISO-8601 with `Z`. Money is USD.

## Hooks

`.claude/settings.json` runs `.claude/hooks/lint.js`: it records each file you edit, and on Stop it lints them (eslint if installed, else `node --check` for JS; `ruff` or `py_compile` for Python; JSON parse). Lint errors block stopping once, so fix them before finishing.
