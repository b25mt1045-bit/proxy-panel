"""Abuse guards for the endpoints that start LLM work (design §11)."""

from datetime import datetime, time

from fastapi import Request
from sqlalchemy import func, select

from app.config import settings
from app.db import Db, Run, utcnow


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


def client_ip(req: Request) -> str:
    xff = req.headers.get("x-forwarded-for")
    return xff.split(",")[0].strip() if xff and settings.TRUST_PROXY else (req.client.host if req.client else "")


async def check(db: Db, req: Request):
    today = datetime.combine(utcnow().date(), time.min, tzinfo=utcnow().tzinfo)
    real = (Run.created_at >= today) & Run.is_example.is_(False)  # example runs never count
    async with db.session() as s:
        spent = await s.scalar(select(func.coalesce(func.sum(Run.llm_cost_usd), 0)).where(real))
        runs = await s.scalar(select(func.count()).select_from(Run).where(real, Run.client_ip == client_ip(req)))
    if spent >= settings.DAILY_LLM_CAP_USD:
        raise ApiError(503, "examples_only", "Daily demo budget reached; try the examples.")
    if runs >= settings.RUNS_PER_IP_PER_DAY:
        raise ApiError(429, "rate_limited", f"{settings.RUNS_PER_IP_PER_DAY} runs per day; try the examples.")
