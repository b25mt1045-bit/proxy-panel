"""Tool-calling repair agent. Runs only when the fixed pipeline can't resolve enough entities (design G6)."""

import json

from app import llm
from app.prompts import REPAIR_SYSTEM, REPAIR_USER
from app.qloo import Entity, Qloo

MAX_TURNS = 3
TOOLS = [
    {"name": "qloo_search", "description": "Check whether a name exists in Qloo. Returns matches.",
     "parameters": {"type": "object", "properties": {
         "query": {"type": "string"},
         "type": {"type": "string", "enum": ["brand", "artist", "podcast", "tv_show", "movie"]}},
         "required": ["query", "type"]}},
    {"name": "submit_names", "description": "Submit the final list of resolved Qloo ids.",
     "parameters": {"type": "object", "properties": {"qloo_ids": {"type": "array", "items": {"type": "string"}}},
                    "required": ["qloo_ids"]}},
]


async def repair(qloo: Qloo, goal: str, have: list[str], failed: list[str]) -> list[Entity]:
    """Returns entities the LLM picked, limited to ids a search actually returned, or [] if it gives up."""
    msgs = [{"role": "user", "content": REPAIR_USER.format(goal=goal, have=have, failed=failed)}]
    seen: dict[str, Entity] = {}
    for _ in range(MAX_TURNS):
        res = await llm.complete("repair", "big", REPAIR_SYSTEM, msgs, tools=TOOLS, temperature=0.3)
        if not res.tool_calls:
            break
        msgs.append({"role": "assistant", "content": res.text, "tool_calls": [c.model_dump() for c in res.tool_calls]})
        for call in res.tool_calls:
            if call.name == "submit_names":
                return [seen[i] for i in dict.fromkeys(call.args.get("qloo_ids", [])) if i in seen]
            if call.name == "qloo_search":
                hits = await qloo.search(call.args["query"], f"urn:entity:{call.args.get('type', 'brand')}", take=3)
                seen |= {h.qloo_id: h for h in hits}
                msgs.append({"role": "tool", "tool_call_id": call.id,
                             "content": json.dumps([h.model_dump(include={"qloo_id", "name", "type"}) for h in hits])})
    return []
