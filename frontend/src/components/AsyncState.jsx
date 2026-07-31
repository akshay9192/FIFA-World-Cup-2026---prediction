import React from 'react';

export default function AsyncState({ loading, error, empty, onRetry, children }) {
  if (loading) {
    return (
      <div className="panel" role="status">
        <div className="h-3 w-36 animate-pulse rounded bg-white/15" />
        <div className="mt-4 h-3 w-2/3 animate-pulse rounded bg-white/10" />
        <span className="sr-only">Loading replay data</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="panel border-rose-400/30" role="alert">
        <h2 className="font-bold text-rose-200">Replay service unavailable</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{error}</p>
        {onRetry && <button className="button-secondary mt-4" type="button" onClick={onRetry}>Retry loading data</button>}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="panel">
        <h2 className="font-bold">Nothing to show yet</h2>
        <p className="mt-2 text-sm text-slate-400">Seed the replay database, then retry this page.</p>
        {onRetry && <button className="button-secondary mt-4" type="button" onClick={onRetry}>Check again</button>}
      </div>
    );
  }
  return children;
}
