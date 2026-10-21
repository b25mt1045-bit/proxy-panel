from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

Json = JSON().with_variant(JSONB(), "postgresql")


def utcnow():
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Run(Base):
    __tablename__ = "runs"
    __table_args__ = (
        CheckConstraint("status IN ('confirming','running','done','failed')"),
        CheckConstraint("mode IN ('grounded','ungrounded')"),
    )
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    status: Mapped[str] = mapped_column(Text)
    mode: Mapped[str] = mapped_column(Text, default="grounded")
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"))
    brief: Mapped[dict] = mapped_column(Json)
    is_example: Mapped[bool] = mapped_column(Boolean, default=False)
    client_ip: Mapped[str | None] = mapped_column(Text, index=True)
    llm_cost_usd: Mapped[float] = mapped_column(Float, default=0)
    qloo_calls: Mapped[int] = mapped_column(Integer, default=0)
    qloo_cache_hits: Mapped[int] = mapped_column(Integer, default=0)
    events: Mapped[list] = mapped_column(Json, default=list)
    warnings: Mapped[list] = mapped_column(Json, default=list)
    report: Mapped[dict | None] = mapped_column(Json)


class Comparable(Base):
    __tablename__ = "comparables"
    __table_args__ = (UniqueConstraint("run_id", "qloo_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"))
    qloo_id: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    weight: Mapped[float] = mapped_column(Float)
    price: Mapped[float] = mapped_column(Float)
    price_tier: Mapped[int | None] = mapped_column(Integer)


class Persona(Base):
    __tablename__ = "personas"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"))
    segment: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(Text)
    bio: Mapped[str] = mapped_column(Text)
    fingerprint: Mapped[list] = mapped_column(Json)
    comparable_lifts: Mapped[dict | None] = mapped_column(Json)
    stance_score: Mapped[float | None] = mapped_column(Float)
    stance_scaled: Mapped[float | None] = mapped_column(Float)
    stance_label: Mapped[str] = mapped_column(Text)
    price_lo: Mapped[float | None] = mapped_column(Float)
    price_hi: Mapped[float | None] = mapped_column(Float)
    price_weak: Mapped[bool] = mapped_column(Boolean, default=False)


class Receipt(Base):
    __tablename__ = "receipts"
    __table_args__ = (UniqueConstraint("persona_id", "label"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("personas.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(Text)
    qloo_id: Mapped[str] = mapped_column(Text)
    entity_name: Mapped[str] = mapped_column(Text)
    entity_type: Mapped[str] = mapped_column(Text)
    lift: Mapped[float] = mapped_column(Float)


class Statement(Base):
    __tablename__ = "statements"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"))
    persona_id: Mapped[int] = mapped_column(ForeignKey("personas.id"))
    round: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    receipt_labels: Mapped[list] = mapped_column(Json, default=list)
    preferred_variant: Mapped[str | None] = mapped_column(Text)
    passed: Mapped[bool] = mapped_column(Boolean)
    flags: Mapped[list] = mapped_column(Json, default=list)


class QlooCache(Base):
    __tablename__ = "qloo_cache"
    key: Mapped[str] = mapped_column(Text, primary_key=True)
    path: Mapped[str] = mapped_column(Text)
    params: Mapped[dict] = mapped_column(Json)
    response: Mapped[dict] = mapped_column(Json)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Db:
    def __init__(self, url: str):
        # Use a SQLite file, not :memory: — an in-memory DB shares one connection, and concurrent writes then clobber each other.
        self.engine = create_async_engine(url)
        self.session = async_sessionmaker(self.engine, expire_on_commit=False)

    async def create_all(self):
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def cache_get(self, key: str) -> dict | None:
        async with self.session() as s:
            row = await s.get(QlooCache, key)
            return row.response if row else None

    async def cache_put(self, key: str, path: str, params: dict, response: dict):
        async with self.session() as s:
            await s.merge(QlooCache(key=key, path=path, params=params, response=response, fetched_at=utcnow()))
            await s.commit()
