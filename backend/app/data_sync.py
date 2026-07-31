from __future__ import annotations

import os
from datetime import datetime
from typing import Any

import requests
from sqlalchemy.orm import Session

from .database import Match, SessionLocal, Team

API_URL = "https://api.football-data.org/v4"

TEAM_ALIASES = {
    "Korea Republic": "Korea Republic",
    "South Korea": "Korea Republic",
    "Turkey": "Türkiye",
    "Iran": "IR Iran",
    "DR Congo": "Congo DR",
}


class FootballDataSync:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("FOOTBALL_DATA_API_KEY")
        if not self.api_key:
            raise ValueError("FOOTBALL_DATA_API_KEY is not configured; the offline replay remains available")

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        try:
            response = requests.get(
                f"{API_URL}{path}",
                headers={"X-Auth-Token": self.api_key},
                params=params,
                timeout=15,
            )
        except requests.RequestException as exc:
            raise RuntimeError("Football data API unavailable; the offline replay remains available") from exc
        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After", "later")
            raise RuntimeError(f"Football data API rate limit reached; retry after {retry_after}")
        if response.status_code >= 500:
            raise RuntimeError("Football data API unavailable; the offline replay remains available")
        if response.status_code >= 400:
            raise RuntimeError(f"Football data API rejected the request ({response.status_code})")
        try:
            return response.json()
        except requests.JSONDecodeError as exc:
            raise RuntimeError("Football data API returned an invalid response") from exc

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
            if team.get("name", "").casefold() == team_name.casefold() or team.get("shortName", "").casefold() == team_name.casefold():
                return team
        return {}

    def _upsert_matches(self, db: Session, api_matches: list[dict[str, Any]], finished_only: bool) -> int:
        updated = 0
        for item in api_matches:
            home = TEAM_ALIASES.get(item.get("homeTeam", {}).get("name"), item.get("homeTeam", {}).get("name"))
            away = TEAM_ALIASES.get(item.get("awayTeam", {}).get("name"), item.get("awayTeam", {}).get("name"))
            if not home or not away:
                continue
            if not db.query(Team).filter(Team.name == home).first() or not db.query(Team).filter(Team.name == away).first():
                continue
            utc_date = item.get("utcDate")
            if not utc_date:
                continue
            match_date = datetime.fromisoformat(utc_date.replace("Z", "+00:00")).replace(tzinfo=None)
            external_id = f"football-data-{item['id']}" if item.get("id") is not None else None
            match = db.query(Match).filter(Match.external_id == external_id).first() if external_id else None
            if not match:
                match = db.query(Match).filter(Match.team_a == home, Match.team_b == away).first()
            if not match:
                match = Match(
                    external_id=external_id,
                    team_a=home,
                    team_b=away,
                    match_date=match_date,
                    venue=item.get("venue"),
                    stage=self._stage(item.get("stage")),
                    group_name=item.get("group"),
                )
                db.add(match)
            score = item.get("score", {}).get("fullTime", {})
            if item.get("status") == "FINISHED" or finished_only:
                match.actual_score_a = score.get("home")
                match.actual_score_b = score.get("away")
                if match.actual_score_a is not None and match.actual_score_b is not None:
                    match.actual_winner = home if match.actual_score_a > match.actual_score_b else away if match.actual_score_b > match.actual_score_a else "Draw"
                    match.result_source = "football-data.org API"
            updated += 1
        return updated

    @staticmethod
    def _stage(raw: str | None) -> str:
        mapping = {
            "GROUP_STAGE": "group",
            "LAST_32": "r32",
            "LAST_16": "r16",
            "QUARTER_FINALS": "qf",
            "SEMI_FINALS": "sf",
            "THIRD_PLACE": "third",
            "FINAL": "final",
        }
        return mapping.get(raw or "", "group")
