import asyncio
import json

import httpx
import pytest
import respx
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


@pytest.fixture
def gemini(monkeypatch):
    for k, v in {"LLM_MOCK": False, "LLM_API_KEY": "k", "LLM_SMALL": "small-m", "LLM_BIG": "big-m"}.items():
        monkeypatch.setattr(llm.settings, k, v)
    with respx.mock(assert_all_called=False) as router:
        yield router


def reply(*parts):
    return httpx.Response(200, json={"candidates": [{"content": {"role": "model", "parts": list(parts)}}]})


async def test_gemini_structured_output(gemini):
    route = gemini.post(f"{llm.GEMINI_URL}/small-m:generateContent").mock(
        side_effect=[reply({"text": '{"n": "bad"}'}), reply({"text": '{"n": 3}'})])
    assert (await llm.complete("p", "small", "sys", "u", schema=Out)).n == 3
    first = json.loads(route.calls[0].request.content)
    assert route.calls[0].request.headers["x-goog-api-key"] == "k"
    assert first["systemInstruction"]["parts"][0]["text"] == "sys"
    assert first["generationConfig"]["responseJsonSchema"]["properties"]["n"]["type"] == "integer"
    assert "Reply with valid JSON only" in json.loads(route.calls[1].request.content)["contents"][0]["parts"][0]["text"]


async def test_gemini_tool_turns_round_trip(gemini):
    route = gemini.post(f"{llm.GEMINI_URL}/big-m:generateContent").mock(return_value=reply(
        {"functionCall": {"id": "c1", "name": "qloo_search", "args": {"query": "x"}}, "thoughtSignature": "sig"}))
    res = await llm.complete("repair", "big", "s", [{"role": "user", "content": "go"}], tools=[{"name": "qloo_search"}])
    assert res.tool_calls[0].thought_signature == "sig"
    msgs = [{"role": "user", "content": "go"},
            {"role": "assistant", "content": "", "tool_calls": [c.model_dump() for c in res.tool_calls]},
            {"role": "tool", "tool_call_id": "c1", "content": "[]"}]
    await llm.complete("repair", "big", "s", msgs, tools=[{"name": "qloo_search"}])
    contents = json.loads(route.calls[1].request.content)["contents"]
    assert contents[1] == {"role": "model", "parts": [
        {"functionCall": {"name": "qloo_search", "args": {"query": "x"}, "id": "c1"}, "thoughtSignature": "sig"}]}
    assert contents[2]["parts"][0]["functionResponse"] == {"name": "qloo_search", "id": "c1", "response": {"result": "[]"}}


async def test_gemini_retries_rate_limit_once(gemini, monkeypatch):
    slept = []
    real_sleep = asyncio.sleep
    monkeypatch.setattr(llm.asyncio, "sleep", lambda s: slept.append(s) or real_sleep(0))
    limited = httpx.Response(429, json={"error": {"details": [{"retryDelay": "7s"}]}})
    gemini.post(f"{llm.GEMINI_URL}/small-m:generateContent").mock(side_effect=[limited, reply({"text": "hi"})])
    assert await llm.complete("p", "small", "s", "u") == "hi"
    assert slept == [7]
    gemini.post(f"{llm.GEMINI_URL}/small-m:generateContent").mock(side_effect=[limited, limited])
    with pytest.raises(llm.LLMError, match="Gemini 429"):
        await llm.complete("p", "small", "s", "u")


async def test_gemini_needs_key(gemini, monkeypatch):
    monkeypatch.setattr(llm.settings, "LLM_API_KEY", "")
    with pytest.raises(llm.LLMError, match="Set LLM_API_KEY"):
        await llm.complete("p", "small", "s", "u")
