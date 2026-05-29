from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.database import Match, create_db_and_tables, session_scope

GROUPS = {
    "A": ["USA", "Panama", "Morocco", "Portugal"], "B": ["Mexico", "Ecuador", "South Korea", "New Zealand"],
    "C": ["Argentina", "Peru", "Poland", "Saudi Arabia"], "D": ["France", "Colombia", "Denmark", "Slovenia"],
    "E": ["Spain", "Netherlands", "Serbia", "Japan"], "F": ["Germany", "Australia", "Hungary", "Algeria"],
    "G": ["Brazil", "Uruguay", "Switzerland", "Cameroon"], "H": ["England", "Turkey", "DR Congo", "Iran"],
    "I": ["Canada", "Venezuela", "Belgium", "Romania"], "J": ["Italy", "Croatia", "Egypt", "South Africa"],
    "K": ["Qatar", "Mali", "Czech Republic", "Tunisia"], "L": ["Senegal", "Ghana", "Slovakia", "Kenya"],
}
VENUES = ["MetLife Stadium, New Jersey", "AT&T Stadium, Dallas", "SoFi Stadium, Los Angeles", "Mercedes-Benz Stadium, Atlanta", "Lumen Field, Seattle", "Levi's Stadium, Bay Area", "NRG Stadium, Houston", "BC Place, Vancouver", "BMO Field, Toronto", "Estadio Azteca, Mexico City", "Estadio BBVA, Monterrey", "Estadio Akron, Guadalajara"]
PAIRINGS = [(0, 1), (2, 3), (0, 2), (1, 3), (0, 3), (1, 2)]

def main() -> None:
    create_db_and_tables()
    start = datetime(2026, 6, 12, 18, 0)
    created = 0
    with session_scope() as db:
        match_index = 0
        for group, teams in GROUPS.items():
            for pidx, (i, j) in enumerate(PAIRINGS):
                match_date = start + timedelta(days=(pidx // 2) * 7 + (match_index % 6), hours=(match_index % 3) * 2)
                match = db.query(Match).filter(Match.team_a == teams[i], Match.team_b == teams[j], Match.stage == "group").first()
                if not match:
                    match = Match(team_a=teams[i], team_b=teams[j], stage="group")
                    db.add(match); created += 1
                match.team_a = teams[i]; match.team_b = teams[j]; match.group_name = group; match.match_date = match_date; match.venue = VENUES[match_index % len(VENUES)]
                match_index += 1
    print(f"Seeded or updated group fixtures; new rows: {created}")

if __name__ == "__main__":
    main()
