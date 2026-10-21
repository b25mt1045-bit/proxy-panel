import json

import pytest
from pydantic import BaseModel

from app import llm


class Out(BaseModel):
    n: int


def write(tmp_path, name, data):
    (tmp_path / f"{name}.json").write_text(json.dumps(data))


@pytest.fixture
def fixtures(tmp_path, monkeypatch):
    monkeypatch.setattr(llm, "FIXTURES", tmp_path)
    return tmp_path


async def test_cases_match_prompt_text(fixtures):
    write(fixtures, "p", {"cases": [{"if_contains": "soda", "response": {"n": 1}}], "default": {"n": 0}})
    assert (await llm.complete("p", "small", "sys", "a soda brief", schema=Out)).n == 1
    assert (await llm.complete("p", "small", "sys", "an app brief", schema=Out)).n == 0


async def test_list_rotates(fixtures):
    write(fixtures, "p", [{"n": 1}, {"n": 2}])
    got = [(await llm.complete("p", "small", "s", "u", schema=Out)).n for _ in range(3)]
    assert got == [1, 2, 1]


async def test_mock_that_breaks_schema_fails_loudly(fixtures):
    write(fixtures, "p", {"n": "not a number"})
    with pytest.raises(llm.LLMError, match="does not match Out"):
        await llm.complete("p", "small", "s", "u", schema=Out)
    with pytest.raises(llm.LLMError, match="no LLM fixture"):
        await llm.complete("missing", "small", "s", "u", schema=Out)


async def test_real_provider_not_wired_yet(monkeypatch):
    monkeypatch.setattr(llm.settings, "LLM_MOCK", False)
    with pytest.raises(llm.LLMError, match="No LLM provider"):
        await llm.complete("p", "small", "s", "u")
