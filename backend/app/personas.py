"""Segments → 6 personas with Qloo fingerprints, receipts, stance and price band (design §6)."""

import asyncio
import json
from itertools import combinations

from pydantic import BaseModel, Field

from app import llm, scoring
from app.config import AGE_BUCKETS, settings
from app.db import Db
from app.models import Comparable
from app.prompts import PERSONAS_SYSTEM, PERSONAS_USER, PRICE_TIERS_SYSTEM, PRICE_TIERS_USER
from app.qloo import Entity, Qloo, QlooPartial, norm, run_ctx
from app.segments import MEDIA_TYPES, SegmentSignals, baseline, segment_media

COUNTS = {1: [6], 2: [3, 3], 3: [2, 2, 2]}  # always 6 personas (design G4)
AGE_OFFSETS = [0, 1, -1, 2, -2, 3]  # personas in a segment sit around its age bucket
TOP_BRANDS = 15  # per persona; all of them are baseline-scored in one call
N_RECEIPTS = 5
BRAND = "urn:entity:brand"


class PersonaSpec(BaseModel):
    segment: int
    label: str
    seeds: list[Entity]
    age: str | None
    gender: str | None


class ReceiptIn(BaseModel):
    label: str
    qloo_id: str
    entity_name: str
    entity_type: str  # brand | artist | tv_show | podcast | comparable
    lift: float


class BuiltPersona(BaseModel):
    id: int | None = None  # set once stored
    segment: int
    segment_label: str
    age: str | None
    name: str
    bio: str
    top: dict[str, list[str]]
    receipts: list[ReceiptIn]
    comparable_lifts: dict[str, float]
    stance_score: float
    stance_scaled: float = 0.5
    stance_label: str = "conditional"
    price_lo: float
    price_hi: float
    price_weak: bool

    @property
    def labels(self) -> set[str]:
        return {r.label for r in self.receipts}


def split(sigs: list[SegmentSignals]) -> list[PersonaSpec]:
    """Each persona in a segment gets a different seed subset and age bucket, so their tastes differ for a reason."""
    specs = []
    for sig, n in zip(sigs, COUNTS[len(sigs)]):
        k = len(sig.seeds)
        subsets = [list(c) for r in range(k if k <= 2 else k - 1, 0, -1) for c in combinations(sig.seeds, r)]
        for i in range(n):
            age = None
            if sig.age and settings.DEMOGRAPHICS_ENABLED:
                j = AGE_BUCKETS.index(sig.age) + AGE_OFFSETS[i]
                age = AGE_BUCKETS[min(max(j, 0), len(AGE_BUCKETS) - 1)]
            specs.append(PersonaSpec(segment=sig.index, label=sig.label, seeds=subsets[i % len(subsets)],
                                     age=age, gender=sig.gender))
    return specs


def pick_receipts(cands: list[tuple[Entity, str, float]], n: int = N_RECEIPTS) -> list[tuple[Entity, str, float]]:
    """Top n by lift, keeping at least 1 brand and 1 non-brand when both exist (the moderator pairs on type)."""
    ranked, seen = [], set()
    for c in sorted(cands, key=lambda c: -c[2]):
        if c[0].qloo_id not in seen:
            seen.add(c[0].qloo_id)
            ranked.append(c)
    top = ranked[:n]
    for want in (lambda c: c[1] == "brand", lambda c: c[1] != "brand"):
        if not any(want(c) for c in top) and (extra := next((c for c in ranked if want(c)), None)):
            top = top[:n - 1] + [extra]
    return sorted(top, key=lambda c: -c[2])


async def _safe(coro, default, what: str):
    """QlooPartial is never fatal: record a warning and carry on without that data."""
    try:
        return await coro
    except QlooPartial as e:
        if (ctx := run_ctx.get()) is not None:
            ctx.setdefault("warnings", []).append(f"Qloo data missing for {what}: {e}")
        return default


def _demo(spec: PersonaSpec) -> dict:
    if not settings.DEMOGRAPHICS_ENABLED:
        return {}
    return {k: v for k, v in {"age": spec.age, "gender": spec.gender}.items() if v}


def _aff(ents: list[Entity]) -> dict[str, float]:
    return {e.qloo_id: e.affinity for e in ents if e.affinity is not None}


class Tier(BaseModel):
    name: str
    tier: int = Field(ge=1, le=4)


class TiersOut(BaseModel):
    tiers: list[Tier]


async def price_tiers(db: Db, brands: dict[str, str]) -> dict[str, int]:
    """{qloo_id: tier 1-4}. Rated once per brand ever, cached in qloo_cache under tier:<qloo_id>."""
    out = {}
    for i in brands:
        if (hit := await db.cache_get(f"tier:{i}")) is not None:
            out[i] = hit["tier"]
    missing = {i: n for i, n in brands.items() if i not in out}
    if missing:
        res = await llm.complete("price_tiers", "small", PRICE_TIERS_SYSTEM,
                                 PRICE_TIERS_USER.format(names=json.dumps(sorted(set(missing.values())))),
                                 schema=TiersOut, temperature=0)
        by_name = {norm(t.name): t.tier for t in res.tiers}
        for i, n in missing.items():
            if (t := by_name.get(norm(n))) is not None:  # a brand the LLM skipped stays unrated, out of the band
                out[i] = t
                await db.cache_put(f"tier:{i}", "tier", {}, {"tier": t})
    return out


