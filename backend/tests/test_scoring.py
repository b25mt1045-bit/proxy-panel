from pytest import approx

from app.scoring import concept_tier, label_stances, lift, price_band, price_fit, scaled, stance

# Worked example from Technical Design §6.
WEIGHTS = {"olipop": 1.0, "poppi": 0.5, "culture_pop": 0.5}


def test_stance_worked_example():
    a = stance({"olipop": 0.10, "poppi": 0.04, "culture_pop": -0.02}, WEIGHTS)
    b = stance({"olipop": -0.03, "poppi": 0.01, "culture_pop": 0.0}, WEIGHTS)
    assert a == approx(0.055)
    assert b == approx(-0.0125)
    assert label_stances([a, b]) == ["enthusiast", "skeptic"]


def test_lift():
    persona, baseline = {"x": 0.936, "y": 0.58}, {"x": 0.619}
    assert lift(persona, baseline, "x") == approx(0.317)
    assert lift(persona, baseline, "y") == 0.0  # no baseline data: no evidence
    assert lift(persona, baseline, "z") == 0.0


def test_labels():
    assert label_stances([-0.01, -0.02]) == ["skeptic", "skeptic"]
    six = label_stances([0.6, 0.1, 0.5, -0.2, 0.3, 0.0])
    assert six == ["enthusiast", "conditional", "enthusiast", "skeptic", "conditional", "skeptic"]
    assert label_stances([0.1] * 6) == ["conditional"] * 6


def test_scaled():
    assert scaled([0.0, 0.5, 1.0]) == [0.0, 0.5, 1.0]
    assert scaled([0.2, 0.2]) == [0.5, 0.5]


def test_price():
    assert concept_tier(3.29, [2.99, 2.49, 3.49]) == 3  # 3.29 / median 2.99 = 1.10
    soda = [2.49, 2.49, 2.49, 1.99]  # the live ZESTRA run: $3.00 is 1.2× the median, so premium, not luxury
    assert [concept_tier(p, soda) for p in (1.50, 2.49, 3.00, 3.49)] == [1, 2, 3, 4]
    band = price_band([(3, 0.12), (4, 0.06), (2, -0.01)])
    assert band == (approx(2.862, abs=1e-3), approx(3.805, abs=1e-3), False)
    assert price_fit(3, band)
    assert price_band([(2, -0.1)]) == (1.0, 4.0, True)
