"""The report for a finished run (design §9). Code computes every number; 2 LLM calls group the objections
and write the interview script."""

import json
from collections import Counter
from statistics import mean

from pydantic import BaseModel, Field
from sqlalchemy import select, update

from app import llm
from app.db import Comparable, Db, Persona, Receipt, Run, Statement
from app.models import Brief, Variant
from app.prompts import INTERVIEW_SYSTEM, INTERVIEW_USER, OBJECTIONS_SYSTEM, OBJECTIONS_USER, fence
from app.qloo import run_ctx
from app.scoring import concept_tier, price_fit, stance

STRONG_GAP, WEAK_GAP, MAX_SPREAD = 0.15, 0.05, 0.25  # on the scaled 0..1 means; tune on the backtest
TIER_WORDS = {1: "budget", 2: "mid", 3: "premium", 4: "luxury"}
LOVE_TYPES = ["brand", "artist", "tv_show", "podcast"]
DISCLAIMER = "These are hypotheses about segments and objections, not a sales forecast."


def _band(p) -> tuple[float, float, bool]:
    return (p.price_lo, p.price_hi, p.price_weak)


def _fit_share(ps, tier: int) -> float:
    return mean(price_fit(tier, _band(p)) for p in ps)


def _by_segment(ps) -> dict[int, list]:
    return {s: [p for p in ps if p.segment == s] for s in sorted({p.segment for p in ps})}


def verdict(ps, weights: dict[str, float], variants: list[Variant], tiers: dict[str, int],
            prefs: Counter) -> tuple[int, str]:
    """(best segment, best variant). Segments rank on mean stance, then on price fit at variant A's tier;
    the variant on its stance in that segment, then on how many of its panelists preferred it."""
    by = _by_segment(ps)
    best = max(by, key=lambda s: (mean(stance(p.comparable_lifts, weights) for p in by[s]),
                                  _fit_share(by[s], tiers["A"])))
    v_scores = {v.key: mean(stance(p.comparable_lifts, v.comparable_weights or weights) for p in by[best])
                for v in variants}
    return best, max(v_scores, key=lambda k: (v_scores[k], prefs[(best, k)]))


def confidence(seg_scaled_means: dict[int, float], scaled_in_best: list[float]) -> str:
    spread = max(scaled_in_best) - min(scaled_in_best)  # how much the winning segment's personas disagree
    if len(seg_scaled_means) == 1:
        return "strong" if spread <= MAX_SPREAD else "mixed"
    ranked = sorted(seg_scaled_means.values(), reverse=True)
    gap = ranked[0] - ranked[1]
    if gap < WEAK_GAP:
        return "weak"
    return "strong" if gap >= STRONG_GAP and spread <= MAX_SPREAD else "mixed"


def sensitivity(ps, weights, variants: list[Variant], tiers, prefs, names: dict[str, str],
                labels: dict[int, str]) -> dict:
    """Does zeroing any one comparable's weight change the segment or variant picked?"""
    base = verdict(ps, weights, variants, tiers, prefs)
    for c, name in names.items():
        w = {**weights, c: 0}
        vs = [v.model_copy(update={"comparable_weights": {**v.comparable_weights, c: 0}})
              if v.comparable_weights else v for v in variants]
        if not sum(w.values()) or any(v.comparable_weights and not sum(v.comparable_weights.values()) for v in vs):
            continue
        new = verdict(ps, w, vs, tiers, prefs)
        if new != base:
            return {"robust": False, "change": f"Setting {name}'s weight to 0 makes {labels.get(new[0], new[0])} "
                                               f"with variant {new[1]} the top pick."}
    return {"robust": True, "change": "No single comparable flips the verdict."}


def _love(receipts) -> dict[str, list[dict]]:
    # shortcut: uses stored receipts only, not the full segment media lists (not stored); store them if this is too thin.
    best = {}
    for r in receipts:
        if r.entity_type in LOVE_TYPES and (r.qloo_id not in best or r.lift > best[r.qloo_id].lift):
            best[r.qloo_id] = r
    return {t: [{"name": r.entity_name, "lift": round(r.lift, 3)}
                for r in sorted((r for r in best.values() if r.entity_type == t), key=lambda r: -r.lift)[:5]]
            for t in LOVE_TYPES}


def _top_comparables(ps, comps, n: int = 3) -> list[dict]:
    lifts = [(c.name, mean(p.comparable_lifts.get(c.qloo_id, 0.0) for p in ps)) for c in comps]
    return [{"name": name, "lift": round(li, 3)} for name, li in sorted(lifts, key=lambda x: -x[1])[:n]]


class ObjectionIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    statement_ids: list[int]


class ObjectionsOut(BaseModel):
    objections: list[ObjectionIn]


class InterviewOut(BaseModel):
    recruit: str
    markers: list[str]
    questions: list[str] = Field(min_length=5, max_length=5)


def clean_objections(res: ObjectionsOut, pool, receipts) -> list[dict]:
    """Keeps only statement ids that were in the input; persona ids and receipts come from those statements."""
    by_id = {st.id: st for st in pool}
    rec = {(r.persona_id, r.label): r for r in receipts}
    out = []
    for o in res.objections:
        ids = list(dict.fromkeys(i for i in o.statement_ids if i in by_id))
        if not ids:
            continue
        sts = [by_id[i] for i in ids]
        cites = dict.fromkeys((st.persona_id, lb) for st in sts for lb in st.receipt_labels)
        out.append({"text": o.text, "persona_ids": list(dict.fromkeys(st.persona_id for st in sts)),
                    "statement_ids": ids,
                    "receipts": [{"persona_id": pid, "label": lb, "entity_name": rec[pid, lb].entity_name,
                                  "lift": round(rec[pid, lb].lift, 3)} for pid, lb in cites if (pid, lb) in rec]})
    return out


