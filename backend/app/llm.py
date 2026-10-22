"""The only module that talks to an LLM provider."""

import asyncio
import json
from collections import Counter
from pathlib import Path
from typing import Literal

import httpx
from pydantic import BaseModel, ValidationError

from app.config import settings

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "llm"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models"
_mock_calls: Counter[str] = Counter()


class LLMError(Exception):
    pass


class ToolCall(BaseModel):
    id: str = ""
    name: str
    args: dict = {}
    thought_signature: str = ""  # opaque, from Gemini; echoed back by _call_part


class ToolCallResult(BaseModel):
    text: str = ""
    tool_calls: list[ToolCall] = []


async def complete(prompt_name: str, model: Literal["small", "big"], system: str, user: str | list[dict],
                   schema: type[BaseModel] | None = None, tools: list[dict] | None = None,
                   temperature: float = 0.7) -> BaseModel | str | ToolCallResult:
    """`user` is a prompt string, or a message list ({"role", "content", ...}) for multi-turn tool use."""
    for attempt in (1, 2):
        if settings.LLM_MOCK:
            raw = _mock(prompt_name, user)
        else:
            raw = await _provider(model, system, user, schema, tools, temperature)
        if tools:
            return ToolCallResult.model_validate(raw)
        if schema is None:
            return raw
        try:
            return schema.model_validate_json(raw) if isinstance(raw, str) else schema.model_validate(raw)
        except ValidationError as e:
            # A mock that no longer fits its schema must fail loudly, not retry.
            if settings.LLM_MOCK or attempt == 2:
                raise LLMError(f"{prompt_name}: reply does not match {schema.__name__}: {e}") from e
            note = f"Your last reply was invalid ({e.errors()[0]['msg']}). Reply with valid JSON only."
            user = f"{user}\n\n{note}" if isinstance(user, str) else [*user, {"role": "user", "content": note}]


async def _provider(model, system, user, schema, tools, temperature):
    """Gemini generateContent over REST. Free tier, so no cost goes into run_ctx["llm_cost_usd"]."""
    model_id = settings.LLM_SMALL if model == "small" else settings.LLM_BIG
    if not settings.LLM_API_KEY or not model_id:
        raise LLMError("Set LLM_API_KEY, LLM_SMALL and LLM_BIG in backend/.env, or set LLM_MOCK=1.")
    body: dict = {"systemInstruction": {"parts": [{"text": system}]}, "contents": _contents(user),
                  "generationConfig": {"temperature": temperature}}
    if tools:
        body["tools"] = [{"functionDeclarations": tools}]
    elif schema:
        body["generationConfig"] |= {"responseMimeType": "application/json",
                                     "responseJsonSchema": schema.model_json_schema()}
    data = await _post(f"{GEMINI_URL}/{model_id}:generateContent", body)
    if not data.get("candidates"):
        raise LLMError(f"Gemini returned no candidates: {data.get('promptFeedback')}")
    parts = data["candidates"][0].get("content", {}).get("parts", [])
    text = "".join(p["text"] for p in parts if "text" in p and not p.get("thought"))
    if not tools:
        return text
    calls = [{"id": p["functionCall"].get("id", ""), "name": p["functionCall"]["name"],
              "args": p["functionCall"].get("args", {}), "thought_signature": p.get("thoughtSignature", "")}
             for p in parts if "functionCall" in p]
    return {"text": text, "tool_calls": calls}


async def _post(url: str, body: dict) -> dict:
    """30 s timeout; one retry on timeout, 5xx or 429 (free-tier rate limit, waits the delay Gemini asks for)."""
    async with httpx.AsyncClient(timeout=30) as client:
        for attempt in (1, 2):
            try:
                r = await client.post(url, json=body, headers={"x-goog-api-key": settings.LLM_API_KEY})
            except httpx.TimeoutException as e:
                if attempt == 2:
                    raise LLMError("Gemini timed out twice") from e
                continue
            if (r.status_code == 429 or r.status_code >= 500) and attempt == 1:
                await asyncio.sleep(_retry_delay(r) if r.status_code == 429 else 1)
                continue
            if r.status_code != 200:
                raise LLMError(f"Gemini {r.status_code}: {r.text[:300]}")
            return r.json()


def _retry_delay(r: httpx.Response) -> float:
    try:
        details = r.json()["error"]["details"]
        delay = next(d["retryDelay"] for d in details if "retryDelay" in d)  # e.g. "12s"
        return min(float(delay.rstrip("s")), 30)
    except (ValueError, KeyError, StopIteration):
        return 10


def _contents(user: str | list[dict]) -> list[dict]:
    """Our message list ({"role": user|assistant|tool, ...}, see orchestrator.py) → Gemini contents.
    Tool results answer the previous assistant message's calls in order."""
    if isinstance(user, str):
        return [{"role": "user", "parts": [{"text": user}]}]
    out: list[dict] = []
    calls: list[dict] = []

    def add(role, parts):
        if out and out[-1]["role"] == role:
            out[-1]["parts"] += parts
        else:
            out.append({"role": role, "parts": parts})

    for m in user:
        if m["role"] == "assistant":
            calls = list(m.get("tool_calls", []))
            add("model", ([{"text": m["content"]}] if m.get("content") else []) + [_call_part(c) for c in calls])
        elif m["role"] == "tool":
            c = calls.pop(0)
            resp = {"name": c["name"], "response": {"result": m["content"]}} | ({"id": c["id"]} if c.get("id") else {})
            add("user", [{"functionResponse": resp}])
        else:
            add("user", [{"text": m["content"]}])
    return out


def _call_part(c: dict) -> dict:
    # Gemini 3 needs each call's thoughtSignature sent back unchanged on the next turn.
    call = {"name": c["name"], "args": c.get("args", {})} | ({"id": c["id"]} if c.get("id") else {})
    return {"functionCall": call} | ({"thoughtSignature": c["thought_signature"]} if c.get("thought_signature") else {})


def _mock(name: str, user: str | list[dict]):
    """fixtures/llm/<name>.json holds one reply, a list of replies (rotated per call), or
    {"cases": [{"if_contains": str, "response": ...}], "default": ...} matched against the prompt."""
    f = FIXTURES / f"{name}.json"
    if not f.exists():
        raise LLMError(f"no LLM fixture {f}")
    data = json.loads(f.read_text(encoding="utf-8"))
    if isinstance(data, list):
        i = _mock_calls[name]
        _mock_calls[name] += 1
        return data[i % len(data)]
    if isinstance(data, dict) and "cases" in data:
        text = user if isinstance(user, str) else json.dumps(user, ensure_ascii=False)
        for case in data["cases"]:
            if case["if_contains"] in text:
                return case["response"]
        if "default" in data:
            return data["default"]
        raise LLMError(f"{f.name}: no case matches the prompt")
    return data
