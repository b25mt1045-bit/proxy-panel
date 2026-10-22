import asyncio

from app.db import Run
from app.events import emit, stream


async def make_run(db, status="running"):
    async with db.session() as s:
        s.add(Run(id="r1", status=status, brief={}))
        await s.commit()


async def test_replay_after_last_seq_then_tail(db):
    await make_run(db)
    for i in range(7):
        await emit(db, "r1", "progress", {"i": i})
    got = []

    async def read():
        async for ev in stream(db, "r1", last_seq=5, ping_s=1):
            got.append(ev)

    task = asyncio.create_task(read())
    await asyncio.sleep(0.05)
    await emit(db, "r1", "done", {})
    await asyncio.wait_for(task, 2)
    assert [e["seq"] for e in got] == [6, 7, 8] and got[-1]["type"] == "done"


async def test_finished_run_replays_and_stops(db):
    await make_run(db)
    await emit(db, "r1", "progress", {})
    await emit(db, "r1", "done", {})
    got = [ev async for ev in stream(db, "r1", ping_s=0.01)]
    assert [e["type"] for e in got] == ["progress", "done"]


async def test_parallel_emits_get_unique_seqs(db):
    await make_run(db)
    evs = await asyncio.gather(*[emit(db, "r1", "statement", {"n": i}) for i in range(10)])
    assert sorted(e["seq"] for e in evs) == list(range(1, 11))