class NameBio(BaseModel):
    id: str
    name: str = Field(min_length=1, max_length=40)
    bio: str = Field(min_length=1, max_length=300)


class PersonasOut(BaseModel):
    personas: list[NameBio]


async def build(q: Qloo, db: Db, sigs: list[SegmentSignals], comps: list[Comparable]) -> list[BuiltPersona]:
    specs = split(sigs)
    comp_ids = [c.qloo_id for c in comps]

    async def fetch(i: int, s: PersonaSpec):
        ids, d, what = [e.qloo_id for e in s.seeds], _demo(s), f"persona {i + 1}"
        return await asyncio.gather(
            _safe(q.insights(BRAND, ids, take=TOP_BRANDS, demographics=d), [], what),
            _safe(q.insights(BRAND, ids, demographics=d, result_ids=comp_ids), [], what))

    media_lists, fetched = await asyncio.gather(
        asyncio.gather(*[_safe(segment_media(q, s), {t: [] for t in MEDIA_TYPES}, s.label) for s in sigs]),
        asyncio.gather(*[fetch(i, s) for i, s in enumerate(specs)]))
    media = {s.index: m for s, m in zip(sigs, media_lists)}

    brand_ids = sorted({e.qloo_id for tops, _ in fetched for e in tops} | set(comp_ids))
    media_ids = {t: sorted({e.qloo_id for m in media.values() for e in m[t]}) for t in MEDIA_TYPES}
    bases = await asyncio.gather(*[_safe(baseline(q, t, ids), {}, "the baseline")
                                   for t, ids in [(BRAND, brand_ids), *media_ids.items()]])
    base = dict(zip([BRAND, *MEDIA_TYPES], bases))
    tiers = await price_tiers(db, {e.qloo_id: e.name for tops, _ in fetched for e in tops})

    built = []
    for s, (tops, comp_ents) in zip(specs, fetched):
        cands = [(e, "brand", scoring.lift(_aff(tops), base[BRAND], e.qloo_id)) for e in tops if e.qloo_id in base[BRAND]]
        for t in MEDIA_TYPES:
            ents = media[s.segment][t]
            cands += [(e, t.rsplit(":", 1)[1], scoring.lift(_aff(ents), base[t], e.qloo_id))
                      for e in ents if e.qloo_id in base[t]]
        picked = pick_receipts(cands)
        comp_lifts = {c: scoring.lift(_aff(comp_ents), base[BRAND], c) for c in comp_ids}
        receipts = [ReceiptIn(label=f"R{j + 1}", qloo_id=e.qloo_id, entity_name=e.name, entity_type=t, lift=li)
                    for j, (e, t, li) in enumerate(picked)]
        receipts += [ReceiptIn(label=f"C{j + 1}", qloo_id=c.qloo_id, entity_name=c.name, entity_type="comparable",
                               lift=comp_lifts[c.qloo_id]) for j, c in enumerate(comps)]
        top: dict[str, list[str]] = {}
        for e, t, _ in sorted(cands, key=lambda c: -c[2]):
            if len(top.setdefault(t, [])) < 3:
                top[t].append(e.name)
        lo, hi, weak = scoring.price_band([(tiers[e.qloo_id], li) for e, t, li in cands
                                           if t == "brand" and e.qloo_id in tiers])
        built.append(BuiltPersona(
            segment=s.segment, segment_label=s.label, age=s.age, name="", bio="", top=top, receipts=receipts,
            comparable_lifts=comp_lifts, stance_score=scoring.stance(comp_lifts, {c.qloo_id: c.weight for c in comps}),
            price_lo=lo, price_hi=hi, price_weak=weak))

    raw = [p.stance_score for p in built]
    for p, label, sc in zip(built, scoring.label_stances(raw), scoring.scaled(raw)):
        p.stance_label, p.stance_scaled = label, sc
    await _name(built)
    return built


async def _name(built: list[BuiltPersona]):
    lines = [f"P{i + 1} — segment: {p.segment_label}; age: {p.age or 'unknown'}; tastes: "
             f"{', '.join(r.entity_name for r in p.receipts if r.label.startswith('R'))}" for i, p in enumerate(built)]
    res = await llm.complete("personas", "big", PERSONAS_SYSTEM,
                             PERSONAS_USER.format(n=len(built), panelists="\n".join(lines)),
                             schema=PersonasOut, temperature=0.9)
    names = {nb.id: nb for nb in res.personas}
    for i, p in enumerate(built):
        nb = names.get(f"P{i + 1}")
        p.name, p.bio = (nb.name, nb.bio) if nb else (f"Panelist {i + 1}", f"a member of {p.segment_label}")
