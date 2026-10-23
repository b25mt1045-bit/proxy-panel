"""One full pipeline run against live Qloo and Gemini, printing each event.

Usage (from backend/, needs QLOO_API_KEY, LLM_API_KEY, LLM_SMALL, LLM_BIG in .env):
    python -m scripts.live_run [example_index]   # 0 beverage, 1 personal_care, 2 app; default 0
Uses DATABASE_URL (proxy.db), so the Qloo cache carries over and repeat runs cost less quota.
"""

import asyncio
import json
import sys
import uuid

from app import pipeline
from app.comparables import propose
from app.config import settings
from app.db import Comparable, Db, Run
from app.models import Brief
from app.presets import EXAMPLE_BRIEFS
from app.qloo import Qloo


async def main(i: int):
    missing = [k for k in ("QLOO_API_KEY", "LLM_API_KEY", "LLM_SMALL", "LLM_BIG") if not getattr(settings, k)]
    if missing:
        raise SystemExit(f"Missing from backend/.env: {', '.join(missing)}")
    settings.QLOO_MOCK = settings.LLM_MOCK = False  # llm.py reads these at call time
    db = Db(settings.DATABASE_URL)
    await db.create_all()
    q = Qloo(db, settings.QLOO_API_KEY, settings.QLOO_BASE_URL, mock=False)

    raw = EXAMPLE_BRIEFS[i]
    comps, dropped = await propose(q, Brief.model_validate(raw))
    print(f"comparables: {[c.name for c in comps]}  dropped: {dropped}")
    run_id = str(uuid.uuid4())
    async with db.session() as s:
        s.add(Run(id=run_id, status="running", brief=raw))
        s.add_all(Comparable(run_id=run_id, **c.model_dump(exclude={"resolved"})) for c in comps)
        await s.commit()

    await pipeline.run(db, q, run_id)
    async with db.session() as s:
        run = await s.get(Run, run_id)
    for e in run.events:
        print(f"[{e['type']}] {json.dumps(e['data'], ensure_ascii=False)[:400]}")
    if run.report:
        r = run.report
        print(f"\nREPORT: {r['verdict']['sentence']} ({r['verdict']['confidence']})  sensitivity: {r['sensitivity']['change']}")
        for o in r["objections"]:
            print(f"  objection: {o['text']}  (statements {o['statement_ids']})")
        print(f"  interview: {r['interview']['questions']}")
    print(f"\nrun {run_id}: {run.status}  qloo_calls={run.qloo_calls} cache_hits={run.qloo_cache_hits} "
          f"llm_cost=${run.llm_cost_usd:.4f}  warnings={len(run.warnings or [])}")
    await db.engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(int(sys.argv[1]) if len(sys.argv) > 1 else 0))
