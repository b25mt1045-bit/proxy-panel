"""One grounded run, in a fixed order (design §7): segments → personas → round 1 → moderator → round 2."""

import asyncio
import logging

from sqlalchemy import select, update

from app import panel, personas
from app.db import Comparable as ComparableRow
from app.db import Db, Persona, Receipt, Run, Statement
from app.events import emit
from app.models import Brief, Comparable
from app.qloo import Qloo, QlooPartial, run_ctx
from app.scoring import concept_tier
from app.segments import SegmentFailed, build_segment_signals
from app.validator import cited, codes

log = logging.getLogger(__name__)
STEPS = 5  # Day 4 adds "Writing report…"


async def run(db: Db, q: Qloo, run_id: str):
    ctx = {"qloo_calls": 0, "qloo_cache_hits": 0, "llm_cost_usd": 0.0, "warnings": []}
    token = run_ctx.set(ctx)
    try:
        await _run(db, q, run_id, ctx)
        await _finish(db, run_id, "done", ctx)
    except Exception as e:
        log.exception("run %s failed", run_id)
        await emit(db, run_id, "error", {"message": str(e)[:300]})
        await _finish(db, run_id, "failed", ctx)
    finally:
        run_ctx.reset(token)


async def _finish(db: Db, run_id: str, status: str, ctx: dict):
    async with db.session() as s:
        await s.execute(update(Run).where(Run.id == run_id, Run.status == "running").values(
            status=status, qloo_calls=ctx["qloo_calls"], qloo_cache_hits=ctx["qloo_cache_hits"],
            llm_cost_usd=ctx["llm_cost_usd"], warnings=ctx["warnings"]))
        await s.commit()


async def _run(db: Db, q: Qloo, run_id: str, ctx: dict):
    sent_warnings = 0

    async def progress(step: str, message: str, index: int):
        nonlocal sent_warnings
        for w in ctx["warnings"][sent_warnings:]:  # modules only append to ctx; events go out here
            await emit(db, run_id, "warning", {"message": w})
        sent_warnings = len(ctx["warnings"])
        await emit(db, run_id, "progress", {"step": step, "message": message, "index": index, "total": STEPS})

    async with db.session() as s:
        run = await s.get(Run, run_id)
        rows = (await s.scalars(select(ComparableRow).where(ComparableRow.run_id == run_id))).all()
    brief = Brief.model_validate(run.brief)
    comps = [Comparable(qloo_id=r.qloo_id, name=r.name, weight=r.weight, price=r.price) for r in rows]

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
    for p in built:
        await emit(db, run_id, "persona", p.model_dump(exclude={"comparable_lifts", "stance_score", "age"}))

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
        await emit(db, run_id, "statement", {"id": row.id, "persona_id": row.persona_id, "round": row.round,
                                             "text": row.text, "receipt_labels": row.receipt_labels,
                                             "preferred_variant": row.preferred_variant, "passed": row.passed,
                                             "flags": row.flags})

    await progress("round1", "Round 1: first reactions…", 3)
    user = panel.round1_user(pctx)
    r1 = await panel.run_round("panelist_r1", 1, built, [user] * len(built), pctx, store)
    r1_text = {f.persona.id: f.said.text for f in r1}

    await progress("moderator", "Moderator is probing…", 4)
    a, b = panel.pick_pair(built)
    mod = await panel.moderate(a, b, r1_text, pctx)
    await emit(db, run_id, "moderator", {"persona_ids": [a.id, b.id], "focus": mod.focus, "questions": mod.questions})

    await progress("round2", "Round 2…", 5)
    r2 = await panel.run_round("panelist_r2", 2, [a, b], panel.round2_users(a, b, mod, r1_text), pctx, store)

    finals = r1 + r2
    rate = sum(not f.errors for f in finals) / len(finals)
    for w in ctx["warnings"][sent_warnings:]:
        await emit(db, run_id, "warning", {"message": w})
    await emit(db, run_id, "done", {"report_url": f"/runs/{run_id}/report", "grounding_rate": round(rate, 2)})
