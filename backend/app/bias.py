from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .database import BiasLog, Match
from .models import BiasRequest

class BiasService:
    def log_bias(self, db: Session, bias_request: BiasRequest) -> dict[str, Any]:
        match = db.query(Match).filter(Match.id == bias_request.match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        model_prediction = match.predicted_winner or "Draw"
        delta = abs((bias_request.user_confidence or 0) / 10.0 - (match.confidence_score or 0))
        record = BiasLog(
            match_id=match.id,
            user_prediction=bias_request.user_prediction,
            model_prediction=model_prediction,
            user_confidence=bias_request.user_confidence,
            emotional_investment=bias_request.emotional_investment,
        )
        db.add(record)
        db.flush()
        db.refresh(record)
        return {"match_id": match.id, "model_prediction": model_prediction, "user_prediction": bias_request.user_prediction, "delta": round(delta, 4)}

    def get_bias_summary(self, db: Session) -> dict[str, Any]:
        self.update_bias_outcomes(db)
        logs = db.query(BiasLog).order_by(BiasLog.created_at.desc()).all()
        user_correct = sum(1 for row in logs if row.user_correct is True)
        model_correct = sum(1 for row in logs if row.model_correct is True)
        decided = [row for row in logs if row.user_correct is not None and row.model_correct is not None]
        leader = "tied"
        if user_correct > model_correct:
            leader = "you"
        elif model_correct > user_correct:
            leader = "model"
        return {
            "total_bias_predictions": len(logs),
            "completed_comparisons": len(decided),
            "user_correct": user_correct,
            "model_correct": model_correct,
            "leader": leader,
            "margin": abs(user_correct - model_correct),
            "logs": [
                {"match_id": r.match_id, "user_prediction": r.user_prediction, "model_prediction": r.model_prediction, "actual_result": r.actual_result, "user_correct": r.user_correct, "model_correct": r.model_correct, "created_at": r.created_at.isoformat()} for r in logs
            ],
        }

    def update_bias_outcomes(self, db: Session) -> None:
        logs = db.query(BiasLog).all()
        for row in logs:
            match = db.query(Match).filter(Match.id == row.match_id).first()
            if match and match.actual_winner:
                row.actual_result = match.actual_winner
                row.user_correct = row.user_prediction == match.actual_winner
                row.model_correct = row.model_prediction == match.actual_winner
        db.flush()
