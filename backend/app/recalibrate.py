from __future__ import annotations

from copy import deepcopy
from threading import RLock
from typing import Any

from sqlalchemy.orm import Session

from .database import Match, RecalibrationLog, Team
from .ml_model import WorldCupPredictor
from .predictions import predictor

class RecalibrationService:
    def __init__(self) -> None:
        self.predictor: WorldCupPredictor = predictor
        self._accuracy_cache: dict[str, Any] | None = None
        self._cache_lock = RLock()

    def invalidate_cache(self) -> None:
        with self._cache_lock:
            self._accuracy_cache = None

    def run(self, db: Session) -> dict[str, Any]:
        completed = (
            db.query(Match)
            .filter(
                Match.external_id.like("wc26-%"),
                Match.actual_winner.isnot(None),
            )
            .all()
        )
        before = self.calculate_accuracy(db)["accuracy_percentage"]
        if len(completed) < 3:
            log = RecalibrationLog(matches_used=len(completed), model_accuracy_before=before, model_accuracy_after=before, notes="not enough data to recalibrate")
            db.add(log)
            db.flush()
            return {"status": "not enough data to recalibrate", "matches_used": len(completed), "accuracy_before": before, "accuracy_after": before}
        predicted_goals = 0.0
        actual_goals = 0
        usable = 0
        team_names = {
            name for match in completed for name in (match.team_a, match.team_b)
        }
        teams = db.query(Team).filter(Team.name.in_(team_names)).all()
        team_by_name = {team.name: team for team in teams}
        for match in completed:
            team_a = team_by_name.get(match.team_a)
            team_b = team_by_name.get(match.team_b)
            if not team_a or not team_b:
                continue
            prediction = self.predictor.predict_match(team_a, team_b, {"stage": match.stage})
            predicted_goals += prediction["predicted_score_a"] + prediction["predicted_score_b"]
            actual_goals += (match.actual_score_a or 0) + (match.actual_score_b or 0)
            usable += 1
        if usable and predicted_goals:
            observed_scale = actual_goals / predicted_goals
            self.predictor.goal_scale = min(max(observed_scale, 0.75), 1.25)
        after = before
        db.add(RecalibrationLog(
            matches_used=usable,
            model_accuracy_before=before,
            model_accuracy_after=after,
            notes=f"Poisson goal-rate scale set to {self.predictor.goal_scale:.3f}; winner accuracy is not claimed to improve in-sample",
        ))
        db.flush()
        return {"status": "recalibrated", "matches_used": usable, "accuracy_before": before, "accuracy_after": after}

    def calculate_accuracy(self, db: Session) -> dict[str, Any]:
        if self._accuracy_cache is not None:
            return deepcopy(self._accuracy_cache)
        matches = db.query(Match).filter(
            Match.external_id.like("wc26-%"),
            Match.actual_winner.isnot(None),
            Match.predicted_winner.isnot(None),
        ).order_by(Match.match_date.asc()).all()
        return self._calculate_accuracy(matches)

    def calculate_accuracy_from_predictions(
        self, predictions: list[dict[str, Any]]
    ) -> dict[str, Any]:
        if self._accuracy_cache is not None:
            return deepcopy(self._accuracy_cache)
        return self._calculate_accuracy(predictions)

    def _calculate_accuracy(self, rows: list[Any]) -> dict[str, Any]:
        def value(row: Any, field: str) -> Any:
            return row[field] if isinstance(row, dict) else getattr(row, field)

        total = len(rows)
        correct = sum(
            1
            for row in rows
            if value(row, "predicted_winner") == value(row, "actual_winner")
        )
        group = [row for row in rows if value(row, "stage") == "group"]
        knock = [row for row in rows if value(row, "stage") != "group"]

        def pct(items: list[Any]) -> float:
            matching = sum(
                1
                for row in items
                if value(row, "predicted_winner") == value(row, "actual_winner")
            )
            return round(matching / len(items) * 100, 2) if items else 0.0

        history = []
        running_correct = 0
        for idx, row in enumerate(rows, start=1):
            running_correct += int(
                value(row, "predicted_winner") == value(row, "actual_winner")
            )
            match_date = value(row, "match_date")
            history.append(
                {
                    "date": (
                        match_date.isoformat()
                        if hasattr(match_date, "isoformat")
                        else str(match_date)
                    ),
                    "accuracy": round(running_correct / idx * 100, 2),
                    "stage": value(row, "stage"),
                }
            )
        result = {
            "total_predictions": total,
            "correct": correct,
            "accuracy_percentage": round(correct / total * 100, 2) if total else 0.0,
            "model_accuracy": round(correct / total * 100, 2) if total else 0.0,
            "user_accuracy": None,
            "group_stage_accuracy": pct(group),
            "knockout_accuracy": pct(knock),
            "history": history,
        }
        with self._cache_lock:
            self._accuracy_cache = result
        return deepcopy(result)
