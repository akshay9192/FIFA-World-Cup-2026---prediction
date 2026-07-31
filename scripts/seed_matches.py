from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

def main() -> None:
    from backend.app.database import create_db_and_tables, session_scope
    from backend.app.seed import seed_replay_data

    create_db_and_tables()
    with session_scope() as db:
        result = seed_replay_data(db)
    print(f"Replay seed ready: {result}")

if __name__ == "__main__":
    main()
