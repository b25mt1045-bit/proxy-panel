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
def _reset_llm_mock():
    llm._mock_calls.clear()
