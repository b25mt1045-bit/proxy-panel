"""Checks every panelist statement in code (design §8). Errors read "code: detail"; flags keep the code."""

import json
import re
from typing import Literal

from pydantic import BaseModel

from app import llm
from app.prompts import SENTIMENT_SYSTEM, SENTIMENT_USER
from app.scoring import concept_tier

CITE = re.compile(r"\[([RC]\d+)\]")
DOLLARS = re.compile(r"\$\s?(\d+(?:\.\d{1,2})?)")
# "three dollars", "twenty-nine bucks": hides an amount from the DOLLARS check, so it must be written as digits.
_NUM = r"(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred)"
PRICE_WORDS = re.compile(rf"\b{_NUM}(?:[\s-]+{_NUM})*[\s-]+(?:dollars?|bucks)\b(?!-)", re.IGNORECASE)
MIN_WORDS, MAX_WORDS = 40, 120  # loose bounds around the 60-100 asked for


def cited(text: str) -> list[str]:
    return list(dict.fromkeys(CITE.findall(text)))


def check_static(text: str, labels: set[str], band: tuple[float, float], comparable_prices: list[float],
                 own_prices: set[float]) -> list[str]:
    errs, ids = [], cited(text)
    if not ids:
        errs.append("no_receipt: cite at least one ID like [R1]")
    if bad := [c for c in ids if c not in labels]:
        errs.append(f"foreign_receipt: {', '.join(bad)} are not your IDs")
    for amt in DOLLARS.findall(text):
        if float(amt) in own_prices:  # quoting the product's or a competitor's real price is fine
            continue
        t = concept_tier(float(amt), comparable_prices)
        if not band[0] <= t <= band[1]:
            errs.append(f"price_out_of_band: ${amt} is tier {t}, your band is {band[0]:.1f}-{band[1]:.1f}")
    if m := PRICE_WORDS.search(text):
        errs.append(f"price_in_words: write \"{m.group(0)}\" as digits, like $3.29")
    if not MIN_WORDS <= (n := len(text.split())) <= MAX_WORDS:
        errs.append(f"length: {n} words")
    return errs


def stance_error(label: str, sentiment: str) -> str | None:
    if (label, sentiment) in (("enthusiast", "negative"), ("skeptic", "positive")):
        return f"stance_mismatch: you are {label} but sounded {sentiment}"
    return None


class Sentiment(BaseModel):
    id: int
    sentiment: Literal["positive", "mixed", "negative"]


class SentimentOut(BaseModel):
    results: list[Sentiment]


async def sentiments(texts: list[str]) -> list[str]:
    """One batched call. A statement the classifier skips counts as mixed, which never flags."""
    res = await llm.complete("sentiment", "small", SENTIMENT_SYSTEM,
                             SENTIMENT_USER.format(statements=json.dumps([{"id": i, "text": t} for i, t in enumerate(texts)])),
                             schema=SentimentOut, temperature=0)
    by_id = {r.id: r.sentiment for r in res.results}
    return [by_id.get(i, "mixed") for i in range(len(texts))]


def codes(errs: list[str]) -> list[str]:
    return [e.split(":", 1)[0] for e in errs]
