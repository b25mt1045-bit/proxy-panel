import pytest

from app import llm
from app.db import Db


@pytest.fixture
async def db(tmp_path):
    d = Db(f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    await d.create_all()
    yield d
    await d.engine.dispose()


@pytest.fixture(autouse=True)
def _reset_llm_mock(monkeypatch):
    # Tests never hit live services, whatever a local backend/.env says.
    monkeypatch.setattr(llm.settings, "LLM_MOCK", True)
    monkeypatch.setattr(llm.settings, "QLOO_MOCK", True)
    llm._mock_calls.clear()
