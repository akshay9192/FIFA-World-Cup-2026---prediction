from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, create_engine, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .feature_fields import TEAM_FEATURE_FIELDS

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fifa_predictor.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    group_name = Column(String, nullable=True, index=True)
    confederation = Column(String, nullable=True)
    emoji_flag = Column(String, nullable=True)


for field in TEAM_FEATURE_FIELDS:
    setattr(Team, field, Column(Float, nullable=True))


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    team_a = Column(String, ForeignKey("teams.name"), nullable=False, index=True)
    team_b = Column(String, ForeignKey("teams.name"), nullable=False, index=True)
    match_date = Column(DateTime, nullable=False, index=True)
    venue = Column(String, nullable=True)
    stage = Column(String, nullable=False, default="group", index=True)
    group_name = Column(String, nullable=True, index=True)
    predicted_score_a = Column(Float, nullable=True)
    predicted_score_b = Column(Float, nullable=True)
    predicted_winner = Column(String, nullable=True)
    win_prob_a = Column(Float, nullable=True)
    draw_prob = Column(Float, nullable=True)
    win_prob_b = Column(Float, nullable=True)
    confidence_score = Column(Float, nullable=True)
    actual_score_a = Column(Integer, nullable=True)
    actual_score_b = Column(Integer, nullable=True)
    actual_winner = Column(String, nullable=True)
    result_source = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class RecalibrationLog(Base):
    __tablename__ = "recalibration_log"

    id = Column(Integer, primary_key=True, index=True)
    triggered_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    matches_used = Column(Integer, nullable=False, default=0)
    model_accuracy_before = Column(Float, nullable=True)
    model_accuracy_after = Column(Float, nullable=True)
    notes = Column(String, nullable=True)


class BiasLog(Base):
    __tablename__ = "bias_log"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False, index=True)
    user_prediction = Column(String, nullable=False)
    model_prediction = Column(String, nullable=False)
    actual_result = Column(String, nullable=True)
    user_correct = Column(Boolean, nullable=True)
    model_correct = Column(Boolean, nullable=True)
    user_confidence = Column(Float, nullable=True)
    emotional_investment = Column(Float, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


def create_db_and_tables() -> None:
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def database_is_connected() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
