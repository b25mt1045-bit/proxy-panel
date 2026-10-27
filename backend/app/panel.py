"""Panel rounds and the moderator (design §7). Every statement goes through the validator, with one retry."""

import asyncio
from collections.abc import Awaitable, Callable
from itertools import combinations
from typing import Literal

from pydantic import BaseModel, Field

from app import llm, validator
from app.models import CURRENCY, MARKETS, Brief
from app.personas import BuiltPersona
from app.prompts import (
    MODERATOR_SYSTEM,
    MODERATOR_USER,
    PANELIST_FIX,
    PANELIST_R1_USER,
    PANELIST_R2_USER,
    PANELIST_SYSTEM,
    fence,
)


class Said(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    preferred_variant: Literal["A", "B"] | None = None


class Final(BaseModel):
    persona: BuiltPersona
    round: int
    said: Said
    errors: list[str]


class ModeratorOut(BaseModel):
    focus: str = Field(min_length=1, max_length=120)
    questions: list[str] = Field(min_length=1, max_length=2)


OnFinal = Callable[[Final], Awaitable[None]]


class Context(BaseModel):
    """What every panelist sees about the product, plus what the validator checks prices against."""
    brief: Brief
    tier: int
    comparable_prices: list[float]

    @property
    def own_prices(self) -> set[float]:
        return {v.price or self.brief.price for v in self.brief.variants} | set(self.comparable_prices)


def system(p: BuiltPersona, tier: int, cur: str = "$") -> str:
    receipts = "\n".join(f"[{r.label}] {r.entity_name} ({r.entity_type}, lift {r.lift:+.2f})" for r in p.receipts)
    return PANELIST_SYSTEM.format(name=p.name, bio=p.bio, receipts=receipts, stance_label=p.stance_label,
                                  scaled=p.stance_scaled, lo=p.price_lo, hi=p.price_hi, tier=tier, cur=cur)


async def _say(p: BuiltPersona, prompt: str, user: str, ctx: Context, i: int) -> Said:
    said = await llm.complete(prompt, "small", system(p, ctx.tier, CURRENCY[ctx.brief.market]), user, schema=Said, temperature=0.7 + 0.05 * i)
    if len(ctx.brief.variants) == 1:
        said.preferred_variant = None
    return said


async def _check(ps: list[BuiltPersona], outs: list[Said], ctx: Context) -> list[list[str]]:
    errs = [validator.check_static(o.text, p.labels, (p.price_lo, p.price_hi), ctx.comparable_prices, ctx.own_prices)
            for p, o in zip(ps, outs)]
    for e, p, s in zip(errs, ps, await validator.sentiments([o.text for o in outs])):
        if m := validator.stance_error(p.stance_label, s):
            e.append(m)
    return errs


async def run_round(prompt: str, rnd: int, ps: list[BuiltPersona], users: list[str], ctx: Context,
                    on_final: OnFinal) -> list[Final]:
    """Statements that pass go to on_final at once; failures are regenerated once with the errors named,
    then go to on_final passed or flagged. The UI never sees a line that is later replaced."""
    outs = list(await asyncio.gather(*[_say(p, prompt, u, ctx, i) for i, (p, u) in enumerate(zip(ps, users))]))
    errs = await _check(ps, outs, ctx)
    finals: list[Final | None] = [None] * len(ps)
    for i, (p, o, e) in enumerate(zip(ps, outs, errs)):
        if not e:
            finals[i] = Final(persona=p, round=rnd, said=o, errors=[])
            await on_final(finals[i])
    redo = [i for i, e in enumerate(errs) if e]
    if redo:
        outs2 = await asyncio.gather(*[_say(ps[i], prompt, users[i] + PANELIST_FIX.format(errors="; ".join(errs[i])),
                                            ctx, i) for i in redo])
        errs2 = await _check([ps[i] for i in redo], list(outs2), ctx)
        for i, o, e in zip(redo, outs2, errs2):
            finals[i] = Final(persona=ps[i], round=rnd, said=o, errors=e)
            await on_final(finals[i])
    return finals


def _money(x: float) -> str:
    return f"{x:.2f}".removesuffix(".00")  # 28.0 → "28", 3.5 → "3.50", so panelists don't write "£28.0"


def round1_user(ctx: Context) -> str:
    b = ctx.brief
    variants = "; ".join(f"{v.key}: {v.name}, {v.positioning or 'no positioning given'}, {CURRENCY[b.market]}{_money(v.price or b.price)}"
                         for v in b.variants)
    ask = "Say which variant you prefer and why." if len(b.variants) > 1 else "Don't mention variants."
    return PANELIST_R1_USER.format(brief=fence("brief", b.description), variants=fence("variants", variants),
                                   variant_ask=ask, market=MARKETS[b.market])


def pick_pair(ps: list[BuiltPersona]) -> tuple[BuiltPersona, BuiltPersona]:
    """Widest stance gap among pairs that hold the same kind of receipt (both brands, both media), else overall."""
    def kinds(p):
        return {r.entity_type for r in p.receipts if r.label.startswith("R")}

    pairs = list(combinations(ps, 2))
    pool = [(a, b) for a, b in pairs if kinds(a) & kinds(b)] or pairs
    return max(pool, key=lambda ab: abs(ab[0].stance_score - ab[1].stance_score))


async def moderate(a: BuiltPersona, b: BuiltPersona, r1: dict[int, str], ctx: Context) -> ModeratorOut:
    return await llm.complete("moderator", "big", MODERATOR_SYSTEM, MODERATOR_USER.format(
        brief=fence("brief", ctx.brief.description), a_name=a.name, a_label=a.stance_label, a_text=r1[a.id],
        b_name=b.name, b_label=b.stance_label, b_text=r1[b.id]), schema=ModeratorOut, temperature=0.5)


def round2_users(a: BuiltPersona, b: BuiltPersona, mod: ModeratorOut, r1: dict[int, str]) -> list[str]:
    q = " ".join(mod.questions)
    return [PANELIST_R2_USER.format(question=q, own=r1[x.id], other_name=y.name, other=r1[y.id])
            for x, y in ((a, b), (b, a))]
