# World Cup 2026 Replay & What-if Simulator

> Replay the 2026 World Cup, compare the model with actual outcomes, and
> explore alternative predictions.

This is an independent experimental fan project. It is not affiliated with or
endorsed by FIFA. The interface uses original styling and includes no FIFA
logos, photography, video, or tournament artwork.

The application is a React single-page app backed by FastAPI. It ships with an
offline, idempotent 104-match historical replay seed, uses SQLite for local
development, supports PostgreSQL through `DATABASE_URL`, and can optionally
sync football-data.org results when an API key is configured.

## What you can explore

- A responsive tournament replay dashboard and all historical results.
- Experimental pre-match-style probabilities beside recorded outcomes.
- Team title-probability rankings from an explicit, cached simulation.
- Group-stage, knockout, and running outcome accuracy.
- A “What would you have predicted?” game that hides the result until a pick
  is locked.
- Plain-language methodology, limitations, data source, and update metadata.
- Loading, empty, retry, offline-backend, and 404 experiences.

## Data integrity

`data/tournament_2026.json` contains the offline replay dataset. Teams, groups,
fixtures, match dates, venues, and results were transcribed from the
[FIFA tournament results page](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums)
and last verified on 2026-07-31.

The source exposes exact kick-off times inconsistently. Offline records
therefore use 12:00 UTC as a date marker; the UI intentionally displays the
verified date, not a fabricated kick-off time.

The dataset's `strength_rank` values and derived form fields are experimental
model inputs, not official FIFA rankings. Model probabilities are generated
values. Bias picks and manual what-if results are user inputs. Each category is
labelled separately in the API and interface.

## Model methodology and limitations

The lightweight model turns estimated team strength and form into expected goal
rates. A truncated Poisson score matrix provides team-A win, draw, and team-B
win probabilities and a most-likely scoreline. Knockout picks split regulation
draw probability evenly as a deliberately simple extra-time proxy. The
simulator replays the group stage and knockout paths from those probabilities.

Recalibration adjusts only the global goal-rate scale against completed
matches. It does not claim an in-sample accuracy improvement. The original
prototype's XGBoost path was removed because it trained on the same tiny result
set it evaluated, was not used by normal predictions after fitting, was not
persisted, and imposed unnecessary container memory and cold-start cost.

The legacy schema retains 100 possible feature columns for compatibility, but
parameter count is not evidence of accuracy. Many fields use neutral defaults.
The model is not validated for betting, financial decisions, or future
tournaments.

## Local setup — Windows PowerShell

Prerequisites: Python 3.11+ and Node.js 20 or 22. From the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-local.ps1
```

The setup script:

1. creates `.venv`;
2. installs pinned backend dependencies;
3. creates `.env` and `frontend\.env.local` from safe examples if absent;
4. creates/updates the local SQLite database;
5. idempotently seeds 48 replay teams and 104 historical matches;
6. installs the exact frontend lockfile with `npm ci`.

Start two PowerShell terminals:

```powershell
# Terminal 1
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\start-backend.ps1
```

```powershell
# Terminal 2
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\start-frontend.ps1
```

Open:

- Frontend: <http://localhost:3001>
- API health: <http://localhost:8000/health>
- Interactive API docs: <http://localhost:8000/docs>

The equivalent manual Windows commands are:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
Copy-Item .env.example .env
Copy-Item frontend\.env.example frontend\.env.local
.\.venv\Scripts\python.exe scripts\seed_matches.py
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --port 8000

# In another terminal
cd frontend
npm.cmd ci
npm.cmd start
```

## Local setup — macOS/Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements-dev.txt
cp .env.example .env
cp frontend/.env.example frontend/.env.local
python scripts/seed_matches.py
uvicorn backend.app.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm ci
npm start
```

SQLite requires no service or Docker. Re-running the seed reports zero newly
created records.

## Configuration

### Backend environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production only | SQLAlchemy URL. Omit locally for `sqlite:///./fifa_predictor.db`; use the managed PostgreSQL internal connection string in production. Legacy `postgres://` is normalized. |
| `CORS_ORIGINS` | Production | Comma-separated exact frontend origins, without trailing slashes. Local defaults allow `http://localhost:3001` and `http://127.0.0.1:3001`. |
| `FOOTBALL_DATA_API_KEY` | No | Enables the optional football-data.org sync endpoint. The offline replay works without it. |
| `PORT` | Host-provided | Container listen port. Defaults to `8080`. |

### Frontend environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `REACT_APP_API_BASE` | Yes | Public backend origin, for example `https://world-cup-replay-api.onrender.com`. No trailing slash. |

Every `REACT_APP_*` value is embedded into the public browser bundle. Never put
database credentials, API keys, tokens, or other secrets in one.

