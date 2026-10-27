import asyncio
import hashlib
import json
import re
from asyncio import sleep
from contextvars import ContextVar
from pathlib import Path
from time import monotonic
from urllib.parse import urlencode

import httpx
from pydantic import BaseModel

from app.db import Db
from app.models import MARKETS

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "qloo"
SPACING_S = 0.22
MAX_TAKE = 50  # Qloo rejects take > 50 with a 400

# Per-run counters, set by the pipeline: {"qloo_calls": int, "qloo_cache_hits": int, "llm_cost_usd": float, "warnings": list}
run_ctx: ContextVar[dict | None] = ContextVar("run_ctx", default=None)


def _bump(field: str):
    ctx = run_ctx.get()
    if ctx is not None:
        ctx[field] = ctx.get(field, 0) + 1


class QlooError(Exception):
    """A 4xx other than 429, or no usable data. The API turns it into a 502."""


class QlooPartial(QlooError):
    """A 429 or 5xx/timeout that persisted after one retry. The caller records a warning and continues."""


class Entity(BaseModel):
    qloo_id: str
    name: str
    type: str
    affinity: float | None = None
    rank: int  # 0-based position in the response


def norm(name: str) -> str:
    """Lowercase, punctuation stripped: "Dr. Squatch" → "dr squatch"."""
    return " ".join(re.sub(r"[^\w\s]", "", name.lower()).split())


def cache_key(path: str, params: dict) -> str:
    return hashlib.sha256((path + "?" + urlencode(sorted(params.items()))).encode()).hexdigest()


class Qloo:
    def __init__(self, db: Db, api_key: str, base_url: str, mock: bool, fixtures: Path = FIXTURES):
        self.db, self.mock, self.fixtures = db, mock, fixtures
        self.client = httpx.AsyncClient(base_url=base_url, headers={"X-Api-Key": api_key}, timeout=10)
        self._lock = asyncio.Lock()
        self._last = -SPACING_S
        self._inflight: dict[str, asyncio.Future] = {}

    async def search(self, query: str, types: str = "urn:entity:brand", take: int = 1) -> list[Entity]:
        data = await self._get("/search", {"query": query, "types": types, "take": take})
        return [
            Entity(qloo_id=r["entity_id"], name=r["name"], type=(r.get("types") or [types])[0], rank=i)
            for i, r in enumerate(data.get("results", []))
        ]

    async def resolve(self, name: str, types: str = "urn:entity:brand") -> Entity | None:
        """The entity this name refers to, or None. Search returns the nearest *wrong* entity on a miss
        ("The Whole Truth" → Whole Foods Market), so a hit must equal the name or start with it."""
        hits = await self.search(name, types, take=3)
        q = norm(name)
        exact = [h for h in hits if norm(h.name) == q]
        return (exact or [h for h in hits if norm(h.name).startswith(q + " ")] or [None])[0]

    async def insights(self, filter_type: str, entity_ids: list[str], take: int = 5,
                       demographics: dict | None = None, location: str | None = None,
                       result_ids: list[str] | None = None) -> list[Entity]:
        """Entities of `filter_type` ranked for the seed entities. With `result_ids`, scores exactly those
        entities instead of returning the top `take` (an id Qloo has no data for is left out)."""
        if result_ids and len(result_ids) > MAX_TAKE:
            ids = sorted(result_ids)
            parts = await asyncio.gather(*[self.insights(filter_type, entity_ids, take, demographics, location,
                                                         ids[i:i + MAX_TAKE]) for i in range(0, len(ids), MAX_TAKE)])
            return [e.model_copy(update={"rank": r}) for r, e in enumerate(e for p in parts for e in p)]
        params = {"filter.type": filter_type, "signal.interests.entities": ",".join(entity_ids), "take": take}
        for k, v in (demographics or {}).items():
            params[f"signal.demographics.{k}"] = v
        # shortcut: US runs send no location, so the recorded US fixtures stay valid; filter US too if results look global.
        market = (run_ctx.get() or {}).get("market", "US")
        if location := location or (MARKETS[market] if market != "US" else None):
            params["signal.location.query"] = location
        if result_ids:
            params["filter.results.entities"] = ",".join(sorted(result_ids))  # sorted for stable cache keys
            params["take"] = len(result_ids)
        data = await self._get("/v2/insights", params)
        return [
            Entity(qloo_id=e["entity_id"], name=e["name"], type=e.get("subtype") or filter_type,
                   affinity=(e.get("query") or {}).get("affinity"), rank=i)
            for i, e in enumerate((data.get("results") or {}).get("entities", []))
        ]

    async def _get(self, path: str, params: dict) -> dict:
        key = cache_key(path, params)
        if (pending := self._inflight.get(key)) is not None:  # identical parallel requests share one call
            _bump("qloo_cache_hits")
            return await pending
        self._inflight[key] = task = asyncio.ensure_future(self._get_once(key, path, params))
        try:
            return await task
        finally:
            self._inflight.pop(key, None)

    async def _get_once(self, key: str, path: str, params: dict) -> dict:
        if (cached := await self.db.cache_get(key)) is not None:
            _bump("qloo_cache_hits")
            return cached
        data = self._fixture(key, path, params) if self.mock else await self._fetch(path, params)
        _bump("qloo_calls")
        await self.db.cache_put(key, path, params, data)
        return data

    def _fixture(self, key: str, path: str, params: dict) -> dict:
        f = self.fixtures / f"{key}.json"
        if not f.exists():
            raise QlooError(f"no fixture for {path} {params} (expected {f.name})")
        return json.loads(f.read_text(encoding="utf-8"))

    async def _fetch(self, path: str, params: dict) -> dict:
        for attempt in (1, 2):
            try:
                r = await self._spaced_get(path, params)
            except httpx.TransportError as e:
                if attempt == 2:
                    raise QlooPartial(f"{path}: {e!r}") from e
                continue
            if r.status_code == 429:
                if attempt == 2:
                    raise QlooPartial(f"{path}: rate limited")
                await sleep(1)
            elif r.status_code >= 500:
                if attempt == 2:
                    raise QlooPartial(f"{path}: HTTP {r.status_code}")
            elif r.status_code >= 400:
                raise QlooError(f"{path} {params}: HTTP {r.status_code} {r.text[:300]}")
            else:
                return r.json()

    async def _spaced_get(self, path: str, params: dict) -> httpx.Response:
        async with self._lock:  # serializes only the send time, not the wait for the response
            wait = SPACING_S - (monotonic() - self._last)
            if wait > 0:
                await sleep(wait)
            self._last = monotonic()
        return await self.client.get(path, params=params)
