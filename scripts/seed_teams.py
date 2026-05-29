from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.database import Team, create_db_and_tables, session_scope
from backend.app.feature_fields import TEAM_FEATURE_FIELDS, default_for_feature

SQUAD_VALUES = {"France": 1_250_000_000, "England": 1_400_000_000, "Spain": 1_100_000_000, "Brazil": 1_000_000_000, "Portugal": 950_000_000, "Argentina": 850_000_000, "Germany": 900_000_000, "Netherlands": 780_000_000, "Italy": 700_000_000}

def main() -> None:
    create_db_and_tables()
    teams = json.loads((ROOT / "data" / "teams.json").read_text(encoding="utf-8"))
    with session_scope() as db:
        for item in teams:
            team = db.query(Team).filter(Team.name == item["name"]).first() or Team(name=item["name"])
            team.group_name = item.get("group")
            team.confederation = item.get("confederation")
            team.emoji_flag = item.get("emoji_flag")
            for field in TEAM_FEATURE_FIELDS:
                setattr(team, field, default_for_feature(field))
            team.fifa_ranking = float(item.get("fifa_ranking", 50))
            team.fifa_ranking_12m_ago = min(team.fifa_ranking + 5, 150)
            team.squad_value = float(SQUAD_VALUES.get(team.name, max(30_000_000, 600_000_000 / max(team.fifa_ranking, 1))))
            team.win_rate_last10 = max(0.25, min(0.8, (80 - team.fifa_ranking) / 100))
            team.loss_rate_last10 = max(0.1, min(0.6, team.fifa_ranking / 180))
            team.draw_rate_last10 = max(0.1, 1 - team.win_rate_last10 - team.loss_rate_last10)
            team.xg_last10 = 1.0 + max(0, 80 - team.fifa_ranking) / 80
            team.xga_last10 = 0.7 + team.fifa_ranking / 120
            team.points_per_game = team.win_rate_last10 * 3 + team.draw_rate_last10
            db.add(team)
    print(f"Seeded {len(teams)} teams")

if __name__ == "__main__":
    main()
