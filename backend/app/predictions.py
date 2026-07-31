from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .database import BiasLog, Match, Team
from .feature_fields import TEAM_FEATURE_FIELDS
from .ml_model import WorldCupPredictor

predictor = WorldCupPredictor()

class PredictionService:
    def __init__(self) -> None:
        self.predictor = predictor

    def get_all_predictions(self, db: Session) -> list[dict[str, Any]]:
        matches = (
            db.query(Match)
            .filter(Match.actual_winner.isnot(None))
            .order_by(Match.match_date.asc())
            .all()
        )
        return [self._prediction_for_match(db, match) for match in matches]

    def get_match_prediction(self, db: Session, match_id: int) -> dict[str, Any]:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        pred = self._prediction_for_match(db, match)
        bias = db.query(BiasLog).filter(BiasLog.match_id == match.id).order_by(BiasLog.created_at.desc()).first()
        if bias:
            gut = self._gut_from_prediction(match, bias.user_prediction)
            pred["biased_prediction"] = self.predictor.apply_bias(pred, bias.user_confidence or 0, gut, bias.emotional_investment or 0)
        return pred

    def update_after_result(self, db: Session, match_id: int) -> bool:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        from .bias import BiasService
        BiasService().update_bias_outcomes(db)
        last = db.query(Match).filter(Match.actual_winner.isnot(None), Match.result_source.isnot(None)).count()
        return last >= 5 and last % 5 == 0

    def _prediction_for_match(self, db: Session, match: Match) -> dict[str, Any]:
        team_a = db.query(Team).filter(Team.name == match.team_a).first()
        team_b = db.query(Team).filter(Team.name == match.team_b).first()
        if not team_a or not team_b:
            raise HTTPException(status_code=422, detail=f"Missing team data for {match.team_a} vs {match.team_b}")
        prediction = self.predictor.predict_match(team_a, team_b, {"stage": match.stage})
        match.predicted_score_a = prediction["predicted_score_a"]
        match.predicted_score_b = prediction["predicted_score_b"]
        match.predicted_winner = prediction["predicted_winner"]
        match.win_prob_a = prediction["win_prob_a"]
        match.draw_prob = prediction["draw_prob"]
        match.win_prob_b = prediction["win_prob_b"]
        match.confidence_score = prediction["confidence_score"]
        contributions = self._contributions(team_a, team_b)
        return {
            "match_id": match.id,
            "team_a": match.team_a,
            "team_b": match.team_b,
            "match_date": match.match_date,
            "venue": match.venue,
            "stage": match.stage,
            "group_name": match.group_name,
            "actual_score_a": match.actual_score_a,
            "actual_score_b": match.actual_score_b,
            "actual_winner": match.actual_winner,
            "result_source": match.result_source,
            "result_note": match.result_note,
            **prediction,
            "feature_contributions": contributions,
            "biased_prediction": None,
        }

    def _contributions(self, a: Team, b: Team) -> dict[str, float]:
        importances = self.predictor.get_feature_importance()
        values = {}
        for name in TEAM_FEATURE_FIELDS:
            av = getattr(a, name, None) or 0
            bv = getattr(b, name, None) or 0
            values[name] = round((float(av) - float(bv)) * importances.get(name, 0), 5)
        return values

    def _gut_from_prediction(self, match: Match, user_prediction: str) -> str:
        if user_prediction == match.team_a or user_prediction.upper() in {"A", "HOME"}:
            return "A"
        if user_prediction == match.team_b or user_prediction.upper() in {"B", "AWAY"}:
            return "B"
        return "Draw"
