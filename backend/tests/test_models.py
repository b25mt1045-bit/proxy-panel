import pytest
from pydantic import ValidationError

from app.models import Brief
from app.presets import EXAMPLE_BRIEFS

GOOD = EXAMPLE_BRIEFS[0]


def brief(**over):
    return Brief.model_validate({**GOOD, **over})


def test_examples_are_valid():
    for b in EXAMPLE_BRIEFS:
        Brief.model_validate(b)


@pytest.mark.parametrize("over", [
    {"description": "too short!"},
    {"segments": [{"preset_id": "genz_urban_fitness", "text": "also text"}]},
    {"segments": [{}]},
    {"segments": [{"preset_id": "nope"}]},
    {"variants": [{"key": "A", "name": "a"}, {"key": "B", "name": "b"}, {"key": "B", "name": "c"}]},
    {"variants": [{"key": "B", "name": "b"}]},
    {"price": 0},
])
def test_invalid_briefs(over):
    with pytest.raises(ValidationError):
        brief(**over)
