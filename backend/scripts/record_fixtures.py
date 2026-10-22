"""Runs the example briefs and every preset against live Qloo, then saves each response as a mock fixture.

Usage (from backend/, needs QLOO_API_KEY in .env): python -m scripts.record_fixtures
The LLM side uses its mock fixtures, so the recorded Qloo calls match what mock mode will ask for.
Existing fixtures are loaded first, so only new calls hit the API. Re-run whenever a module adds or changes
Qloo calls, and commit fixtures/qloo/. To refresh everything, delete fixtures/qloo/ first.
"""

import asyncio
import json
import tempfile
from pathlib import Path

from sqlalchemy import select

from app import personas
from app.comparables import propose
from app.config import settings
from app.db import Db, QlooCache
from app.models import Brief, Segment
from app.presets import EXAMPLE_BRIEFS, PRESETS
from app.qloo import FIXTURES, Qloo
from app.segments import MEDIA_TYPES, SegmentFailed, baseline, build_segment_signals, segment_media


async def record_brief(q: Qloo, brief: Brief):
    comps, dropped = await propose(q, brief)
    print(f"\n{brief.description[:50]}…\n  comparables: {[c.name for c in comps]}  dropped: {dropped}")
    await baseline(q, "urn:entity:brand", [c.qloo_id for c in comps])
    sigs = []
    for i, seg in enumerate(brief.segments):
        try:
            sig = await build_segment_signals(q, seg, i)
        except SegmentFailed as e:
            print(f"  FAILED: {e}")
            continue
        sigs.append(sig)
        media = await segment_media(q, sig)
        for t in MEDIA_TYPES:
            await baseline(q, t, [e.qloo_id for e in media[t]])
        print(f"  segment '{sig.label}': seeds {[s.name for s in sig.seeds]}  dropped: {sig.dropped}")
    built = await personas.build(q, q.db, sigs, comps)
    print(f"  personas: {[(p.stance_label, round(p.stance_score, 3)) for p in built]}")


async def main():
    if not settings.QLOO_API_KEY:
        raise SystemExit("QLOO_API_KEY is missing from backend/.env")
    db = Db(f"sqlite+aiosqlite:///{Path(tempfile.mkdtemp()) / 'record.db'}")
    await db.create_all()
    existing = list(FIXTURES.glob("*.json"))
    for f in existing:  # path/params aren't known for old files; only key and response matter for mock mode
        await db.cache_put(f.stem, "", {}, json.loads(f.read_text(encoding="utf-8")))
    print(f"Loaded {len(existing)} existing fixtures")
    q = Qloo(db, settings.QLOO_API_KEY, settings.QLOO_BASE_URL, mock=False)

    for b in EXAMPLE_BRIEFS:
        await record_brief(q, Brief.model_validate(b))
    for pid in PRESETS:  # so every preset works in mock mode, not just the ones the examples use
        try:
            await build_segment_signals(q, Segment(preset_id=pid), 0)
        except SegmentFailed as e:
            print(f"  PRESET FAILED: {e}")

    FIXTURES.mkdir(parents=True, exist_ok=True)
    async with db.session() as s:
        rows = (await s.scalars(select(QlooCache))).all()
    rows = [r for r in rows if not r.key.startswith("tier:")]  # price tiers are LLM output, not Qloo data
    for r in rows:
        (FIXTURES / f"{r.key}.json").write_text(json.dumps(r.response, ensure_ascii=False), encoding="utf-8")
    print(f"\nWrote {len(rows)} fixtures to {FIXTURES}")


if __name__ == "__main__":
    asyncio.run(main())
