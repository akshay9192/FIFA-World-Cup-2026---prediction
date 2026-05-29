from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, create_model

from .feature_fields import TEAM_FEATURE_FIELDS

_feature_annotations = {name: (Optional[float], None) for name in TEAM_FEATURE_FIELDS}

class _Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

TeamBase = create_model(
    "TeamBase",
    __base__=_Schema,
    name=(str, ...),
    group_name=(Optional[str], None),
    confederation=(Optional[str], None),
    emoji_flag=(Optional[str], None),
    **_feature_annotations,
)

TeamCreate = create_model("TeamCreate", __base__=TeamBase)
TeamResponse = create_model("TeamResponse", __base__=TeamBase, id=(int, ...))

class MatchBase(_Schema):
    team_a: str
    team_b: str
    match_date: datetime
    venue: Optional[str] = None
    stage: str = "group"
    group_name: Optional[str] = None

class MatchCreate(MatchBase):
    pass

class MatchResponse(MatchBase):
    id: int
    predicted_score_a: Optional[float] = None
    predicted_score_b: Optional[float] = None
    predicted_winner: Optional[str] = None
    win_prob_a: Optional[float] = None
    draw_prob: Optional[float] = None
    win_prob_b: Optional[float] = None
    confidence_score: Optional[float] = None
    actual_score_a: Optional[int] = None
    actual_score_b: Optional[int] = None
    actual_winner: Optional[str] = None
    result_source: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class ManualResultRequest(BaseModel):
    match_id: int
    score_a: int = Field(ge=0)
    score_b: int = Field(ge=0)

class PredictionResponse(_Schema):
    match_id: int
    team_a: str
    team_b: str
    match_date: datetime
    venue: Optional[str] = None
    stage: str
    group_name: Optional[str] = None
    predicted_score_a: float
    predicted_score_b: float
    predicted_winner: str
    win_prob_a: float
    draw_prob: float
    win_prob_b: float
    confidence_score: float
    most_likely_scoreline: str
    feature_contributions: dict[str, float] = Field(default_factory=dict)
    biased_prediction: Optional[dict[str, Any]] = None

class AccuracyResponse(BaseModel):
    total_predictions: int
    correct: int
    accuracy_percentage: float
    user_accuracy: Optional[float] = None
    model_accuracy: Optional[float] = None
    group_stage_accuracy: Optional[float] = None
    knockout_accuracy: Optional[float] = None
    history: list[dict[str, Any]] = Field(default_factory=list)

class BiasRequest(BaseModel):
    match_id: int
    user_prediction: str
    user_confidence: float = Field(ge=0, le=10)
    emotional_investment: float = Field(ge=0, le=10)

class BiasResponse(BaseModel):
    match_id: int
    model_prediction: str
    user_prediction: str
    delta: float

class SimulationResponse(BaseModel):
    team: str
    win_probability: float
    finalist_probability: float
    semifinalist_probability: float
    group_exit_probability: float

class RecalibrationResponse(BaseModel):
    status: str
    matches_used: int
    accuracy_before: float
    accuracy_after: float
