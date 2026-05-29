from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Any

import requests
from sqlalchemy.orm import Session

from .database import Match, SessionLocal

API_URL = "https://api.football-data.org/v4"

class FootballDataSync:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("FOOTBALL_DATA_API_KEY")
        if not self.api_key:
            raise ValueError("FOOTBALL_DATA_API_KEY is required for football-data.org sync")

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        headers = {"X-Auth-Token": self.api_key}
        url = f"{API_URL}{path}"
        for attempt in range(2):
            try:
                response = requests.get(url, headers=headers, params=params, timeout=30)
            except requests.RequestException as exc:
                raise RuntimeError("Football data API unavailable — use manual entry") from exc
            if response.status_code == 429 and attempt == 0:
                time.sleep(60)
                continue
            if response.status_code >= 500:
                raise RuntimeError("Football data API unavailable — use manual entry")
            if response.status_code >= 400:
                raise RuntimeError(f"football-data.org error {response.status_code}: {response.text[:200]}")
            return response.json()
        raise RuntimeError("Football data API unavailable — use manual entry")

    def sync_world_cup_fixtures(self) -> int:
        data = self._get("/competitions/WC/matches")
        with SessionLocal() as db:
            count = self._upsert_matches(db, data.get("matches", []), finished_only=False)
            db.commit()
            return count

    def sync_latest_results(self) -> int:
        data = self._get("/competitions/WC/matches", {"status": "FINISHED"})
        with SessionLocal() as db:
            count = self._upsert_matches(db, data.get("matches", []), finished_only=True)
            db.commit()
            return count

    def get_team_stats(self, team_name: str) -> dict[str, Any]:
        data = self._get("/teams")
        for team in data.get("teams", []):
            if team.get("name", "").lower() == team_name.lower() or team.get("shortName", "").lower() == team_name.lower():
                return team
        return {}

    def _upsert_matches(self, db: Session, api_matches: list[dict[str, Any]], finished_only: bool) -> int:
        updated = 0
        for item in api_matches:
            home = item.get("homeTeam", {}).get("name")
            away = item.get("awayTeam", {}).get("name")
            if not home or not away:
                continue
            utc_date = item.get("utcDate") or datetime.utcnow().isoformat()
            match_date = datetime.fromisoformat(utc_date.replace("Z", "+00:00")).replace(tzinfo=None)
            stage = self._stage(item.get("stage"))
            match = db.query(Match).filter(Match.team_a == home, Match.team_b == away, Match.match_date == match_date).first()
            if not match:
                match = Match(team_a=home, team_b=away, match_date=match_date, venue=item.get("venue"), stage=stage, group_name=item.get("group"))
                db.add(match)
            score = item.get("score", {}).get("fullTime", {})
            if item.get("status") == "FINISHED" or finished_only:
                match.actual_score_a = score.get("home")
                match.actual_score_b = score.get("away")
                if match.actual_score_a is not None and match.actual_score_b is not None:
                    match.actual_winner = home if match.actual_score_a > match.actual_score_b else away if match.actual_score_b > match.actual_score_a else "Draw"
                    match.result_source = "auto"
            updated += 1
        return updated

    def _stage(self, raw: str | None) -> str:
        mapping = {"GROUP_STAGE": "group", "LAST_32": "r32", "LAST_16": "r16", "QUARTER_FINALS": "qf", "SEMI_FINALS": "sf", "FINAL": "final"}
        return mapping.get(raw or "", "group")
