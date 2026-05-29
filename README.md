# FIFA World Cup 2026 Prediction System

A full-stack FIFA World Cup 2026 prediction system using a FastAPI backend, SQLAlchemy/PostgreSQL persistence, an XGBoost-assisted Poisson score model, Monte Carlo tournament simulation, and a React + Tailwind frontend.

## Features

- Predicts every match scoreline with Poisson probabilities for home/team A win, draw, and team B win.
- Uses 100 team/context/user-signal parameters spanning form, rankings, squad quality, management, World Cup history, head-to-head trends, venue pressure, fitness, tactics, and user bias.
- Runs 10,000-iteration Monte Carlo tournament simulations to estimate group-exit, semifinal, finalist, and title probabilities.
- Syncs fixtures and results from football-data.org when `FOOTBALL_DATA_API_KEY` is configured.
- Supports manual result entry, automatic recalibration, model accuracy tracking, and a user-vs-model bias layer.

## The 100 model parameters

The backend keeps exactly 100 numeric feature fields for each team:

1. **Recent form:** last-10 win/draw/loss rates, goals, xG/xGA, clean sheets, home/away strength, trends, big-game form, scoring-first behavior, points per game.
2. **Team quality:** FIFA ranking, prior ranking, top-11 and squad Elo proxies, bench quality, age, top-league and Champions League player counts, squad value, scorer availability, injuries, suspensions, goalkeeper and set-piece quality.
3. **Manager profile:** tournament and knockout win rates, must-win record, tenure, tournament experience, top-20 record, tactical flexibility, goals for/against, World Cup experience.
4. **World Cup history:** appearances, recent results, last-three tournament win rate, goals, clean sheets, performance versus expectations, consecutive appearances, best finish, years since group exit.
5. **Head-to-head:** all-time and recent win rates, goals, World Cup record, neutral-site record, last result/score, psychological edge, trend.
6. **Context:** group difficulty, rest/travel, altitude, climate/time zone, match importance, elimination pressure, crowd support, venue history, group position, goal difference, points needed.
7. **Fitness and squad load:** distance covered, sprints, injury rate, days since last match, fixture congestion, age/cap distribution, club minutes, warm-up results.
8. **Tactics and discipline:** possession, press, counterattack, set pieces, shots, shots on target, tackles, yellows, shootout record.
9. **User layer:** confidence, gut feeling, bias against model, historical user accuracy, emotional investment.

## Backend setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
# Edit DATABASE_URL and FOOTBALL_DATA_API_KEY as needed.
python scripts/seed_teams.py
python scripts/seed_matches.py
uvicorn backend.app.main:app --reload
```

For quick local experimentation without PostgreSQL, omit `DATABASE_URL`; the backend falls back to `sqlite:///./fifa_predictor.db`.

## API reference

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Service and database health. |
| `GET` | `/predictions` | All match predictions sorted by date. |
| `GET` | `/predictions/{match_id}` | One prediction plus stored bias adjustment if present. |
| `POST` | `/results/manual` | Submit `match_id`, `score_a`, and `score_b`; updates actual result and may recalibrate. |
| `POST` | `/results/sync` | Pull finished results from football-data.org. |
| `POST` | `/recalibrate` | Retrain the XGBoost classifier from completed matches. |
| `GET` | `/accuracy` | Overall, group-stage, knockout, and running model accuracy. |
| `GET` | `/tournament/simulate` | Monte Carlo stage probabilities for all 48 teams. |
| `GET` | `/bias` | User-vs-model bias leaderboard and history. |
| `POST` | `/bias` | Save user gut pick, confidence, and emotional investment for a match. |

## Frontend setup

```bash
cd frontend
npm install
npm start
```

Set `REACT_APP_API_BASE=http://localhost:8000` if your backend uses a non-default URL.

## Data sync

`FootballDataSync` calls `https://api.football-data.org/v4/competitions/WC/matches` with `X-Auth-Token` from `FOOTBALL_DATA_API_KEY`. If the API returns `429`, the sync waits 60 seconds and retries once. If the API is unavailable, it raises: `Football data API unavailable — use manual entry`.

## Recalibration

Manual or synced results populate `actual_winner`. The recalibration service compares stored `predicted_winner` values to actual winners, calculates baseline accuracy, converts completed matches into 100-feature vectors, retrains the XGBoost classifier, logs the run in `recalibration_log`, and returns before/after accuracy.

## Bias layer

Users submit a gut result and confidence score for upcoming matches. Confidence 8-10 shifts model probabilities about 15% toward the gut feeling, confidence 5-7 shifts about 7%, and confidence 0-4 keeps the model unchanged. Emotional investment scales that shift slightly. Completed results update `bias_log` so the app can report whether the user or model is winning.

## Deployment notes

- Backend Dockerfile targets Cloud Run on port `8080`.
- Frontend is Firebase-ready and includes `.firebaserc`; set the Firebase project before deployment.
