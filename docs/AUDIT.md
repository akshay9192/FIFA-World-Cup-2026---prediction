# Initial project audit

## Repository state

The starting repository was a small FastAPI/React monorepo with no automated
tests, no frontend hosting configuration, no local setup scripts, an ignored local
SQLite database, and one untracked `frontend/package-lock.json`. No `AGENTS.md`
was present. The lockfile has been retained and brought under the production
dependency configuration.

## Root causes found

- `data/teams.json` and `scripts/seed_matches.py` contained invented qualifiers,
  group assignments, fixtures, dates, venues, strength statistics, and broken
  flag encoding. They were presented without provenance.
- Startup seeded teams only. A fresh database therefore rendered no matches.
- The README described generated values and an unvalidated 100-field design as
  if parameter count implied model quality.
- The XGBoost classifier was trained in-sample, was not used by the normal
  prediction path after fitting, was not persisted, and added substantial image
  size and cold-start cost.
- A 10,000-iteration simulation ran on every dashboard visit with no cache.
- CORS allowed every origin, internal exception strings were sent to clients,
  dependencies were unbounded, API failures could blank pages, and the fixed
  sidebar was not usable on small screens.
- React 19, React Router 7, Tailwind 4, and older Create React App code were
  installed through `latest` ranges. There were no route, error-state, or data
  rendering tests.
- Deployment notes targeted an obsolete frontend host, and the Docker command
  ignored a platform-provided port.

## Data classification after remediation

- `data/tournament_2026.json`: source-attributed historical teams, groups,
  dates, venues, fixtures, and results transcribed from the linked FIFA results
  page.
- `strength_rank` and derived form fields: explicitly labelled experimental
  model seed inputs, not official rankings.
- Prediction probabilities and likely scorelines: model-generated values.
- Bias submissions and manual results: user inputs, labelled separately.
- External sync data: labelled `football-data.org API` when that optional
  integration is configured and succeeds.

The offline dataset deliberately stores noon UTC as a date marker because the
source does not expose exact kick-off timestamps consistently. The UI renders
the verified match date rather than suggesting that noon UTC was the kick-off.

## Editorial redesign audit (2026-08-02)

The second audit found a functional application whose visual system relied on
the same rounded translucent panel for almost every kind of content. The home
page did not communicate the 48-team tournament structure, accuracy bars had no
useful programmatic explanation, and match probabilities were visually compact
but disconnected from tournament routes. The mobile menu also contained
mis-encoded glyphs in its control label.

The browser requested metadata, predictions, and accuracy in parallel but did
not check `/health`, so service telemetry could not distinguish a healthy API
from a missing backend root route. A Render cold start looked like an indefinite
loading panel with no elapsed feedback. The existing in-progress cache and
bundled-fallback work has been retained and extended to include `/health` and
the 48-team `/teams` response.

The redesign introduces the original “Tournament Atlas” system: a structured,
keyboard-operable group constellation; editorial match strips; a labelled SVG
accuracy story; clear bias-analysis limits; a deliberate Match Not Found page;
and reduced-density mobile variants. It preserves the custom `HashRouter`, API
contracts, Create React App repository-subpath build, CI, and GitHub Pages
workflow.

## Second-pass live visual audit (2026-08-02)

Real-browser captures at 1440×900, 1024×768, 768×1024, 390×844, and 320×568
showed that the first editorial pass was visually coherent but insufficiently
interactive:

- At 1440px the hero read as a headline placed beside a finished diagram. The
  atlas had no entrance choreography, live route movement, pointer depth, or
  obvious selected-team expansion.
- At 1024px the responsive breakpoint moved the entire constellation below the
  fold. The first viewport became an oversized headline with a large inactive
  right side, so the signature interaction was absent when it mattered most.
- At 768px the page became a long vertical sequence rather than a deliberately
  recomposed tablet layout. Section changes depended on background colour, not
  spatial or motion continuity.
- At 390px and 320px, long telemetry and kicker lines exceeded the viewport,
  supporting copy was visibly clipped, and the navigation control was pushed
  out of view by the wordmark. Primary actions occupied too much vertical space
  before any tournament content appeared.
- Across every size, match strips, statistics, chart lines, rules, and headings
  arrived fully formed. Hover colour changes were the only recurring feedback;
  there was no coordinated load sequence, scroll rhythm, tactile press language,
  or football-specific loading motion.

The root cause was a layout-and-motion split: CSS handled static breakpoints,
while React supplied data, but there was no shared motion lifecycle for route
entry, viewport visibility, reduced motion, page visibility, pointer depth, or
observer cleanup. The second pass introduces that lifecycle and recomposes the
hero and atlas at each breakpoint instead of merely stacking them.
