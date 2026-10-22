import pytest

from app.config import settings
from app.personas import pick_receipts, split
from app.qloo import Entity
from app.segments import SegmentSignals


def ent(n, t="urn:entity:brand"):
    return Entity(qloo_id=n, name=n, type=t, rank=0)


def sig(i, n_seeds, age="25_to_29"):
    return SegmentSignals(index=i, label=f"seg{i}", seeds=[ent(f"s{i}-{k}") for k in range(n_seeds)],
                          age=age, gender=None, dropped=[])


@pytest.mark.parametrize("n_segments", [1, 2, 3])
@pytest.mark.parametrize("n_seeds", [2, 4])
def test_split_gives_6_distinct_personas(n_segments, n_seeds):
    specs = split([sig(i, n_seeds) for i in range(n_segments)])
    assert len(specs) == 6
    keys = {(s.segment, tuple(e.qloo_id for e in s.seeds), s.age) for s in specs}
    assert len(keys) == 6


def test_split_without_demographics_still_differs_by_seeds(monkeypatch):
    monkeypatch.setattr(settings, "DEMOGRAPHICS_ENABLED", False)
    specs = split([sig(0, 4)])
    assert all(s.age is None for s in specs)
    assert len({tuple(e.qloo_id for e in s.seeds) for s in specs}) == 6


def test_age_stays_in_range():
    specs = split([sig(0, 4, age="24_and_younger")])
    assert specs[0].age == "24_and_younger" and specs[2].age == "24_and_younger"  # offset -1 clamps


def test_receipts_keep_a_brand_and_a_non_brand():
    brands = [(ent(f"b{k}"), "brand", 0.5 - k / 100) for k in range(6)]
    media = [(ent("m1", "urn:entity:podcast"), "podcast", 0.1)]
    picked = pick_receipts(brands + media)
    assert len(picked) == 5 and {t for _, t, _ in picked} == {"brand", "podcast"}
    assert [li for _, _, li in picked] == sorted([li for _, _, li in picked], reverse=True)

    only_media = [(ent(f"m{k}", "urn:entity:artist"), "artist", 0.4) for k in range(6)]
    picked = pick_receipts(only_media + [(ent("b"), "brand", -0.2)])
    assert "brand" in {t for _, t, _ in picked}


def test_receipts_dedupe_by_id():
    e = ent("x")
    assert len(pick_receipts([(e, "brand", 0.3), (e, "brand", 0.2)])) == 1
