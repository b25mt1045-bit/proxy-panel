import pytest

from app import llm, orchestrator, segments
from app.comparables import propose
from app.config import settings
from app.models import Brief, Segment
from app.presets import EXAMPLE_BRIEFS
from app.qloo import Qloo
from app.segments import SegmentFailed, SegmentSignals, baseline, build_segment_signals, segment_media
from tests.test_comparables import FakeQloo


async def test_preset_needs_no_llm(monkeypatch):
    async def no_llm(*a, **k):
        raise AssertionError("LLM called for a preset")

    monkeypatch.setattr(llm, "complete", no_llm)
    sig = await build_segment_signals(FakeQloo(["Gymshark", "Alo Yoga", "Celsius"]), Segment(preset_id="genz_urban_fitness"), 0)
    assert [s.name for s in sig.seeds] == ["Gymshark", "Alo Yoga", "Celsius"]
    assert sig.dropped == ["Huberman Lab"] and sig.age == "24_and_younger"


async def test_free_text_with_one_seed_calls_repair_then_fails(monkeypatch):
    calls = []

    async def repair(*a, **k):
        calls.append(k["goal"])
        return []

    monkeypatch.setattr(orchestrator, "repair", repair)
    with pytest.raises(SegmentFailed):
        await build_segment_signals(FakeQloo(["Allbirds"]), Segment(text="remote tech workers in their 30s"), 1)
    assert len(calls) == 1 and "<segment>remote tech workers" in calls[0]


async def test_demographics_disabled_sends_none(monkeypatch):
    sent = []

    class Q:
        async def insights(self, t, ids, take=5, demographics=None, **k):
            sent.append(demographics)
            return []

    sig = SegmentSignals(index=0, label="x", seeds=[], age="25_to_29", gender="female", dropped=[])
    await segment_media(Q(), sig)
    monkeypatch.setattr(settings, "DEMOGRAPHICS_ENABLED", False)
    await segment_media(Q(), sig)
    assert sent[:3] == [{"age": "25_to_29", "gender": "female"}] * 3 and sent[3:] == [{}] * 3


@pytest.mark.parametrize("raw", EXAMPLE_BRIEFS, ids=["beverage", "personal_care", "app"])
async def test_examples_run_fully_in_mock_mode(db, raw):
    """Mock Qloo + mock LLM, recorded fixtures only: fails if a fixture is missing or stale."""
    q = Qloo(db, "", "http://unused", mock=True)
    brief = Brief.model_validate(raw)
    comps, _ = await propose(q, brief)
    assert len(comps) >= 3
    base = await baseline(q, "urn:entity:brand", [c.qloo_id for c in comps])
    # Qloo can lack data for an obscure brand (Finch in the app example); lift() then treats it as 0.
    assert set(base) <= {c.qloo_id for c in comps} and len(base) >= 3 and all(0 < v < 1 for v in base.values())
    for i, seg in enumerate(brief.segments):
        sig = await build_segment_signals(q, seg, i)
        media = await segment_media(q, sig)
        for t in segments.MEDIA_TYPES:
            assert media[t], f"no {t} for {sig.label}"
            await baseline(q, t, [e.qloo_id for e in media[t]])