## Useful API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service version, database connectivity, replay counts, and offline/sync mode. |
| `GET` | `/meta` | Data source, update time, disclaimer, and model explanation. |
| `GET` | `/teams` | The 48 replay teams and experimental model fields. |
| `GET` | `/predictions` | All replay matches with model and actual outcomes. |
| `GET` | `/predictions/{id}` | One match; unknown IDs return 404. |
| `GET` | `/accuracy` | Overall, stage, and running outcome accuracy. |
| `GET` | `/tournament/simulate?iterations=1000` | Cached simulation from 100 to 5,000 runs. Add `refresh=true` to rerun. |
| `GET/POST` | `/bias` | Read or record user-vs-model picks. |
| `POST` | `/results/manual` | Store a labelled user-entered what-if score. |
| `POST` | `/recalibrate` | Re-estimate the Poisson goal-rate scale. |
| `POST` | `/results/sync` | Optional football-data.org result sync. |

## Verification

Run from the repository root:

```powershell
.\.venv\Scripts\python.exe -m ruff check backend scripts
.\.venv\Scripts\python.exe -m pytest backend\tests -q
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend test -- --watchAll=false
$env:REACT_APP_API_BASE="https://api.example.invalid"
npm.cmd --prefix frontend run build
```

The backend tests create an isolated temporary SQLite database and cover health,
metadata, teams, predictions, invalid IDs and bodies, accuracy, bias, manual
results, recalibration, simulation caching, and offline sync behaviour. Frontend
tests cover direct routing, 404 handling, backend failure/retry UI, responsive
navigation, and a successful data render.

## Netlify frontend deployment

The root `netlify.toml` is authoritative:

- Base directory: `frontend`
- Build command: `npm ci && npm run build`
- Publish directory: `frontend/build` (shown as `build` relative to the base)
- Node: `20`
- SPA fallback: `/* -> /index.html` with status 200

Steps:

1. Push your branch to GitHub when you are ready.
2. In Netlify, choose **Add new site → Import an existing project** and select
   this repository.
3. Netlify should read `netlify.toml`; do not replace its base/build/publish
   values in the UI.
4. Add the public environment variable
   `REACT_APP_API_BASE=https://YOUR-BACKEND-HOST`.
5. Deploy, then open `/predictions`, `/accuracy`, and `/bias` directly to verify
   SPA refreshes.
6. Set the backend `CORS_ORIGINS` to the exact production Netlify origin. Add a
   custom-domain origin as a comma-separated second value if used.

Netlify authentication is the only external step: sign in to Netlify and
authorize access to this GitHub repository.

## Render backend + managed PostgreSQL

`render.yaml` defines a Docker web service and managed PostgreSQL database. The
Docker build context is the repository root, so both `backend/` and `data/` are
available to `backend/Dockerfile`. The root `.dockerignore` restricts that
context to runtime backend and seed files; the image runs as an unprivileged
user.

1. In Render, choose **New → Blueprint** and connect this repository.
2. Select `render.yaml`. Render creates `world-cup-replay-api` and
   `world-cup-replay-db`.
3. When prompted for `CORS_ORIGINS`, enter the exact Netlify production origin,
   such as `https://your-site.netlify.app`.
4. Confirm `DATABASE_URL` is linked from the managed database; do not copy it
   into a tracked file.
5. Deploy and wait for `/health` to report `status: ok`, 48 teams, and 104
   matches.
6. Set Netlify's `REACT_APP_API_BASE` to the Render service origin and trigger a
   new frontend deploy.
7. Optionally add `FOOTBALL_DATA_API_KEY` as a secret Render environment value.

Render supplies `PORT`; the image starts Uvicorn on that value. PostgreSQL holds
persistent data, so the container filesystem is not used for production state.
No production credentials are committed.

The backend is intentionally lightweight and no longer requires XGBoost,
NumPy, SciPy, pandas, or scikit-learn. It is more suitable for a small container,
although free-instance availability, sleep policies, database expiry, and
cold-start limits are host policies and can change. At the time of writing,
Render documents that free web services spin down after 15 idle minutes and
free PostgreSQL databases expire after 30 days. Those plans are suitable only
for a preview. For a consistently public experience, use the lowest paid
always-on Render web and PostgreSQL plans available in your region.

Render authentication is the external step: sign in, authorize this GitHub
repository, and create/confirm the managed services. A football-data.org login
is needed only if you choose to enable optional sync.

## Repository notes

- The initial audit and data classification are in
  [`docs/AUDIT.md`](docs/AUDIT.md).
- `.github/workflows/ci.yml` runs backend lint/tests, frontend lint/tests/build,
  and a non-publishing Docker build on pushes and pull requests.
- `.env`, `frontend/.env.local`, SQLite files, build output, caches,
  `node_modules`, coverage files, and logs are ignored.
- The ignored database created by an older prototype can contain placeholder
  rows. Replay API queries select only source-labelled historical records, so
  those rows are not presented as official data.
- `npm audit --omit=dev` is clean. A full audit still reports advisories in
  Create React App 5's obsolete build/test dependency tree; those packages are
  not included in the browser bundle. CRA is retained because this deployment
  is explicitly configured around its `build` output. Migrating to a maintained
  toolchain such as Vite is the recommended future cleanup.
