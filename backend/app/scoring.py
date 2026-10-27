"""Pure scoring functions (no I/O). Code computes the numbers; the LLM only explains them."""

from statistics import median


def lift(persona: dict[str, float], baseline: dict[str, float], qloo_id: str) -> float:
    """Persona affinity minus baseline affinity for the same entity. 0 when either side has no data."""
    if qloo_id not in persona or qloo_id not in baseline:
        return 0.0
    return persona[qloo_id] - baseline[qloo_id]


def stance(lifts: dict[str, float], weights: dict[str, float]) -> float:
    total = sum(weights.values())  # > 0 is guaranteed by the PUT /comparables validation
    return sum(w * lifts.get(c, 0.0) for c, w in weights.items()) / total


def label_stances(raw: list[float]) -> list[str]:
    n = len(raw)
    if all(r < 0 for r in raw):
        return ["skeptic"] * n
    if max(raw) == min(raw):
        return ["conditional"] * n
    k = round(n / 3)  # 6 → 2, 3 → 1, 2 → 1
    order = sorted(range(n), key=lambda i: raw[i], reverse=True)
    labels = ["conditional"] * n
    for pos, i in enumerate(order):
        if pos < k:
            labels[i] = "enthusiast"
        elif pos >= n - k:
            labels[i] = "skeptic"
    return labels


def scaled(raw: list[float]) -> list[float]:
    """0..1 for the stance meter; 0.5 when all are equal."""
    lo, hi = min(raw), max(raw)
    return [0.5 if hi == lo else (r - lo) / (hi - lo) for r in raw]


def price_band(brands: list[tuple[int, float]]) -> tuple[float, float, bool]:
    """(tier, lift) pairs → (lo, hi, weak). Weak means no positive lifts, so the band is the full 1–4 range."""
    pos = [(t, li) for t, li in brands if li > 0]
    if not pos:
        return (1.0, 4.0, True)
    w = sum(li for _, li in pos)
    mean = sum(t * li for t, li in pos) / w
    std = (sum(li * (t - mean) ** 2 for t, li in pos) / w) ** 0.5
    return (max(1.0, mean - std), min(4.0, mean + std), False)


# Price ÷ the comparables' median price: under 0.8× budget, 0.8–1.1× mid, 1.1–1.4× premium, 1.4× and up luxury.
# A ratio, not a rank: a rank made anything above every comparable "luxury", even 50 cents over. Tune on the backtest.
TIER_RATIOS = (0.8, 1.1, 1.4)


def concept_tier(price: float, comparable_prices: list[float]) -> int:
    return 1 + sum(price / median(comparable_prices) >= r for r in TIER_RATIOS)


def price_fit(tier: int, band: tuple[float, float, bool]) -> bool:
    return band[0] <= tier <= band[1]
