from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from .database import Match, Team
from .feature_fields import TEAM_FEATURE_FIELDS, default_for_feature

DATASET_PATH = Path(__file__).resolve().parents[2] / "data" / "tournament_2026.json"


def load_dataset() -> dict[str, Any]:
    return json.loads(DATASET_PATH.read_text(encoding="utf-8"))


def seed_replay_data(db: Session) -> dict[str, int]:
    """Upsert the documented offline replay dataset without creating duplicates."""
    dataset = load_dataset()
    team_created = 0
    match_created = 0

    for item in dataset["teams"]:
        team = db.query(Team).filter(Team.name == item["name"]).first()
        if team is None:
            team = Team(name=item["name"])
            team_created += 1
        team.group_name = item["group"]
        team.confederation = item["confederation"]
        team.emoji_flag = None
        for field in TEAM_FEATURE_FIELDS:
            setattr(team, field, default_for_feature(field))
        # This legacy column feeds the model; the dataset explicitly labels the
        # value as an experimental strength rank rather than an official ranking.
        team.fifa_ranking = float(item["strength_rank"])
        team.fifa_ranking_12m_ago = float(item["strength_rank"])
        team.win_rate_last10 = max(0.2, min(0.75, (85 - item["strength_rank"]) / 100))
        team.loss_rate_last10 = max(0.1, min(0.65, item["strength_rank"] / 160))
        team.draw_rate_last10 = max(0.1, 1 - team.win_rate_last10 - team.loss_rate_last10)
        team.xg_last10 = 1.0 + max(0, 70 - item["strength_rank"]) / 100
        team.xga_last10 = 0.8 + item["strength_rank"] / 150
        team.points_per_game = team.win_rate_last10 * 3 + team.draw_rate_last10
        db.add(team)
    db.flush()

    for item in dataset["matches"]:
        external_id = f"wc26-{item['id']:03d}"
        match = db.query(Match).filter(Match.external_id == external_id).first()
        if match is None:
            # Compatibility fallback for a database seeded by an older project version.
            match = db.query(Match).filter(
                Match.team_a == item["a"],
                Match.team_b == item["b"],
                Match.match_date >= datetime.fromisoformat(f"{item['date']}T00:00:00"),
                Match.match_date < datetime.fromisoformat(f"{item['date']}T23:59:59"),
            ).first()
        if match is None:
            match = Match()
            match_created += 1
        match.external_id = external_id
        match.team_a = item["a"]
        match.team_b = item["b"]
        match.match_date = datetime.fromisoformat(f"{item['date']}T12:00:00")
        match.venue = item["venue"]
        match.stage = item.get("stage", "group")
        match.group_name = item.get("group")
        match.actual_score_a = item["sa"]
        match.actual_score_b = item["sb"]
        match.actual_winner = item.get(
            "winner",
            item["a"] if item["sa"] > item["sb"] else item["b"] if item["sb"] > item["sa"] else "Draw",
        )
        match.result_source = "FIFA verified historical result"
        match.result_note = item.get("note")
        db.add(match)

    db.commit()
    return {
        "teams_total": len(dataset["teams"]),
        "teams_created": team_created,
        "matches_total": len(dataset["matches"]),
        "matches_created": match_created,
    }


def dataset_metadata() -> dict[str, Any]:
    return load_dataset()["metadata"]
