from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .feature_fields import TEAM_FEATURE_FIELDS

load_dotenv()

def normalise_database_url(value: str) -> str:
    """Accept the postgres:// URLs still emitted by a few hosting providers."""
    return value.replace("postgres://", "postgresql://", 1) if value.startswith("postgres://") else value


DATABASE_URL = normalise_database_url(os.getenv("DATABASE_URL", "sqlite:///./fifa_predictor.db"))
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def utc_now() -> datetime:
    # Datetimes are stored as naive UTC for portable SQLite/PostgreSQL behaviour.
    return datetime.now(timezone.utc).replace(tzinfo=None)


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
    __table_args__ = (
        UniqueConstraint("external_id", name="uq_matches_external_id"),
        CheckConstraint("team_a <> team_b", name="ck_matches_distinct_teams"),
    )

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String, nullable=True, index=True)
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
    result_note = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)


class RecalibrationLog(Base):
    __tablename__ = "recalibration_log"

    id = Column(Integer, primary_key=True, index=True)
    triggered_at = Column(DateTime, nullable=False, default=utc_now)
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
    created_at = Column(DateTime, nullable=False, default=utc_now)


def create_db_and_tables() -> None:
    Base.metadata.create_all(bind=engine)
    # Lightweight compatibility migration for databases created by the original
    # prototype. New deployments should use Alembic; this keeps local upgrades easy.
    columns = {column["name"] for column in inspect(engine).get_columns("matches")}
    additions = {
        "external_id": "VARCHAR",
        "result_note": "VARCHAR",
    }
    with engine.begin() as connection:
        for name, sql_type in additions.items():
            if name not in columns:
                connection.execute(text(f"ALTER TABLE matches ADD COLUMN {name} {sql_type}"))


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
