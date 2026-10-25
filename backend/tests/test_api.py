import asyncio
import copy
import time

import httpx
import pytest

from app import main
from app.db import Run
from app.presets import EXAMPLE_BRIEFS
from app.qloo import Qloo

BRIEF = EXAMPLE_BRIEFS[0]


@pytest.fixture
async def api(db):
    main.app.state.db = db
    main.app.state.q = Qloo(db, "", "http://unused", mock=True)
    main._search_hits.clear()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://t") as c:
        yield c


def brief(**changes):
    b = copy.deepcopy(BRIEF)
    b.update(changes)
    return b


def body(comps, **extra):
    return {"comparables": [{k: c[k] for k in ("qloo_id", "name", "weight", "price")} for c in comps], **extra}


async def created(api) -> dict:
    r = await api.post("/runs", json=BRIEF)
    assert r.status_code == 201, r.text
    return r.json()


async def test_post_runs_returns_proposed_comparables(api):
    out = await created(api)
    assert out["status"] == "confirming" and 3 <= len(out["comparables"]) <= 6
    assert all(c["id"] and c["resolved"] for c in out["comparables"])


@pytest.mark.parametrize("bad", [
    brief(description="ten chars!"),
    brief(segments=[{"preset_id": "genz_urban_fitness", "text": "both given"}]),
    brief(variants=[{"key": k, "name": k} for k in "AB"] + [{"key": "A", "name": "third"}]),
    brief(segments=[{"preset_id": "no_such_preset"}]),
])
async def test_invalid_brief_is_400(api, bad):
    r = await api.post("/runs", json=bad)
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_brief"


async def test_put_validation(api):
    out = await created(api)
    run, comps = out["run_id"], out["comparables"]
    zero = [{**c, "weight": 0} for c in comps]
    seven = [{**comps[0], "qloo_id": f"x{i}"} for i in range(7)]
    fake = [*comps[:2], {**comps[0], "qloo_id": "INVENTED", "name": "Invented"}]
    for b in (body(zero), body(seven), body(fake), body(comps, variant_weights={"Z": {comps[0]["qloo_id"]: 1}})):
        r = await api.put(f"/runs/{run}/comparables", json=b)
        assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_comparables", r.text


async def test_full_run_through_the_api(api):
    out = await created(api)
    run, comps = out["run_id"], out["comparables"]
    assert (await api.get(f"/runs/{run}/report")).status_code == 409  # not done yet

    r = await api.put(f"/runs/{run}/comparables", json=body(comps))
    assert r.status_code == 202 and r.json()["stream_url"] == f"/runs/{run}/stream"
    assert (await api.put(f"/runs/{run}/comparables", json=body(comps))).json()["error"]["code"] == "bad_status"
    await asyncio.gather(*main._tasks)

    got = (await api.get(f"/runs/{run}")).json()
    assert got["run"]["status"] == "done" and got["run"]["created_at"].endswith("Z")
    assert len(got["personas"]) == 6 and len(got["statements"]) == 8 and got["moderator"]
    assert "client_ip" not in str(got) and "llm_cost_usd" not in str(got)  # share links are public

    rep = (await api.get(f"/runs/{run}/report")).json()
    assert rep["run_id"] == run and rep["verdict"]["sentence"].startswith("Launch to")

    text = (await api.get(f"/runs/{run}/stream")).text
    assert text.startswith("id: 1\nevent: progress\n")
    assert text.rstrip().split("\n\n")[-1].split("\n")[1] == "event: done"
    tail = (await api.get(f"/runs/{run}/stream", headers={"Last-Event-ID": "5"})).text
    assert tail.startswith("id: 6\n")


async def test_unknown_run_is_404(api):
    for path in ("/runs/nope", "/runs/nope/report", "/runs/nope/stream"):
        r = await api.get(path)
        assert r.status_code == 404 and r.json() == {"error": {"code": "run_not_found", "message": "Run not found."}}


async def test_spend_cap(api, db):
    async with db.session() as s:
        s.add_all(Run(id=f"r{i}", status="done", brief=BRIEF, client_ip="127.0.0.1") for i in range(5))
        s.add(Run(id="ex", status="done", brief=BRIEF, client_ip="127.0.0.1", is_example=True, llm_cost_usd=99))
        await s.commit()
    assert (await api.post("/runs", json=BRIEF)).status_code == 201  # no per-IP limit; example spend doesn't count

    async with db.session() as s:
        s.add(Run(id="big", status="done", brief=BRIEF, client_ip="10.0.0.9", llm_cost_usd=99))
        await s.commit()
    r = await api.post("/runs", json=BRIEF)
    assert r.status_code == 503 and r.json()["error"]["code"] == "examples_only"


async def test_search_limit_and_validation(api):
    assert (await api.get("/qloo/search", params={"q": "x"})).json()["error"]["code"] == "invalid_request"
    main._search_hits["127.0.0.1"] = [time.monotonic()] * main.SEARCH_PER_MIN
    assert (await api.get("/qloo/search", params={"q": "Olipop"})).status_code == 429


async def test_startup_fails_runs_left_running(db):
    async with db.session() as s:
        s.add(Run(id="r", status="running", brief=BRIEF))
        await s.commit()
    await main.recover(db)
    async with db.session() as s:
        run = await s.get(Run, "r")
    assert run.status == "failed" and run.warnings == ["server restarted"]


async def test_presets(api):
    out = (await api.get("/presets")).json()
    assert {"id": "genz_urban_fitness", "label": "Gen Z urban fitness"} in out["presets"]
    assert out["sample_briefs"] == EXAMPLE_BRIEFS


async def test_examples_lists_done_example_runs(api, db):
    async with db.session() as s:
        s.add(Run(id="ex", status="done", brief=BRIEF, is_example=True,
                  report={"verdict": {"sentence": "Launch to X."}, "grounding": {"rate": 0.9}}))
        s.add(Run(id="not", status="done", brief=BRIEF))
        await s.commit()
    out = (await api.get("/examples")).json()
    assert [e["run_id"] for e in out["examples"]] == ["ex"] and out["examples"][0]["grounding_rate"] == 0.9
