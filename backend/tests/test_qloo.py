import json
from time import monotonic

import httpx
import pytest
import respx

from app.qloo import Qloo, QlooError, QlooPartial, cache_key, run_ctx

BASE = "https://qloo.test"
HIT = {"results": [{"entity_id": "E1", "name": "Olipop", "types": ["urn:entity:brand"]}]}
SEARCH = {"query": "Olipop", "types": "urn:entity:brand", "take": 1}


@pytest.fixture
def ctx():
    c = {"qloo_calls": 0, "qloo_cache_hits": 0}
    token = run_ctx.set(c)
    yield c
    run_ctx.reset(token)


def client(db, mock=False, fixtures=None):
    return Qloo(db, "key", BASE, mock=mock, **({"fixtures": fixtures} if fixtures else {}))


@respx.mock
async def test_cache_hit_makes_no_call(db, ctx):
    route = respx.get(f"{BASE}/search").mock(return_value=httpx.Response(200, json=HIT))
    await db.cache_put(cache_key("/search", SEARCH), "/search", SEARCH, HIT)
    [e] = await client(db).search("Olipop")
    assert e.name == "Olipop" and route.call_count == 0
    assert ctx == {"qloo_calls": 0, "qloo_cache_hits": 1}


@respx.mock
async def test_miss_calls_then_caches(db, ctx):
    route = respx.get(f"{BASE}/search").mock(return_value=httpx.Response(200, json=HIT))
    q = client(db)
    await q.search("Olipop")
    await q.search("Olipop")
    assert route.call_count == 1 and ctx == {"qloo_calls": 1, "qloo_cache_hits": 1}
    assert route.calls[0].request.headers["X-Api-Key"] == "key"


@respx.mock
async def test_parallel_calls_are_spaced(db):
    import asyncio

    sent = []

    def record(request):
        sent.append(monotonic())
        return httpx.Response(200, json=HIT)

    respx.get(f"{BASE}/search").mock(side_effect=record)
    q = client(db)
    await asyncio.gather(q.search("a"), q.search("b"))
    assert sent[1] - sent[0] >= 0.21


@respx.mock
async def test_429_retries_once(db, monkeypatch):
    async def no_sleep(_):
        pass

    monkeypatch.setattr("app.qloo.sleep", no_sleep)
    route = respx.get(f"{BASE}/search").mock(side_effect=[httpx.Response(429), httpx.Response(200, json=HIT)])
    assert (await client(db).search("Olipop"))[0].qloo_id == "E1"
    assert route.call_count == 2

    respx.get(f"{BASE}/search").mock(return_value=httpx.Response(429))
    with pytest.raises(QlooPartial):
        await client(db).search("other")


@respx.mock
async def test_5xx_and_400(db, monkeypatch):
    monkeypatch.setattr("app.qloo.SPACING_S", 0)
    route = respx.get(f"{BASE}/search").mock(return_value=httpx.Response(503))
    with pytest.raises(QlooPartial):
        await client(db).search("x")
    assert route.call_count == 2

    respx.get(f"{BASE}/search").mock(return_value=httpx.Response(400, text="bad param"))
    with pytest.raises(QlooError, match="bad param") as e:
        await client(db).search("y")
    assert not isinstance(e.value, QlooPartial)


@respx.mock
async def test_insights_params_and_mapping(db):
    body = {"results": {"entities": [{"entity_id": "E2", "name": "Poppi", "type": "urn:entity", "subtype": "urn:entity:brand",
                                      "query": {"affinity": 0.93}}]}}
    route = respx.get(f"{BASE}/v2/insights").mock(return_value=httpx.Response(200, json=body))
    [e] = await client(db).insights("urn:entity:brand", ["S1", "S2"], demographics={"age": "25_to_29"},
                                    location="India", result_ids=["E2"])
    assert (e.qloo_id, e.type, e.affinity, e.rank) == ("E2", "urn:entity:brand", 0.93, 0)
    p = route.calls[0].request.url.params
    assert p["signal.interests.entities"] == "S1,S2" and p["signal.demographics.age"] == "25_to_29"
    assert p["signal.location.query"] == "India" and p["filter.results.entities"] == "E2" and p["take"] == "1"


async def test_mock_reads_fixture_or_fails_loudly(db, tmp_path):
    (tmp_path / f"{cache_key('/search', SEARCH)}.json").write_text(json.dumps(HIT))
    q = client(db, mock=True, fixtures=tmp_path)
    assert (await q.search("Olipop"))[0].name == "Olipop"
    with pytest.raises(QlooError, match="no fixture for /search"):
        await q.search("Missing")


@respx.mock
async def test_result_ids_over_50_are_chunked(db, monkeypatch):
    monkeypatch.setattr("app.qloo.SPACING_S", 0)

    def reply(request):
        ids = request.url.params["filter.results.entities"].split(",")
        assert len(ids) <= 50 and request.url.params["take"] == str(len(ids))
        return httpx.Response(200, json={"results": {"entities": [
            {"entity_id": i, "name": i, "query": {"affinity": 0.5}} for i in ids]}})

    route = respx.get(f"{BASE}/v2/insights").mock(side_effect=reply)
    ids = [f"E{n:03}" for n in range(82)]
    out = await client(db).insights("urn:entity:brand", ["S1"], result_ids=ids)
    assert route.call_count == 2 and sorted(e.qloo_id for e in out) == ids


async def test_parallel_cache_puts_of_one_key_do_not_fail(db):
    import asyncio

    await asyncio.gather(*[db.cache_put("k", "/search", {}, {"n": i}) for i in range(5)])
    assert (await db.cache_get("k"))["n"] in range(5)


@respx.mock
async def test_identical_parallel_requests_share_one_call(db, ctx):
    import asyncio

    route = respx.get(f"{BASE}/search").mock(return_value=httpx.Response(200, json=HIT))
    q = client(db)
    out = await asyncio.gather(*[q.search("Olipop") for _ in range(4)])
    assert route.call_count == 1 and all(o[0].qloo_id == "E1" for o in out)
    assert ctx == {"qloo_calls": 1, "qloo_cache_hits": 3}
