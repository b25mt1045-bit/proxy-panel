"""Run events: stored on runs.events for replay, and pushed to in-process queues for live SSE (design §7).
shortcut: in-process queues need a single backend replica; move to Postgres LISTEN/NOTIFY to scale out."""

import asyncio
from collections import defaultdict
from collections.abc import AsyncIterator

from app.db import Db, Run

END = ("done", "error")
_queues: dict[str, set[asyncio.Queue]] = defaultdict(set)
_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


async def emit(db: Db, run_id: str, type: str, data: dict) -> dict:
    # The lock stops parallel statements racing for the same seq.
    async with _locks[run_id], db.session() as s:
        run = await s.get(Run, run_id)
        ev = {"seq": len(run.events) + 1, "type": type, "data": data}
        run.events = [*run.events, ev]  # a new list, so SQLAlchemy sees the change
        await s.commit()
    for q in _queues[run_id]:
        q.put_nowait(ev)
    return ev


async def stream(db: Db, run_id: str, last_seq: int = 0, ping_s: float = 15) -> AsyncIterator[dict | None]:
    """Replays stored events after last_seq, then tails live ones until done/error. Yields None as a keep-alive."""
    q: asyncio.Queue = asyncio.Queue()
    _queues[run_id].add(q)  # subscribe before replaying, so nothing emitted in between is lost
    try:
        async with db.session() as s:
            run = await s.get(Run, run_id)
        for ev in run.events:
            if ev["seq"] > last_seq:
                last_seq = ev["seq"]
                yield ev
        if run.status in ("done", "failed") or (run.events and run.events[-1]["type"] in END):
            return
        while True:
            try:
                ev = await asyncio.wait_for(q.get(), ping_s)
            except TimeoutError:
                yield None
                continue
            if ev["seq"] > last_seq:
                last_seq = ev["seq"]
                yield ev
            if ev["type"] in END:
                return
    finally:
        _queues[run_id].discard(q)