async def _objections(brief: Brief, ps, stmts, receipts) -> list[dict]:
    doubters = {p.id for p in ps if p.stance_label in ("skeptic", "conditional")}
    pool = [st for st in stmts if st.persona_id in doubters]
    if not pool:
        return []  # the UI reads an empty list as "No objections raised"
    rows = [{"id": st.id, "persona_id": st.persona_id, "text": st.text} for st in pool]
    res = await llm.complete("objections", "big", OBJECTIONS_SYSTEM,
                             OBJECTIONS_USER.format(brief=fence("brief", brief.description),
                                                    statements=fence("statements", json.dumps(rows, ensure_ascii=False))),
                             schema=ObjectionsOut, temperature=0.3)
    return clean_objections(res, pool, receipts)


async def _interview(label: str, love: dict, objections: list[dict]) -> dict:
    top = sorted((e for es in love.values() for e in es), key=lambda e: -e["lift"])[:3]
    texts = "\n".join(o["text"] for o in objections) or "No objections raised"
    res = await llm.complete("interview", "big", INTERVIEW_SYSTEM,
                             INTERVIEW_USER.format(segment=fence("segment", label),
                                                   markers=", ".join(e["name"] for e in top) or "none",
                                                   objections=fence("objections", texts)),
                             schema=InterviewOut, temperature=0.5)
    return res.model_dump()


async def compute(db: Db, run_id: str) -> dict:
    """Builds the report from the stored run and saves it to runs.report. Grounded runs only (ungrounded is day 6)."""
    async with db.session() as s:
        run = await s.get(Run, run_id)
        comps = (await s.scalars(select(Comparable).where(Comparable.run_id == run_id))).all()
        ps = (await s.scalars(select(Persona).where(Persona.run_id == run_id).order_by(Persona.id))).all()
        stmts = (await s.scalars(select(Statement).where(Statement.run_id == run_id).order_by(Statement.id))).all()
        receipts = (await s.scalars(select(Receipt).where(Receipt.persona_id.in_([p.id for p in ps])))).all()
    brief = Brief.model_validate(run.brief)
    labels = {e["data"]["segment"]: e["data"]["segment_label"] for e in run.events if e["type"] == "persona"}
    prices = [c.price for c in comps]
    weights = {c.qloo_id: c.weight for c in comps}
    tiers = {v.key: concept_tier(v.price or brief.price, prices) for v in brief.variants}
    seg_of = {p.id: p.segment for p in ps}
    last = {}
    for st in stmts:  # each persona's latest stated preference
        if st.preferred_variant:
            last[st.persona_id] = st.preferred_variant
    prefs = Counter((seg_of[pid], v) for pid, v in last.items())
    by = _by_segment(ps)

    best, best_v = verdict(ps, weights, brief.variants, tiers, prefs)
    tier = tiers[best_v]
    scaled_means = {s: mean(p.stance_scaled for p in g) for s, g in by.items()}
    name = next(v.name for v in brief.variants if v.key == best_v)
    love = _love([r for r in receipts if seg_of[r.persona_id] == best])
    objections = await _objections(brief, ps, stmts, receipts)
    interview = await _interview(labels[best], love, objections)
    ctx = run_ctx.get() or {"qloo_calls": run.qloo_calls, "qloo_cache_hits": run.qloo_cache_hits,
                            "warnings": run.warnings or []}
    passed = sum(st.passed for st in stmts)

    report = {
        "run_id": run_id, "mode": run.mode,
        "verdict": {"segment_index": best, "segment_label": labels[best], "variant": best_v, "tier": tier,
                    "confidence": confidence(scaled_means, [p.stance_scaled for p in by[best]]),
                    "sentence": f"Launch to {labels[best]} with {name} at tier {tier} ({TIER_WORDS[tier]})."},
        "segments": [{"index": s, "label": labels[s], "mean_stance": round(mean(p.stance_score for p in g), 4),
                      "mean_scaled": round(scaled_means[s], 3),
                      "price_fit_share": round(_fit_share(g, tiers["A"]), 3),
                      "top_comparables": _top_comparables(g, comps)} for s, g in by.items()],
        "objections": objections,
        "price_bands": {"concept_tier": tiers["A"],
                        "personas": [{"persona_id": p.id, "name": p.name, "lo": round(p.price_lo, 2),
                                      "hi": round(p.price_hi, 2), "weak": p.price_weak,
                                      "fit": price_fit(tiers["A"], _band(p))} for p in ps]},
        "variants": [{"key": v.key, "tier": tiers[v.key], "by_segment": [
            {"index": s, "mean_stance": round(mean(stance(p.comparable_lifts, v.comparable_weights or weights)
                                                   for p in g), 4),
             "price_fit_share": round(_fit_share(g, tiers[v.key]), 3), "preferred_count": prefs[(s, v.key)]}
            for s, g in by.items()]} for v in brief.variants],
        "love": love,
        "sensitivity": sensitivity(ps, weights, brief.variants, tiers, prefs,
                                   {c.qloo_id: c.name for c in comps}, labels),
        "interview": interview,
        "grounding": {"rate": round(passed / len(stmts), 2) if stmts else 0.0, "passed": passed,
                      "total": len(stmts), "qloo_calls": ctx["qloo_calls"],
                      "qloo_cache_hits": ctx["qloo_cache_hits"], "warnings": list(ctx["warnings"])},
        "disclaimer": DISCLAIMER,
    }
    async with db.session() as s:
        await s.execute(update(Run).where(Run.id == run_id).values(report=report))
        await s.commit()
    return report
