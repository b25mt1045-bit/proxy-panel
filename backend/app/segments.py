"""Segment → resolved Qloo seed entities, its media fingerprint, and baseline scores (design §5)."""

import asyncio
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app import llm, orchestrator
from app.config import AGE_BUCKETS, settings
from app.models import Segment
from app.presets import PRESETS
from app.prompts import SEEDS_SYSTEM, SEEDS_USER, fence
from app.qloo import Entity, Qloo

MEDIA_TYPES = ["urn:entity:artist", "urn:entity:tv_show", "urn:entity:podcast"]
# Broad, generic tastes: the "average person" that lifts are measured against.
BASELINE_SEEDS = [("Coca-Cola", "brand"), ("Netflix", "brand"), ("Amazon", "brand"), ("Taylor Swift", "artist"),
                  ("The Joe Rogan Experience", "podcast")]


class SegmentFailed(Exception):
    """Fewer than 2 seeds resolved, even after repair. The pipeline skips the segment with a warning."""


class SegmentSignals(BaseModel):
    index: int
    label: str
    seeds: list[Entity]
    age: str | None
    gender: str | None
    dropped: list[str]


class Seed(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: Literal["brand", "artist", "podcast", "tv_show"]


class SeedsOut(BaseModel):
    seeds: list[Seed] = Field(min_length=2, max_length=6)
    age: str | None = None
    gender: Literal["male", "female"] | None = None

    @field_validator("age")
    @classmethod
    def known_bucket(cls, v):
        return v if v in AGE_BUCKETS else None


async def build_segment_signals(qloo: Qloo, seg: Segment, index: int) -> SegmentSignals:
    if seg.preset_id:
        p = PRESETS[seg.preset_id]
        label, age, gender, wanted = p["label"], p.get("age"), p.get("gender"), p["seeds"]
    else:
        out = await llm.complete(
            "seeds", "small", SEEDS_SYSTEM,
            SEEDS_USER.format(segment=fence("segment", seg.text), age_buckets=", ".join(AGE_BUCKETS)),
            schema=SeedsOut, temperature=0.3)
        label, age, gender, wanted = seg.text, out.age, out.gender, [(s.name, s.type) for s in out.seeds]

    hits = await asyncio.gather(*[qloo.resolve(name, f"urn:entity:{t}") for name, t in wanted])
    seeds = list({h.qloo_id: h for h in hits if h}.values())
    dropped = [name for (name, _), h in zip(wanted, hits) if not h]

    if len(seeds) < 2:
        extra = await orchestrator.repair(
            qloo, goal=f"find 3 entities (brands, artists, podcasts or TV shows) that typify {fence('segment', label)}",
            have=[s.name for s in seeds], failed=dropped)
        seeds += [e for e in extra if e.qloo_id not in {s.qloo_id for s in seeds}]
    if len(seeds) < 2:
        raise SegmentFailed(f"could not find Qloo seeds for segment '{label}'")
    return SegmentSignals(index=index, label=label, seeds=seeds, age=age, gender=gender, dropped=dropped)


def demo(sig: SegmentSignals) -> dict:
    if not settings.DEMOGRAPHICS_ENABLED:
        return {}
    return {k: v for k, v in {"age": sig.age, "gender": sig.gender}.items() if v}


async def segment_media(qloo: Qloo, sig: SegmentSignals) -> dict[str, list[Entity]]:
    """Top 5 artists, TV shows and podcasts for the segment. Called once per segment."""
    ids = [s.qloo_id for s in sig.seeds]
    lists = await asyncio.gather(*[qloo.insights(t, ids, take=5, demographics=demo(sig)) for t in MEDIA_TYPES])
    return dict(zip(MEDIA_TYPES, lists))


async def baseline(qloo: Qloo, filter_type: str, ids: list[str]) -> dict[str, float]:
    """{qloo_id: affinity} for these entities under the generic baseline seeds (design G9)."""
    if not ids:
        return {}
    seeds = await asyncio.gather(*[qloo.resolve(n, f"urn:entity:{t}") for n, t in BASELINE_SEEDS])
    ents = await qloo.insights(filter_type, [s.qloo_id for s in seeds if s], result_ids=ids)
    return {e.qloo_id: e.affinity for e in ents if e.affinity is not None}
