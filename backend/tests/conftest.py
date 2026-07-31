from __future__ import annotations

import os
import tempfile
from pathlib import Path

TEST_DATABASE = Path(tempfile.gettempdir()) / "world_cup_replay_test.sqlite3"
if TEST_DATABASE.exists():
    TEST_DATABASE.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE.as_posix()}"
os.environ["CORS_ORIGINS"] = "http://localhost:3001"
os.environ.pop("FOOTBALL_DATA_API_KEY", None)


def pytest_sessionfinish(session, exitstatus) -> None:
    from backend.app.database import engine

    engine.dispose()
    if TEST_DATABASE.exists():
        TEST_DATABASE.unlink()
