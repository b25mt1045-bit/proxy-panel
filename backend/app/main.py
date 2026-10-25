"""HTTP API (design §3, §4, §7, §9, §11). Run with: uvicorn app.main:app (1 replica: SSE uses in-process queues)."""

import asyncio
import json
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import delete, select, update

from app import events, pipeline, report
from app.comparables import propose
from app.config import settings
from app.db import Comparable, Db, QlooCache, Run
from app.guards import ApiError, check, client_ip
from app.llm import LLMError
from app.models import Brief
from app.presets import EXAMPLE_BRIEFS, PRESETS
from app.qloo import Qloo, QlooError, run_ctx

_tasks: set[asyncio.Task] = set()  # keeps pipeline tasks alive after the request returns
_search_hits: dict[str, list[float]] = defaultdict(list)  # ip → request times, for the search limit
SEARCH_PER_MIN = 60


async def recover(db: Db):
    """A run still `running` at startup lost its task when the server stopped."""
    async with db.session() as s:
        for run in (await s.scalars(select(Run).where(Run.status == "running"))).all():
            run.status, run.warnings = "failed", [*(run.warnings or []), "server restarted"]
        await s.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = Db(settings.DATABASE_URL)
    app.state.q = Qloo(app.state.db, settings.QLOO_API_KEY, settings.QLOO_BASE_URL, mock=settings.QLOO_MOCK)
    await app.state.db.create_all()
    await recover(app.state.db)
    yield
    await app.state.db.engine.dispose()


app = FastAPI(title="Proxy Panel", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
                   allow_methods=["*"], allow_headers=["*"])


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


@app.exception_handler(ApiError)
async def _api_error(_: Request, e: ApiError):
    return _err(e.status, e.code, e.message)


@app.exception_handler(RequestValidationError)
async def _invalid(req: Request, e: RequestValidationError):
    first = e.errors()[0]
    where = ".".join(str(p) for p in first["loc"] if p != "body")
    path = req.url.path
    code = ("invalid_brief" if path == "/runs" else "invalid_comparables" if path.endswith("/comparables")
            else "invalid_request")
    return _err(400, code, f"{where}: {first['msg']}" if where else first["msg"])


@app.exception_handler(QlooError)
async def _qloo_down(_: Request, e: QlooError):
    return _err(502, "qloo_unavailable", "Qloo is unavailable; try again or use the examples.")


@app.exception_handler(LLMError)
async def _llm_down(_: Request, e: LLMError):
    return _err(502, "llm_unavailable", "The language model is unavailable; try again shortly.")


def _db(req: Request) -> Db:
    return req.app.state.db


async def _run(db: Db, run_id: str) -> Run:
    async with db.session() as s:
        run = await s.get(Run, run_id)
    if run is None:
        raise ApiError(404, "run_not_found", "Run not found.")
    return run


def _comp(c: Comparable) -> dict:
    return {"id": c.id, "qloo_id": c.qloo_id, "name": c.name, "weight": c.weight, "price": c.price, "resolved": True}


def _iso(dt) -> str:
    return dt.isoformat().replace("+00:00", "Z") if dt.tzinfo else dt.isoformat() + "Z"  # SQLite drops the tz


@app.post("/runs", status_code=201)
async def create_run(brief: Brief, req: Request):
    db = _db(req)
    await check(db, req)
    run_id = str(uuid.uuid4())
    async with db.session() as s:
        s.add(Run(id=run_id, status="confirming", brief=brief.model_dump(), client_ip=client_ip(req)))
        await s.commit()
    ctx = {"qloo_calls": 0, "qloo_cache_hits": 0, "llm_cost_usd": 0.0, "warnings": []}
    token = run_ctx.set(ctx)
    try:
        comps, dropped = await propose(req.app.state.q, brief)
    finally:
        run_ctx.reset(token)
    async with db.session() as s:
        rows = [Comparable(run_id=run_id, **c.model_dump(exclude={"resolved"})) for c in comps]
        s.add_all(rows)
        await s.execute(update(Run).where(Run.id == run_id).values(llm_cost_usd=ctx["llm_cost_usd"]))
        await s.commit()
    return {"run_id": run_id, "status": "confirming", "comparables": [_comp(r) for r in rows], "dropped": dropped,
            "warnings": ctx["warnings"]}


class ComparableIn(BaseModel):
    qloo_id: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=100)
    weight: float = Field(ge=0, le=1)
    price: float = Field(gt=0, le=10000)


class ComparablesIn(BaseModel):
    comparables: list[ComparableIn] = Field(min_length=3, max_length=6)
    variant_weights: dict[str, dict[str, float]] = {}

    @model_validator(mode="after")
    def rules(self):
        ids = [c.qloo_id for c in self.comparables]
        if len(set(ids)) != len(ids):
            raise ValueError("each comparable may appear only once")
        if not any(c.weight > 0 for c in self.comparables):
            raise ValueError("at least one weight must be above 0")
        for key, w in self.variant_weights.items():
            if set(w) - set(ids) or not all(0 <= v <= 1 for v in w.values()) or not any(v > 0 for v in w.values()):
                raise ValueError(f"variant {key}: weights must be 0-1, on these comparables, with one above 0")
        return self


