from app.db import db_url


def test_neon_url_as_pasted_works_with_asyncpg():
    u = db_url("postgresql://u:p@ep-x.neon.tech/neondb?sslmode=require&channel_binding=require")
    assert u.drivername == "postgresql+asyncpg"
    assert dict(u.query) == {"ssl": "require"}


def test_sqlite_url_unchanged():
    assert str(db_url("sqlite+aiosqlite:///./proxy.db")) == "sqlite+aiosqlite:///./proxy.db"
