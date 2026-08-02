import React from 'react';

export default function AsyncState({ loading, error, empty, onRetry, children }) {
  if (loading) return <div className="async-state is-loading" role="status" aria-live="polite"><TacticalLoader /><div><span className="state-kicker">ENGINE SEQUENCE / LIVE REQUEST</span><h2>Warming up the prediction engine</h2><p>Free hosting can take up to a minute. The field remains navigable while Render wakes.</p></div>{onRetry && <button className="button-secondary" type="button" onClick={onRetry}>Retry now <i aria-hidden="true">↻</i></button>}</div>;
  if (error) return <div className="async-state is-error" role="alert"><span className="state-code" aria-hidden="true">!</span><div><span className="state-kicker">CONNECTION LOST</span><h2>Prediction engine unavailable</h2><p>{error}</p></div>{onRetry && <button className="button-secondary" type="button" onClick={onRetry}>Retry loading data <i aria-hidden="true">↻</i></button>}</div>;
  if (empty) return <div className="async-state"><span className="state-code" aria-hidden="true">0</span><div><span className="state-kicker">NO RESULT</span><h2>No matches found</h2><p>Change the filters or check the replay database.</p></div>{onRetry && <button className="button-secondary" type="button" onClick={onRetry}>Check again</button>}</div>;
  return children;
}

function TacticalLoader() {
  return <svg className="tactical-loader" viewBox="0 0 88 58" aria-hidden="true"><rect x="1" y="1" width="86" height="56"/><line x1="44" y1="1" x2="44" y2="57"/><circle cx="44" cy="29" r="9"/><path d="M1 13h13v32H1M87 13H74v32h13"/><path className="loader-route" pathLength="1" d="M10 45C20 18 32 42 44 29S65 10 78 18"/><circle className="loader-player p1" cx="10" cy="45" r="3"/><circle className="loader-player p2" cx="44" cy="29" r="3"/><circle className="loader-player p3" cx="78" cy="18" r="3"/></svg>;
}
