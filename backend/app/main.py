from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager
from functools import lru_cache
from threading import RLock
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .bias import BiasService
from .data_sync import FootballDataSync
from .database import Match, Team, create_db_and_tables, database_is_connected, get_db
from .models import (
    AccuracyResponse,
    BiasRequest,
    BiasResponse,
    ManualResultRequest,
    PredictionResponse,
    RecalibrationResponse,
    SimulationResponse,
    TeamResponse,
)
from .predictions import PredictionService, predictor
from .recalibrate import RecalibrationService
from .seed import dataset_metadata, load_dataset, seed_replay_data

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db_and_tables()
    from .database import SessionLocal

    with SessionLocal() as db:
        seed_replay_data(db)
    invalidate_replay_caches(include_simulation=True)
    yield


app = FastAPI(
    title="World Cup 2026 Replay API",
    description="Independent fan-project API for replaying model predictions against historical results.",
    version="2.0.0",
    lifespan=lifespan,
)


def configured_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS", "http://localhost:3001,http://127.0.0.1:3001"
    )
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

prediction_service = PredictionService()
recalibration_service = RecalibrationService()
bias_service = BiasService()
_teams_cache: list[dict[str, Any]] | None = None
_teams_cache_lock = RLock()
_simulation_cache: dict[int, tuple[float, list[dict[str, Any]]]] = {}
_simulation_cache_lock = RLock()


def invalidate_replay_caches(*, include_simulation: bool = False) -> None:
    prediction_service.invalidate_cache()
    recalibration_service.invalidate_cache()
    if include_simulation:
        with _simulation_cache_lock:
            _simulation_cache.clear()


@app.get("/health")
def health(db: Session = Depends(get_db)) -> dict[str, Any]:
    connected = database_is_connected()
    replay_team_names = [item["name"] for item in load_dataset()["teams"]]
    return {
        "status": "ok" if connected else "degraded",
        "service": "world-cup-2026-replay-api",
        "version": app.version,
        "database": {
            "connected": connected,
            "teams": db.query(Team).filter(Team.name.in_(replay_team_names)).count() if connected else None,
            "matches": db.query(Match).filter(Match.external_id.like("wc26-%")).count() if connected else None,
        },
        "mode": "external-sync-enabled" if os.getenv("FOOTBALL_DATA_API_KEY") else "offline-ready",
    }


@app.get("/meta")
@lru_cache(maxsize=1)
def metadata() -> dict[str, Any]:
    return {
        **dataset_metadata(),
        "product_positioning": "Replay the 2026 World Cup, compare the model with actual outcomes, and explore alternative predictions.",
        "disclaimer": "Independent experimental fan project. Not affiliated with or endorsed by FIFA.",
        "model": {
            "name": "Heuristic Poisson replay model",
            "method": "Experimental team-strength and form inputs estimate goal rates; a Poisson score matrix produces three-way probabilities.",
            "limitations": "Seed strength values are estimates, many contextual fields use neutral defaults, probabilities are not calibrated betting advice, and replay evaluation is not a prospective trial.",
        },
    }


