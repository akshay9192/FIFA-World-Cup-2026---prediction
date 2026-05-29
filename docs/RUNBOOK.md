# Runbook: Running and Understanding the FIFA World Cup 2026 Predictor

This runbook explains how to run the project locally, how the system works end to end, and what improvements are recommended before a production launch.

## 1. Prerequisites

Install these tools before starting:

- Python 3.11 or newer.
- Node.js 18 or newer and npm.
- PostgreSQL 14 or newer for production-like local runs.
- A football-data.org API token if you want live fixture/result sync.

The backend also supports a SQLite fallback for quick local testing when `DATABASE_URL` is not set. PostgreSQL is still the intended database for production and Cloud Run deployments.

## 2. Environment variables

Copy the example environment file and fill in values:

```bash
cp .env.example .env
```

Required and optional variables:

| Variable | Required? | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Recommended | SQLAlchemy database URL, normally `postgresql://user:password@localhost:5432/fifa_predictor`. If omitted, the app uses local SQLite. |
| `FOOTBALL_DATA_API_KEY` | Required only for sync | Token used by `/results/sync` and `FootballDataSync`. |
| `GEMINI_API_KEY` | Optional | Reserved for future AI explanation features. |
| `GCP_PROJECT_ID` | Optional locally | Used when preparing Cloud Run/Firebase deployments. |

## 3. Run the backend locally

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python scripts/seed_teams.py
python scripts/seed_matches.py
uvicorn backend.app.main:app --reload
```

The API will be available at:

- `http://localhost:8000/health`
- `http://localhost:8000/docs`
- `http://localhost:8000/predictions`

If you use PostgreSQL, create the database first, set `DATABASE_URL`, then run the seed scripts. If you only want a fast demo, leave `DATABASE_URL` unset and the backend will create `fifa_predictor.db` in the project root.

## 4. Run the frontend locally

Open a second terminal:

```bash
cd frontend
npm install
REACT_APP_API_BASE=http://localhost:8000 npm start
```

The React app will run at `http://localhost:3000` and call the FastAPI backend through `frontend/src/api.js`.

## 5. Quick smoke-test checklist

After both apps are running, verify:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/predictions
curl http://localhost:8000/accuracy
curl http://localhost:8000/tournament/simulate
```

Then open `http://localhost:3000` and confirm the dashboard loads title probabilities, upcoming matches, and accuracy widgets.

## 6. How the system works

### 6.1 Data layer

The database stores four core entities:

1. `teams`: one row per team with 100 numeric model features plus identity fields.
2. `matches`: fixtures, predicted probabilities, predicted winner, actual score/result, and audit timestamps.
3. `recalibration_log`: every recalibration attempt with before/after accuracy.
4. `bias_log`: user predictions, model predictions, eventual outcomes, and user/model correctness.

The app creates tables on startup and seeds teams from `data/teams.json` when the teams table is empty.

### 6.2 Prediction flow

1. The frontend requests `/predictions` or `/predictions/{match_id}`.
2. `PredictionService` loads the match and both team rows.
3. `WorldCupPredictor.predict_match` computes each team rating from ranking, squad value, form, h2h, and venue/context signals.
4. The predictor converts those ratings into Poisson goal lambdas.
5. A 0-0 through 5-5 score matrix is generated with `scipy.stats.poisson`.
6. The score matrix is summed into team A win, draw, and team B win probabilities.
7. The most likely scoreline, predicted winner, and confidence score are returned to the UI.

### 6.3 Tournament simulation flow

`/tournament/simulate` runs up to 10,000 Monte Carlo iterations:

1. Simulate all group-stage matches.
2. Build standings using points, goal difference, and goals scored.
3. Advance the top two teams from each group plus the best third-place teams to a 32-team knockout field.
4. Simulate knockout rounds until one champion remains.
5. Return each team’s group-exit, semifinal, finalist, and title probabilities.

### 6.4 Result and recalibration flow

Results can enter the system two ways:

- Manual entry through `POST /results/manual`.
- Automated sync through `POST /results/sync`, which calls football-data.org.

When completed results exist, `RecalibrationService` compares predicted winners to actual winners, trains the XGBoost classifier on completed matches, writes a recalibration log, and exposes the updated accuracy through `/accuracy`.

### 6.5 Bias flow

The Bias page lets a user choose a gut result, confidence, and emotional investment. The backend stores that prediction in `bias_log`. When a result is known, the bias service updates whether the user and model were correct, then reports who is leading and by how much.

The bias adjustment rule is:

- Confidence 0-4: do not move the model.
- Confidence 5-7: shift probabilities about 7% toward the user gut pick.
- Confidence 8-10: shift probabilities about 15% toward the user gut pick.
- Emotional investment scales the shift slightly.

## 7. Recommended improvements before production

These are recommended because the current implementation is a working local system, not yet a hardened production forecasting platform:

1. **Add a reproducible dependency lock:** use `pip-tools`, Poetry, or uv for backend locking and commit a frontend lockfile after `npm install`.
2. **Add automated tests:** cover API routes, seed scripts, prediction math, recalibration, bias updates, and sync error handling.
3. **Move from `create_all` to Alembic migrations:** production deployments should use explicit migrations rather than implicit startup schema creation.
4. **Persist trained models:** save and load XGBoost artifacts so recalibration survives container restarts.
5. **Replace proxy defaults with real feature feeds:** connect Elo, squad value, injury, manager, and player availability sources instead of relying mostly on seeded defaults.
6. **Add authentication/admin controls:** protect manual result entry, result sync, recalibration, and future data-edit endpoints.
7. **Optimize Monte Carlo latency:** move 10,000 simulations to a background job or cache results to avoid slow dashboard responses under load.
8. **Add observability:** structured logs, metrics, tracing, and health checks for database/API dependencies.
9. **Improve frontend loading states:** add skeleton loaders, retry actions, and clearer empty-state messages.
10. **Validate real 2026 fixtures once finalized:** the current seed fixture generator creates a complete playable schedule from the provided groups, but official dates/venues should replace generated fixtures when available.

## 8. Typical development workflow

1. Start PostgreSQL or decide to use SQLite fallback.
2. Install backend dependencies.
3. Seed teams and matches.
4. Start FastAPI.
5. Start React.
6. Inspect `/docs` for API requests.
7. Enter manual results or sync results.
8. Run recalibration and watch `/accuracy` and the Accuracy page update.