async def _known_ids(db: Db, run_id: str) -> set[str]:
    """Ids proposed for this run or returned by any Qloo search, so a client can't inject arbitrary ids."""
    # shortcut: scans every cached /search response; index search ids in their own table if the cache grows large.
    async with db.session() as s:
        ids = set((await s.scalars(select(Comparable.qloo_id).where(Comparable.run_id == run_id))).all())
        for resp in (await s.scalars(select(QlooCache.response).where(QlooCache.path == "/search"))).all():
            ids |= {r.get("entity_id") for r in resp.get("results", [])}
    return ids


@app.put("/runs/{run_id}/comparables", status_code=202)
async def confirm(run_id: str, body: ComparablesIn, req: Request):
    db = _db(req)
    run = await _run(db, run_id)
    brief = Brief.model_validate(run.brief)
    if bad := set(body.variant_weights) - {v.key for v in brief.variants}:
        raise ApiError(400, "invalid_comparables", f"unknown variant: {', '.join(sorted(bad))}")
    if unknown := [c.name for c in body.comparables if c.qloo_id not in await _known_ids(db, run_id)]:
        raise ApiError(400, "invalid_comparables", f"not found in Qloo: {', '.join(unknown)}")
    for v in brief.variants:
        v.comparable_weights = body.variant_weights.get(v.key)
    async with db.session() as s:
        moved = await s.execute(update(Run).where(Run.id == run_id, Run.status == "confirming")
                                .values(status="running", brief=brief.model_dump()))
        if moved.rowcount != 1:
            await s.rollback()
            raise ApiError(409, "bad_status", f"Run is {run.status}, not confirming.")
        await s.execute(delete(Comparable).where(Comparable.run_id == run_id))
        s.add_all(Comparable(run_id=run_id, **c.model_dump()) for c in body.comparables)
        await s.commit()
    task = asyncio.create_task(pipeline.run(db, req.app.state.q, run_id))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"run_id": run_id, "status": "running", "stream_url": f"/runs/{run_id}/stream"}


@app.get("/qloo/search")
async def search(req: Request, q: str = Query(min_length=2, max_length=60), type: Literal["brand"] = "brand"):
    ip, now = client_ip(req), time.monotonic()
    hits = _search_hits[ip] = [t for t in _search_hits[ip] if now - t < 60]
    if len(hits) >= SEARCH_PER_MIN:
        raise ApiError(429, "rate_limited", "Too many searches; wait a minute.")
    hits.append(now)
    found = await req.app.state.q.search(q, f"urn:entity:{type}", take=5)
    return {"results": [{"qloo_id": e.qloo_id, "name": e.name} for e in found]}


@app.get("/runs/{run_id}")
async def get_run(run_id: str, req: Request):
    db = _db(req)
    run = await _run(db, run_id)
    async with db.session() as s:
        comps = (await s.scalars(select(Comparable).where(Comparable.run_id == run_id).order_by(Comparable.id))).all()
        child = await s.scalar(select(Run.id).where(Run.parent_id == run_id))
    by_type = defaultdict(list)
    for e in run.events:
        by_type[e["type"]].append(e["data"])
    return {"run": {"id": run.id, "status": run.status, "mode": run.mode, "brief": run.brief,
                    "created_at": _iso(run.created_at), "parent_id": run.parent_id, "child_id": child},
            "comparables": [_comp(c) for c in comps], "personas": by_type["persona"],
            "statements": by_type["statement"], "moderator": (by_type["moderator"] or [None])[-1],
            "warnings": run.warnings or []}


@app.get("/runs/{run_id}/stream")
async def stream(run_id: str, req: Request):
    db = _db(req)
    await _run(db, run_id)
    try:
        last = int(req.headers.get("last-event-id", 0))
    except ValueError:
        last = 0

    async def gen():
        async for ev in events.stream(db, run_id, last):
            if ev is None:
                yield ": ping\n\n"
            else:
                yield f"id: {ev['seq']}\nevent: {ev['type']}\ndata: {json.dumps(ev['data'], ensure_ascii=False)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/runs/{run_id}/report")
async def get_report(run_id: str, req: Request):
    db = _db(req)
    run = await _run(db, run_id)
    if run.status != "done":
        raise ApiError(409, "bad_status", f"Run is {run.status}; the report is ready once it is done.")
    return run.report or await report.compute(db, run_id)


@app.get("/presets")
async def presets():
    """Segment presets for the brief form, plus sample briefs it can prefill (input only, not results)."""
    return {"presets": [{"id": k, "label": v["label"]} for k, v in PRESETS.items()], "sample_briefs": EXAMPLE_BRIEFS}


@app.get("/examples")
async def examples(req: Request):
    async with _db(req).session() as s:
        runs = (await s.scalars(select(Run).where(Run.is_example.is_(True), Run.status == "done")
                                .order_by(Run.created_at))).all()
    return {"examples": [{"run_id": r.id, "title": r.brief["description"][:80], "category": r.brief["category"],
                          "verdict_sentence": (r.report or {}).get("verdict", {}).get("sentence"),
                          "grounding_rate": (r.report or {}).get("grounding", {}).get("rate")} for r in runs],
            "backtest": []}  # filled by the backtest (days 7-10)
