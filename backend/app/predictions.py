from __future__ import annotations

from copy import deepcopy
from threading import RLock
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
        self._cache: list[dict[str, Any]] | None = None
        self._cache_lock = RLock()

    def get_all_predictions(
        self, db: Session, *, force: bool = False
    ) -> list[dict[str, Any]]:
        if self._cache is not None and not force:
            return deepcopy(self._cache)
        with self._cache_lock:
            if self._cache is not None and not force:
                return deepcopy(self._cache)
            matches = (
                db.query(Match)
                .filter(
                    Match.external_id.like("wc26-%"),
                    Match.actual_winner.isnot(None),
                )
                .order_by(Match.match_date.asc())
                .all()
            )
            team_names = {
                name for match in matches for name in (match.team_a, match.team_b)
            }
            teams = db.query(Team).filter(Team.name.in_(team_names)).all()
            team_by_name = {team.name: team for team in teams}
            predictions = [
                self._prediction_for_match(match, team_by_name) for match in matches
            ]
            self._cache = predictions
            return deepcopy(predictions)

    def ensure_predictions(self, db: Session) -> None:
        if self._cache is not None:
            return
        missing = (
            db.query(Match.id)
            .filter(
                Match.external_id.like("wc26-%"),
                Match.actual_winner.isnot(None),
                Match.predicted_winner.is_(None),
            )
            .first()
        )
        if missing:
            self.get_all_predictions(db)

    def invalidate_cache(self) -> None:
        with self._cache_lock:
            self._cache = None

    def get_match_prediction(self, db: Session, match_id: int) -> dict[str, Any]:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        cached = next(
            (
                item
                for item in self.get_all_predictions(db)
                if item["match_id"] == match_id
            ),
            None,
        )
        if cached is None:
            teams = (
                db.query(Team)
                .filter(Team.name.in_({match.team_a, match.team_b}))
                .all()
            )
            cached = self._prediction_for_match(
                match, {team.name: team for team in teams}
            )
        pred = cached
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

    def _prediction_for_match(
        self, match: Match, team_by_name: dict[str, Team]
    ) -> dict[str, Any]:
        team_a = team_by_name.get(match.team_a)
        team_b = team_by_name.get(match.team_b)
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
