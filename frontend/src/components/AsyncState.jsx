import React from 'react';

export default function AsyncState({ loading, error, empty, onRetry, children }) {
  if (loading) {
    return (
      <div className="async-state" role="status" aria-live="polite">
        <span className="loader-ball" aria-hidden="true" />
        <div>
          <h2>Warming up the prediction engine</h2>
          <p>Free hosting can take up to a minute. You can keep navigating while the service wakes.</p>
        </div>
        {onRetry && <button className="button-secondary" type="button" onClick={onRetry}>Retry now</button>}
      </div>
    );
  }
  if (error) {
    return (
      <div className="async-state is-error" role="alert">
        <span className="state-code" aria-hidden="true">!</span>
        <div><h2>Prediction engine unavailable</h2><p>{error}</p></div>
        {onRetry && <button className="button-secondary" type="button" onClick={onRetry}>Retry loading data</button>}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="async-state">
        <span className="state-code" aria-hidden="true">0</span>
        <div><h2>No matches found</h2><p>Change the current filters or check the replay database.</p></div>
        {onRetry && <button className="button-secondary" type="button" onClick={onRetry}>Check again</button>}
      </div>
    );
  }
  return children;
}
