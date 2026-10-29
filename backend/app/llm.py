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
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
_mock_calls: Counter[str] = Counter()


class LLMError(Exception):
    pass


class ToolCall(BaseModel):
    id: str = ""
    name: str
    args: dict = {}
    thought_signature: str = ""  # opaque, from the thought step before the call; echoed back by _steps


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
    """Gemini Interactions API over REST, stateless (store=false). Free tier, so no cost goes into run_ctx["llm_cost_usd"]."""
    model_id = settings.LLM_SMALL if model == "small" else settings.LLM_BIG
    if not settings.LLM_API_KEY or not model_id:
        raise LLMError("Set LLM_API_KEY, LLM_SMALL and LLM_BIG in backend/.env, or set LLM_MOCK=1.")
    body: dict = {"model": model_id, "store": False, "system_instruction": system, "input": _steps(user),
                  "generation_config": {"temperature": temperature}}
    if tools:
        body["tools"] = [{"type": "function"} | t for t in tools]
    elif schema:
        body["response_format"] = schema.model_json_schema()
    data = await _post(GEMINI_URL, body)
    steps = data.get("steps") or []
    text = "".join(c.get("text", "") for s in steps if s.get("type") == "model_output" for c in s.get("content", []))
    if not tools:
        if not text:
            raise LLMError(f"Gemini returned no output (status {data.get('status')})")
        return text
    calls, sig = [], ""
    for s in steps:
        if s.get("type") == "thought":
            sig = s.get("signature", "")
        elif s.get("type") == "function_call":
            calls.append({"id": s.get("id", ""), "name": s["name"], "args": s.get("arguments", {}), "thought_signature": sig})
    return {"text": text, "tool_calls": calls}


async def _post(url: str, body: dict) -> dict:
    """120 s timeout (thinking models are slow); one retry on a network error (timeout, DNS, reset), 5xx or 429 (waits the delay Gemini asks for)."""
    async with httpx.AsyncClient(timeout=120) as client:
        for attempt in (1, 2):
            try:
                r = await client.post(url, json=body, headers={"x-goog-api-key": settings.LLM_API_KEY})
            except httpx.TransportError as e:
                if attempt == 2:
                    raise LLMError(f"Gemini unreachable twice: {e!r}") from e
                await asyncio.sleep(1)
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


def _steps(user: str | list[dict]) -> str | list[dict]:
    """Our message list ({"role": user|assistant|tool, ...}, see orchestrator.py) → Interactions input steps.
    Tool results answer the previous assistant message's calls in order."""
    if isinstance(user, str):
        return user
    out: list[dict] = []
    calls: list[dict] = []
    for m in user:
        if m["role"] == "assistant":
            calls = list(m.get("tool_calls", []))
            # Gemini 3 needs the thought signature before the calls sent back unchanged on the next turn.
            sig = next((c["thought_signature"] for c in calls if c.get("thought_signature")), "")
            out += [{"type": "thought", "signature": sig}] if sig else []
            out += [{"type": "model_output", "content": [{"type": "text", "text": m["content"]}]}] if m.get("content") else []
            out += [{"type": "function_call", "id": c["id"], "name": c["name"], "arguments": c.get("args", {})} for c in calls]
        elif m["role"] == "tool":
            c = calls.pop(0)
            out.append({"type": "function_result", "call_id": c["id"], "name": c["name"], "result": m["content"]})
        else:
            out.append({"type": "user_input", "content": [{"type": "text", "text": m["content"]}]})
    return out


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
