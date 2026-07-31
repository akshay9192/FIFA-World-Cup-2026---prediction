from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .database import Match, RecalibrationLog, Team
from .ml_model import WorldCupPredictor
from .predictions import predictor

class RecalibrationService:
    def __init__(self) -> None:
        self.predictor: WorldCupPredictor = predictor

    def run(self, db: Session) -> dict[str, Any]:
        completed = db.query(Match).filter(Match.actual_winner.isnot(None)).all()
        before = self.calculate_accuracy(db)["accuracy_percentage"]
        if len(completed) < 3:
            log = RecalibrationLog(matches_used=len(completed), model_accuracy_before=before, model_accuracy_after=before, notes="not enough data to recalibrate")
            db.add(log)
            db.flush()
            return {"status": "not enough data to recalibrate", "matches_used": len(completed), "accuracy_before": before, "accuracy_after": before}
        predicted_goals = 0.0
        actual_goals = 0
        usable = 0
        for match in completed:
            team_a = db.query(Team).filter(Team.name == match.team_a).first()
            team_b = db.query(Team).filter(Team.name == match.team_b).first()
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
        matches = db.query(Match).filter(Match.actual_winner.isnot(None), Match.predicted_winner.isnot(None)).order_by(Match.match_date.asc()).all()
        total = len(matches)
        correct = sum(1 for m in matches if m.predicted_winner == m.actual_winner)
        group = [m for m in matches if m.stage == "group"]
        knock = [m for m in matches if m.stage != "group"]
        def pct(items: list[Match]) -> float:
            return round(sum(1 for m in items if m.predicted_winner == m.actual_winner) / len(items) * 100, 2) if items else 0.0
        history = []
        running_correct = 0
        for idx, match in enumerate(matches, start=1):
            running_correct += int(match.predicted_winner == match.actual_winner)
            history.append({"date": match.match_date.isoformat(), "accuracy": round(running_correct / idx * 100, 2), "stage": match.stage})
        return {
            "total_predictions": total,
            "correct": correct,
            "accuracy_percentage": round(correct / total * 100, 2) if total else 0.0,
            "model_accuracy": round(correct / total * 100, 2) if total else 0.0,
            "user_accuracy": None,
            "group_stage_accuracy": pct(group),
            "knockout_accuracy": pct(knock),
            "history": history,
        }
