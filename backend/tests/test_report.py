from collections import Counter
from types import SimpleNamespace as NS

from app.models import Variant
from app.report import ObjectionsOut, clean_objections, confidence, sensitivity, verdict

W = {"c1": 1.0, "c2": 1.0}
VARS = [Variant(key="A", name="Calm Fizz"), Variant(key="B", name="Focus Fizz")]
TIERS = {"A": 2, "B": 3}
NAMES = {"c1": "Olipop", "c2": "Poppi"}
LABELS = {0: "Gen Z", 1: "remote tech"}


def p(seg, c1, c2, band=(1.0, 4.0)):
    return NS(segment=seg, comparable_lifts={"c1": c1, "c2": c2}, price_lo=band[0], price_hi=band[1],
              price_weak=False)


def test_verdict_picks_the_segment_with_the_highest_mean_stance():
    ps = [p(0, .02, .01), p(0, .01, .01), p(1, .1, .1), p(1, .05, .1)]
    assert verdict(ps, W, VARS, TIERS, Counter()) == (1, "A")


def test_equal_segment_means_are_broken_by_price_fit():
    ps = [p(0, .1, .1, band=(3, 4)), p(1, .1, .1, band=(1, 2.5))]  # variant A is tier 2: only segment 1 fits
    assert verdict(ps, W, VARS, TIERS, Counter())[0] == 1


def test_variant_uses_its_weights_then_panel_preference():
    ps = [p(0, .0, .2), p(0, .0, .1)]
    vb = [VARS[0], VARS[1].model_copy(update={"comparable_weights": {"c2": 1.0}})]
    assert verdict(ps, W, vb, TIERS, Counter()) == (0, "B")  # B weighs only c2, where the lift is
    assert verdict(ps, W, VARS, TIERS, Counter({(0, "B"): 2})) == (0, "B")  # equal stance: preference decides


def test_confidence():
    assert confidence({0: .5, 1: .48}, [.5, .5]) == "weak"
    assert confidence({0: .8, 1: .5}, [.7, .9]) == "strong"
    assert confidence({0: .8, 1: .5}, [.4, .9]) == "mixed"  # big gap, but the winners disagree
    assert confidence({0: .8, 1: .7}, [.7, .9]) == "mixed"  # agree, but the gap is small
    assert confidence({0: .6}, [.5, .6]) == "strong"
    assert confidence({0: .6}, [.1, .9]) == "mixed"


def test_sensitivity_finds_a_flip_when_one_comparable_carries_the_lift():
    ps = [p(0, .3, 0), p(0, .3, 0), p(1, 0, .1), p(1, 0, .1)]
    out = sensitivity(ps, W, VARS, TIERS, Counter(), NAMES, LABELS)
    assert out == {"robust": False, "change": "Setting Olipop's weight to 0 makes remote tech with variant A the top pick."}
    ps = [p(0, .3, .3), p(1, 0, .1)]
    assert sensitivity(ps, W, VARS, TIERS, Counter(), NAMES, LABELS)["robust"] is True


def test_objections_drop_hallucinated_statement_ids():
    pool = [NS(id=1, persona_id=10, receipt_labels=["R1", "C1"]), NS(id=2, persona_id=11, receipt_labels=["R2"])]
    receipts = [NS(persona_id=10, label="R1", entity_name="Oura Ring", lift=.0812),
                NS(persona_id=11, label="R2", entity_name="OWYN", lift=.05)]
    res = ObjectionsOut.model_validate({"objections": [{"text": "Too sweet", "statement_ids": [1, 99, 1]},
                                                       {"text": "Made up", "statement_ids": [42]}]})
    assert clean_objections(res, pool, receipts) == [
        {"text": "Too sweet", "persona_ids": [10], "statement_ids": [1],
         "receipts": [{"persona_id": 10, "label": "R1", "entity_name": "Oura Ring", "lift": 0.081}]}]
