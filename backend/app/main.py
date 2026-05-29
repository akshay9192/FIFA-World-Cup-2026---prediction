from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .bias import BiasService
from .data_sync import FootballDataSync
from .database import Match, Team, create_db_and_tables, database_is_connected, get_db
from .feature_fields import TEAM_FEATURE_FIELDS, default_for_feature
from .models import AccuracyResponse, BiasRequest, BiasResponse, ManualResultRequest, PredictionResponse, RecalibrationResponse, SimulationResponse
from .predictions import PredictionService, predictor
from .recalibrate import RecalibrationService

app = FastAPI(title="FIFA World Cup 2026 Predictor", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

prediction_service = PredictionService()
recalibration_service = RecalibrationService()
bias_service = BiasService()

@app.on_event("startup")
def startup() -> None:
    create_db_and_tables()
    from .database import SessionLocal
    with SessionLocal() as db:
        if db.query(Team).count() == 0:
            seed_teams(db)
            db.commit()


def seed_teams(db: Session) -> None:
    path = Path(__file__).resolve().parents[2] / "data" / "teams.json"
    if not path.exists():
        return
    for item in json.loads(path.read_text(encoding="utf-8")):
        team = Team(name=item["name"], group_name=item.get("group"), confederation=item.get("confederation"), emoji_flag=item.get("emoji_flag"))
        for field in TEAM_FEATURE_FIELDS:
            setattr(team, field, default_for_feature(field))
        team.fifa_ranking = float(item.get("fifa_ranking", 50))
        team.fifa_ranking_12m_ago = min(team.fifa_ranking + 5, 150)
        team.squad_value = max(30_000_000.0, 600_000_000.0 / max(team.fifa_ranking, 1))
        team.win_rate_last10 = max(0.25, min(0.8, (80 - team.fifa_ranking) / 100))
        team.loss_rate_last10 = max(0.1, min(0.6, team.fifa_ranking / 180))
        team.draw_rate_last10 = max(0.1, 1 - team.win_rate_last10 - team.loss_rate_last10)
        db.add(team)

@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "database_connected": database_is_connected()}

@app.get("/predictions", response_model=list[PredictionResponse])
def get_predictions(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    try:
        predictions = prediction_service.get_all_predictions(db)
        db.commit()
        return sorted(predictions, key=lambda row: row["match_date"])
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@app.get("/predictions/{match_id}", response_model=PredictionResponse)
def get_prediction(match_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        result = prediction_service.get_match_prediction(db, match_id)
        db.commit()
        return result
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@app.post("/results/manual")
def post_manual_result(request: ManualResultRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    match = db.query(Match).filter(Match.id == request.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    match.actual_score_a = request.score_a
    match.actual_score_b = request.score_b
    match.actual_winner = match.team_a if request.score_a > request.score_b else match.team_b if request.score_b > request.score_a else "Draw"
    match.result_source = "manual"
    should_recalibrate = prediction_service.update_after_result(db, match.id)
    payload: dict[str, Any] = {"status": "updated", "match_id": match.id, "actual_winner": match.actual_winner, "recalibration_triggered": False}
    if should_recalibrate:
        payload["recalibration"] = recalibration_service.run(db)
        payload["recalibration_triggered"] = True
    db.commit()
    return payload

@app.post("/results/sync")
def sync_results() -> dict[str, Any]:
    try:
        count = FootballDataSync().sync_latest_results()
        return {"status": "ok", "matches_updated": count}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

@app.post("/recalibrate", response_model=RecalibrationResponse)
def recalibrate(db: Session = Depends(get_db)) -> dict[str, Any]:
    return recalibration_service.run(db)

@app.get("/accuracy", response_model=AccuracyResponse)
def accuracy(db: Session = Depends(get_db)) -> dict[str, Any]:
    return recalibration_service.calculate_accuracy(db)

@app.get("/tournament/simulate", response_model=list[SimulationResponse])
def simulate(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    teams = db.query(Team).all()
    matches = db.query(Match).all()
    sim = predictor.simulate_tournament(teams, matches, 10000)
    return sorted([{"team": team, **values} for team, values in sim.items()], key=lambda row: row["win_probability"], reverse=True)

@app.get("/bias")
def get_bias(db: Session = Depends(get_db)) -> dict[str, Any]:
    return bias_service.get_bias_summary(db)

@app.post("/bias", response_model=BiasResponse)
def post_bias(request: BiasRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    match = db.query(Match).filter(Match.id == request.match_id).first()
    if match and not match.predicted_winner:
        prediction_service.get_match_prediction(db, request.match_id)
    return bias_service.log_bias(db, request)