@app.get("/teams", response_model=list[TeamResponse])
def teams(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    global _teams_cache
    if _teams_cache is not None:
        return _teams_cache
    with _teams_cache_lock:
        if _teams_cache is None:
            replay_team_names = [item["name"] for item in load_dataset()["teams"]]
            rows = (
                db.query(Team)
                .filter(Team.name.in_(replay_team_names))
                .order_by(Team.group_name, Team.name)
                .all()
            )
            _teams_cache = [
                TeamResponse.model_validate(team).model_dump() for team in rows
            ]
    return _teams_cache


@app.get("/predictions", response_model=list[PredictionResponse])
def get_predictions(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    try:
        predictions = prediction_service.get_all_predictions(db)
        db.commit()
        return sorted(predictions, key=lambda row: row["match_date"])
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("Unable to generate predictions")
        raise HTTPException(status_code=500, detail="Unable to generate predictions") from None


@app.get("/predictions/{match_id}", response_model=PredictionResponse)
def get_prediction(match_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        result = prediction_service.get_match_prediction(db, match_id)
        db.commit()
        return result
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("Unable to generate match prediction")
        raise HTTPException(status_code=500, detail="Unable to generate match prediction") from None


@app.post("/results/manual")
def post_manual_result(request: ManualResultRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        match = db.query(Match).filter(Match.id == request.match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        match.actual_score_a = request.score_a
        match.actual_score_b = request.score_b
        match.actual_winner = match.team_a if request.score_a > request.score_b else match.team_b if request.score_b > request.score_a else "Draw"
        match.result_source = "user-entered what-if result"
        match.result_note = None
        should_recalibrate = prediction_service.update_after_result(db, match.id)
        payload: dict[str, Any] = {
            "status": "updated",
            "match_id": match.id,
            "actual_winner": match.actual_winner,
            "recalibration_triggered": False,
        }
        if should_recalibrate:
            recalibration_service.invalidate_cache()
            payload["recalibration"] = recalibration_service.run(db)
            payload["recalibration_triggered"] = True
        db.commit()
        invalidate_replay_caches(include_simulation=should_recalibrate)
        return payload
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Unable to store manual result")
        raise HTTPException(status_code=500, detail="Unable to store result") from None


@app.post("/results/sync")
def sync_results() -> dict[str, Any]:
    try:
        count = FootballDataSync().sync_latest_results()
        return {"status": "ok", "matches_updated": count}
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None


@app.post("/recalibrate", response_model=RecalibrationResponse)
def recalibrate(db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        prediction_service.get_all_predictions(db)
        result = recalibration_service.run(db)
        prediction_service.get_all_predictions(db, force=True)
        db.commit()
        invalidate_replay_caches(include_simulation=True)
        return result
    except Exception:
        db.rollback()
        logger.exception("Unable to recalibrate model")
        raise HTTPException(status_code=500, detail="Unable to recalibrate model") from None


@app.get("/accuracy", response_model=AccuracyResponse)
def accuracy(db: Session = Depends(get_db)) -> dict[str, Any]:
    predictions = prediction_service.get_all_predictions(db)
    db.commit()
    return recalibration_service.calculate_accuracy_from_predictions(predictions)


@app.get("/tournament/simulate", response_model=list[SimulationResponse])
def simulate(
    iterations: int = Query(default=1000, ge=100, le=5000),
    refresh: bool = False,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    now = time.monotonic()
    cached = _simulation_cache.get(iterations)
    if not refresh and cached and cached[0] > now:
        return cached[1]
    with _simulation_cache_lock:
        cached = _simulation_cache.get(iterations)
        if not refresh and cached and cached[0] > time.monotonic():
            return cached[1]
        replay_team_names = [item["name"] for item in load_dataset()["teams"]]
        all_teams = db.query(Team).filter(Team.name.in_(replay_team_names)).all()
        matches = db.query(Match).filter(Match.external_id.like("wc26-%")).all()
        simulation = predictor.simulate_tournament(all_teams, matches, iterations)
        result = sorted(
            [{"team": team, **values} for team, values in simulation.items()],
            key=lambda row: row["win_probability"],
            reverse=True,
        )
        _simulation_cache[iterations] = (time.monotonic() + 900, result)
        return result


@app.get("/bias")
def get_bias(db: Session = Depends(get_db)) -> dict[str, Any]:
    return bias_service.get_bias_summary(db)


@app.post("/bias", response_model=BiasResponse)
def post_bias(request: BiasRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    match = db.query(Match).filter(Match.id == request.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if request.user_prediction not in {match.team_a, match.team_b, "Draw"}:
        raise HTTPException(status_code=422, detail="user_prediction must be one of the two team names or Draw")
    if not match.predicted_winner:
        prediction_service.get_match_prediction(db, request.match_id)
    try:
        result = bias_service.log_bias(db, request)
        db.commit()
        return result
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Unable to store user prediction")
        raise HTTPException(status_code=500, detail="Unable to store user prediction") from None
