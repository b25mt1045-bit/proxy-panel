"""The only module that talks to an LLM provider."""

import json
from collections import Counter
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ValidationError

from app.config import settings

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "llm"
_mock_calls: Counter[str] = Counter()


class LLMError(Exception):
    pass


class ToolCall(BaseModel):
    id: str = ""
    name: str
    args: dict = {}


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
    # Wired up once day-1 probe 4 picks a provider: call it with settings.LLM_SMALL / LLM_BIG, a 30 s timeout,
    # one retry on 5xx/timeout, and add the call's cost to run_ctx["llm_cost_usd"].
    raise LLMError("No LLM provider is wired up yet (day-1 probe 4). Set LLM_MOCK=1.")


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
