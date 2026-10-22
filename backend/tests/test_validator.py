import json

import pytest

from app import llm, panel
from app.models import Brief
from app.personas import BuiltPersona, ReceiptIn
from app.presets import EXAMPLE_BRIEFS
from app.validator import check_static, stance_error

LABELS = {"R1", "R2", "C1"}
PRICES = [2.99, 2.49, 3.49]
FILLER = " ".join(["word"] * 45)


def check(text, band=(1.0, 2.0), own=frozenset({3.29})):
    return [e.split(":")[0] for e in check_static(text, LABELS, band, PRICES, set(own))]


def test_rules():
    assert check(f"I like it [R1] and [C1]. {FILLER}") == []
    assert check(f"No citation here. {FILLER}") == ["no_receipt"]
    assert check(f"Mine [R1] but not [R9]. {FILLER}") == ["foreign_receipt"]
    assert check(f"I'd pay $12 for it [R1]. {FILLER}") == ["price_out_of_band"]  # $12 is tier 4, band 1-2
    assert check(f"At $3.29 [R1] it's pricey. {FILLER}") == []  # the product's own price is allowed
    assert check(f"I'd pay $2 [R1]. {FILLER}") == []  # tier 1, inside the band
    assert check("Too short [R1].") == ["length"]
    assert check(f"At three dollars and twenty-nine cents [R1]. {FILLER}") == ["price_in_words"]
    assert check(f"Maybe twenty-five bucks [R1]. {FILLER}") == ["price_in_words"]
    assert check(f"A few bucks more, two dollar-store brands [R1]. {FILLER}") == []  # no amount given


def test_stance_rule():
    assert stance_error("enthusiast", "negative") and stance_error("skeptic", "positive")
    assert not stance_error("conditional", "negative") and not stance_error("enthusiast", "mixed")


@pytest.fixture
def fixtures(tmp_path, monkeypatch):
    monkeypatch.setattr(llm, "FIXTURES", tmp_path)

    def write(name, data):
        (tmp_path / f"{name}.json").write_text(json.dumps(data))
    return write


def persona(pid, label="enthusiast"):
    return BuiltPersona(id=pid, segment=0, segment_label="s", age=None, name=f"P{pid}", bio="b", top={},
                        receipts=[ReceiptIn(label=x, qloo_id=x, entity_name=x, entity_type="brand", lift=0.1)
                                  for x in sorted(LABELS)],
                        comparable_lifts={}, stance_score=0.1, stance_label=label, price_lo=1, price_hi=4,
                        price_weak=False)


CTX = panel.Context(brief=Brief.model_validate(EXAMPLE_BRIEFS[1]), tier=2, comparable_prices=PRICES)


async def test_retry_once_then_flag(fixtures):
    good, bad = {"text": f"Good [R1]. {FILLER}"}, {"text": f"Bad, no ids. {FILLER}"}
    fixtures("panelist_r1", [good, bad, bad])  # persona 2 fails twice
    fixtures("sentiment", {"results": [{"id": 0, "sentiment": "positive"}, {"id": 1, "sentiment": "mixed"}]})
    seen = []

    async def on_final(f):
        seen.append(f)

    finals = await panel.run_round("panelist_r1", 1, [persona(1), persona(2)], ["u", "u"], CTX, on_final)
    assert llm._mock_calls["panelist_r1"] == 3  # 2 first tries + exactly 1 retry
    assert [f.persona.id for f in seen] == [1, 2]  # the passing line is emitted first
    assert finals[0].errors == [] and finals[1].errors[0].startswith("no_receipt")


async def test_retry_can_pass(fixtures):
    fixtures("panelist_r1", [{"text": f"Bad. {FILLER}"}, {"text": f"Fixed [C1]. {FILLER}"}])
    fixtures("sentiment", {"results": []})  # skipped statements count as mixed

    async def on_final(f):
        pass

    [f] = await panel.run_round("panelist_r1", 1, [persona(1, "skeptic")], ["u"], CTX, on_final)
    assert f.errors == [] and "[C1]" in f.said.text and f.said.preferred_variant is None  # 1 variant


def test_pick_pair_prefers_shared_receipt_type():
    a, b, c = persona(1), persona(2), persona(3)
    a.stance_score, b.stance_score, c.stance_score = 0.9, 0.5, -0.9
    c.receipts = [r.model_copy(update={"entity_type": "podcast"}) for r in c.receipts]
    x, y = panel.pick_pair([a, b, c])
    assert {x.id, y.id} == {1, 2}  # widest gap is a-c, but they share no receipt type
