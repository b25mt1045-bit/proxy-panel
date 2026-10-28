"""One grounded run, in a fixed order (design §7): segments → personas → round 1 → moderator → round 2.
A resumed run (POST /runs/{id}/resume) skips every stage whose output is already stored."""

import asyncio
import logging

from sqlalchemy import select, update

from app import panel, personas, report
from app.db import Comparable as ComparableRow
from app.db import Db, Persona, Receipt, Run, Statement
from app.events import emit
from app.llm import LLMError
from app.models import Brief, Comparable
from app.personas import BuiltPersona, ReceiptIn
from app.qloo import Qloo, QlooError, QlooPartial, run_ctx
from app.scoring import concept_tier
from app.segments import SegmentFailed, build_segment_signals
from app.validator import cited, codes

log = logging.getLogger(__name__)
STEPS = 6


async def run(db: Db, q: Qloo, run_id: str):
    async with db.session() as s:
        row = await s.get(Run, run_id)
    # Counters carry over, so a resumed run adds to what the failed attempt already spent.
    ctx = {"qloo_calls": row.qloo_calls or 0, "qloo_cache_hits": row.qloo_cache_hits or 0,
           "llm_cost_usd": row.llm_cost_usd or 0.0, "warnings": list(row.warnings or [])}
    token = run_ctx.set(ctx)
    try:
        await _run(db, q, run_id, ctx)
        await _finish(db, run_id, "done", ctx)
    except Exception as e:
        log.exception("run %s failed", run_id)
        # Raw provider errors (JSON bodies, status codes) stay in the log; the public stream gets a plain sentence.
        msg = ("The language model is busy right now. Please try again in a minute." if isinstance(e, LLMError)
               else "Qloo is unavailable right now. Please try again shortly." if isinstance(e, QlooError)
               else str(e)[:300])
        await emit(db, run_id, "error", {"message": msg})
        await _finish(db, run_id, "failed", ctx)
    finally:
        run_ctx.reset(token)


async def _finish(db: Db, run_id: str, status: str, ctx: dict):
    async with db.session() as s:
        await s.execute(update(Run).where(Run.id == run_id, Run.status == "running").values(
            status=status, qloo_calls=ctx["qloo_calls"], qloo_cache_hits=ctx["qloo_cache_hits"],
            llm_cost_usd=ctx["llm_cost_usd"], warnings=ctx["warnings"]))
        await s.commit()


def _rebuild(run: Run, rows: list[Persona], receipts: list[Receipt]) -> list[BuiltPersona]:
    """The stored personas, back in the shape the panel takes. Age only shaped the bio, so it isn't kept."""
    labels = {e["data"]["segment"]: e["data"]["segment_label"] for e in run.events if e["type"] == "persona"}
    return [BuiltPersona(
        id=r.id, segment=r.segment, segment_label=labels.get(r.segment, f"Segment {r.segment + 1}"), age=None,
        name=r.name, bio=r.bio, top=r.fingerprint, comparable_lifts=r.comparable_lifts or {},
        stance_score=r.stance_score or 0.0, stance_scaled=r.stance_scaled, stance_label=r.stance_label,
        price_lo=r.price_lo, price_hi=r.price_hi, price_weak=r.price_weak,
        receipts=[ReceiptIn(label=x.label, qloo_id=x.qloo_id, entity_name=x.entity_name, entity_type=x.entity_type,
                            lift=x.lift) for x in receipts if x.persona_id == r.id]) for r in rows]


