import asyncio

from pydantic import BaseModel, Field

from app import llm, orchestrator
from app.models import CURRENCY, MARKETS, Brief, Comparable
from app.prompts import COMPARABLES_SYSTEM, COMPARABLES_USER, fence
from app.qloo import Qloo

MAX_COMPARABLES = 6


class BrandPrice(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price: float = Field(gt=0)


class ComparablesOut(BaseModel):
    brands: list[BrandPrice] = Field(min_length=3, max_length=8)


async def propose(qloo: Qloo, brief: Brief) -> tuple[list[Comparable], list[str]]:
    """LLM proposes competitor brands with prices; each is checked against Qloo. Returns (comparables, dropped)."""
    out = await llm.complete(
        "comparables", "big", COMPARABLES_SYSTEM,
        COMPARABLES_USER.format(brief=fence("brief", brief.description), market=MARKETS[brief.market], cur=CURRENCY[brief.market],
                                category=brief.category, price=brief.price),
        schema=ComparablesOut, temperature=0.3)
    hits = await asyncio.gather(*[qloo.resolve(b.name) for b in out.brands])
    comps = [Comparable(qloo_id=h.qloo_id, name=h.name, price=b.price) for b, h in zip(out.brands, hits) if h]
    dropped = [b.name for b, h in zip(out.brands, hits) if not h]

    if len(comps) < 3:
        extra = await orchestrator.repair(
            qloo, goal=f"find 3+ competitor brands for {fence('brief', brief.description)}",
            have=[c.name for c in comps], failed=dropped)
        # shortcut: repaired brands have no LLM price, so they default to our price; the user edits it on confirm.
        comps += [Comparable(qloo_id=e.qloo_id, name=e.name, price=brief.price) for e in extra]

    unique: dict[str, Comparable] = {}
    for c in comps:
        unique.setdefault(c.qloo_id, c)
    return list(unique.values())[:MAX_COMPARABLES], dropped
