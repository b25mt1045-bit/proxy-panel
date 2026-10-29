import pytest
from sqlalchemy import func, select

from app import llm, pipeline
from app.comparables import propose
from app.db import Comparable, Persona, Receipt, Run, Statement
from app.models import Brief
from app.presets import EXAMPLE_BRIEFS
from app.qloo import Qloo

STEPS = ["segments", "personas", "round1", "moderator", "round2", "report"]


async def start(db, raw) -> tuple[Qloo, str]:
    q = Qloo(db, "", "http://unused", mock=True)
    comps, _ = await propose(q, Brief.model_validate(raw))
    async with db.session() as s:
        s.add(Run(id="run1", status="running", brief=raw))
        s.add_all(Comparable(run_id="run1", **c.model_dump(exclude={"resolved"})) for c in comps)
        await s.commit()
    return q, "run1"


@pytest.mark.parametrize("raw", EXAMPLE_BRIEFS, ids=["beverage", "personal_care", "app"])
async def test_example_runs_end_to_end_in_mock_mode(db, raw):
    q, run_id = await start(db, raw)
    await pipeline.run(db, q, run_id)

    async with db.session() as s:
        run = await s.get(Run, run_id)
        n_personas = await s.scalar(select(func.count()).select_from(Persona))
        n_receipts = await s.scalar(select(func.count()).select_from(Receipt))
        stmts = (await s.scalars(select(Statement))).all()
    types = [e["type"] for e in run.events]
    assert run.status == "done", run.events[-1]
    assert [e["data"]["step"] for e in run.events if e["type"] == "progress"] == STEPS
    assert types.count("persona") == 6 and types.count("moderator") == 1 and types[-1] == "done"
    assert types.index("moderator") < [i for i, t in enumerate(types) if t == "statement"][-1]
    assert [e["seq"] for e in run.events] == list(range(1, len(run.events) + 1))
    assert n_personas == 6 and n_receipts >= 6 * 6  # ≥1 R receipt plus the comparables, per persona
    assert len(stmts) == 8 and [s.round for s in stmts].count(2) == 2
    assert llm._mock_calls["panelist_r2"] == 2
    assert all(s.passed for s in stmts)  # the mock panel cites real labels
    # 3 segments, cold cache: 12 seed + 5 baseline-seed searches, 9 media, 6+6 persona, 2+3 baseline = 43
    assert 0 < run.qloo_calls <= 43
    rep = run.report
    assert rep["verdict"]["segment_label"] in {sg["label"] for sg in rep["segments"]}
    assert rep["grounding"]["total"] == 8 and rep["grounding"]["qloo_calls"] == run.qloo_calls
    assert len(rep["interview"]["questions"]) == 5 and len(rep["price_bands"]["personas"]) == 6
    stmt_ids = {s.id for s in stmts}
    assert all(set(o["statement_ids"]) <= stmt_ids for o in rep["objections"])
    assert not any(o["text"].startswith("An objection no") for o in rep["objections"])  # its only id was fake


async def test_failure_marks_run_failed(db, monkeypatch):
    q, run_id = await start(db, EXAMPLE_BRIEFS[0])

    async def boom(*a, **k):
        raise RuntimeError("persona build broke")

    monkeypatch.setattr(pipeline.personas, "build", boom)
    await pipeline.run(db, q, run_id)
    async with db.session() as s:
        run = await s.get(Run, run_id)
    assert run.status == "failed" and run.events[-1] == {"seq": len(run.events), "type": "error",
                                                         "data": {"message": "persona build broke"}}


async def test_provider_error_is_not_leaked(db, monkeypatch):
    q, run_id = await start(db, EXAMPLE_BRIEFS[0])

    async def busy(*a, **k):
        raise pipeline.LLMError('Gemini 503: {"error": {"code": 503}}')

    monkeypatch.setattr(pipeline.personas, "build", busy)
    await pipeline.run(db, q, run_id)
    async with db.session() as s:
        run = await s.get(Run, run_id)
    assert run.events[-1]["data"] == {"message": "The language model is busy right now. Please try again in a minute."}


async def test_resume_after_report_failure_only_redoes_the_report(db, monkeypatch):
    q, run_id = await start(db, EXAMPLE_BRIEFS[0])
    compute = pipeline.report.compute

    async def busy(*a, **k):
        raise pipeline.LLMError("Gemini 503")

    monkeypatch.setattr(pipeline.report, "compute", busy)
    await pipeline.run(db, q, run_id)
    calls = dict(llm._mock_calls)
    async with db.session() as s:
        run = await s.get(Run, run_id)
        assert run.status == "failed"
        run.status, run.events = "running", [e for e in run.events if e["type"] != "error"]  # what /resume does
        await s.commit()
        before = len(run.events)

    monkeypatch.setattr(pipeline.report, "compute", compute)
    await pipeline.run(db, q, run_id)
    async with db.session() as s:
        run = await s.get(Run, run_id)
        n_personas = await s.scalar(select(func.count()).select_from(Persona))
        n_stmts = await s.scalar(select(func.count()).select_from(Statement))
    new = run.events[before:]
    assert run.status == "done" and run.report
    assert [e["type"] for e in new] == ["progress", "done"] and new[0]["data"]["step"] == "report"
    assert [e["seq"] for e in run.events] == list(range(1, len(run.events) + 1))
    assert n_personas == 6 and n_stmts == 8
    assert all(llm._mock_calls[k] == calls.get(k, 0) for k in ("personas", "panelist_r1", "moderator", "panelist_r2"))


async def test_resume_after_moderator_failure_reuses_round1(db, monkeypatch):
    q, run_id = await start(db, EXAMPLE_BRIEFS[0])
    moderate = pipeline.panel.moderate

    async def busy(*a, **k):
        raise pipeline.LLMError("Gemini 503")

    monkeypatch.setattr(pipeline.panel, "moderate", busy)
    await pipeline.run(db, q, run_id)
    r1_calls = llm._mock_calls["panelist_r1"]
    async with db.session() as s:
        run = await s.get(Run, run_id)
        run.status, run.events = "running", [e for e in run.events if e["type"] != "error"]
        await s.commit()

    monkeypatch.setattr(pipeline.panel, "moderate", moderate)
    await pipeline.run(db, q, run_id)
    async with db.session() as s:
        run = await s.get(Run, run_id)
        stmts = (await s.scalars(select(Statement))).all()
    assert run.status == "done" and llm._mock_calls["panelist_r1"] == r1_calls
    assert len(stmts) == 8 and [e["type"] for e in run.events].count("persona") == 6
