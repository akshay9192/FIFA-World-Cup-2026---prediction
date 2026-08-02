"""Export deterministic replay data bundled with the GitHub Pages frontend."""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

from fastapi.encoders import jsonable_encoder

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main() -> None:
    # Windows antivirus/indexers can briefly retain a SQLite handle after the
    # engine is disposed; the deterministic output is already safely written.
    with tempfile.TemporaryDirectory(
        prefix="world-cup-fallback-", ignore_cleanup_errors=True
    ) as temp_dir:
        database_path = Path(temp_dir) / "fallback.sqlite3"
        os.environ["DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"

        from backend.app.database import SessionLocal, create_db_and_tables, engine
        from backend.app.main import (
            health,
            metadata,
            prediction_service,
            recalibration_service,
            teams,
        )
        from backend.app.seed import seed_replay_data

        create_db_and_tables()
        with SessionLocal() as db:
            seed_replay_data(db)
            predictions = prediction_service.get_all_predictions(db, force=True)
            db.commit()
            recalibration_service.invalidate_cache()
            accuracy = recalibration_service.calculate_accuracy_from_predictions(
                predictions
            )

        payload = jsonable_encoder(
            {
                "health": health(db),
                "meta": metadata(),
                "predictions": predictions,
                "accuracy": accuracy,
                "teams": teams(db),
            }
        )
        destination = (
            ROOT / "frontend" / "src" / "fallback" / "replay-data.json"
        )
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        print(f"Wrote {destination} ({destination.stat().st_size} bytes)")
        engine.dispose()


if __name__ == "__main__":
    main()