async def _run(db: Db, q: Qloo, run_id: str, ctx: dict):
    sent_warnings = len(ctx["warnings"])  # a resumed run's old warnings are already in the stream

    async def progress(step: str, message: str, index: int):
        nonlocal sent_warnings
        for w in ctx["warnings"][sent_warnings:]:  # modules only append to ctx; events go out here
            await emit(db, run_id, "warning", {"message": w})
        sent_warnings = len(ctx["warnings"])
        await emit(db, run_id, "progress", {"step": step, "message": message, "index": index, "total": STEPS})

    async with db.session() as s:
        run = await s.get(Run, run_id)
        rows = (await s.scalars(select(ComparableRow).where(ComparableRow.run_id == run_id))).all()
        stored = (await s.scalars(select(Persona).where(Persona.run_id == run_id).order_by(Persona.id))).all()
        receipts = (await s.scalars(select(Receipt).where(Receipt.persona_id.in_([p.id for p in stored])))).all()
        said = (await s.scalars(select(Statement).where(Statement.run_id == run_id))).all()
    brief = Brief.model_validate(run.brief)
    comps = [Comparable(qloo_id=r.qloo_id, name=r.name, weight=r.weight, price=r.price) for r in rows]
    if stored:
        built = _rebuild(run, stored, receipts)
    else:
        built = await _build(db, q, run_id, brief, comps, ctx, progress)
    shown = {e["data"]["id"] for e in run.events if e["type"] == "persona"}
    for p in built:
        if p.id not in shown:
            await emit(db, run_id, "persona", p.model_dump(exclude={"comparable_lifts", "stance_score", "age"}))
    texts = {(st.persona_id, st.round): st.text for st in said}

    prices = [c.price for c in comps]
    pctx = panel.Context(brief=brief, tier=concept_tier(brief.variants[0].price or brief.price, prices),
                         comparable_prices=prices)
    store_lock = asyncio.Lock()

    async def store(f: panel.Final):
        async with store_lock, db.session() as s:
            row = Statement(run_id=run_id, persona_id=f.persona.id, round=f.round, text=f.said.text,
                            receipt_labels=cited(f.said.text), preferred_variant=f.said.preferred_variant,
                            passed=not f.errors, flags=codes(f.errors))
            s.add(row)
            await s.commit()
        texts[(row.persona_id, row.round)] = row.text
        await emit(db, run_id, "statement", {"id": row.id, "persona_id": row.persona_id, "round": row.round,
                                             "text": row.text, "receipt_labels": row.receipt_labels,
                                             "preferred_variant": row.preferred_variant, "passed": row.passed,
                                             "flags": row.flags})

    if todo := [p for p in built if (p.id, 1) not in texts]:
        await progress("round1", "Round 1: first reactions…", 3)
        user = panel.round1_user(pctx)
        await panel.run_round("panelist_r1", 1, todo, [user] * len(todo), pctx, store)
    r1_text = {p.id: texts[(p.id, 1)] for p in built}

    if ev := next((e["data"] for e in reversed(run.events) if e["type"] == "moderator"), None):
        a, b = (next(p for p in built if p.id == i) for i in ev["persona_ids"])
        mod = panel.ModeratorOut(focus=ev["focus"], questions=ev["questions"])
    else:
        await progress("moderator", "Moderator is probing…", 4)
        a, b = panel.pick_pair(built)
        mod = await panel.moderate(a, b, r1_text, pctx)
        await emit(db, run_id, "moderator", {"persona_ids": [a.id, b.id], "focus": mod.focus,
                                             "questions": mod.questions})

    pair = [(p, u) for p, u in zip((a, b), panel.round2_users(a, b, mod, r1_text)) if (p.id, 2) not in texts]
    if pair:
        await progress("round2", "Round 2…", 5)
        await panel.run_round("panelist_r2", 2, [p for p, _ in pair], [u for _, u in pair], pctx, store)

    await progress("report", "Writing report…", 6)
    rep = await report.compute(db, run_id)
    for w in ctx["warnings"][sent_warnings:]:
        await emit(db, run_id, "warning", {"message": w})
    await emit(db, run_id, "done", {"report_url": f"/runs/{run_id}/report", "grounding_rate": rep["grounding"]["rate"]})


async def _build(db: Db, q: Qloo, run_id: str, brief: Brief, comps: list[Comparable], ctx: dict,
                 progress) -> list[BuiltPersona]:
    """Segments → personas, stored in one commit so a resume either has all six or none."""
    await progress("segments", "Resolving segments…", 1)
    results = await asyncio.gather(*[build_segment_signals(q, seg, i) for i, seg in enumerate(brief.segments)],
                                   return_exceptions=True)
    sigs = []
    for r in results:
        if isinstance(r, (SegmentFailed, QlooPartial)):
            ctx["warnings"].append(f"Skipped a segment: {r}")
        elif isinstance(r, BaseException):
            raise r
        else:
            sigs.append(r)
            if r.dropped:
                ctx["warnings"].append(f"Not found in Qloo for '{r.label}': {', '.join(r.dropped)}")
    if not sigs:
        raise RuntimeError("No segment could be matched to Qloo data")

    await progress("personas", "Building 6 personas…", 2)
    built = await personas.build(q, db, sigs, comps)
    async with db.session() as s:
        for p in built:
            row = Persona(run_id=run_id, segment=p.segment, name=p.name, bio=p.bio, fingerprint=p.top,
                          comparable_lifts=p.comparable_lifts, stance_score=p.stance_score,
                          stance_scaled=p.stance_scaled, stance_label=p.stance_label, price_lo=p.price_lo,
                          price_hi=p.price_hi, price_weak=p.price_weak)
            s.add(row)
            await s.flush()
            p.id = row.id
            s.add_all(Receipt(persona_id=row.id, **r.model_dump()) for r in p.receipts)
        await s.commit()
    return built
