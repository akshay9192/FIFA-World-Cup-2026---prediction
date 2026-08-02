import React, { useEffect, useState } from 'react';
import { useReplayData } from '../data/ReplayDataContext';

export default function ReplayServiceStatus() {
  const { data, error, refreshing, retry, source } = useReplayData();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!refreshing) {
      setElapsed(0);
      return undefined;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [refreshing]);

  if (refreshing) {
    const phase = elapsed < 8 ? 'Warming up prediction engine' : elapsed < 30 ? 'Render instance waking' : 'Loading tournament field';
    return (
      <div className="service-banner is-warming" role="status">
        <div className="page-shell service-banner-inner">
          <span><b className="status-dot" aria-hidden="true" /><i>LIVE ENGINE</i> <strong>{phase}</strong><span className="service-explainer">Free hosting can take up to a minute.</span><span className="telemetry-time">T+{String(elapsed).padStart(2, '0')}s</span></span>
          <button type="button" onClick={retry}>Retry now</button>
        </div>
      </div>
    );
  }
  if (error && source !== 'none') {
    return (
      <div className="service-banner is-saved" role="alert">
        <div className="page-shell service-banner-inner">
          <span><b className="status-dot" aria-hidden="true" /><i>SAVED MODE</i><strong>Showing saved replay data</strong><span className="service-explainer">{error}</span></span>
          <button type="button" onClick={retry}>Retry live service</button>
        </div>
      </div>
    );
  }
  if (source === 'live') {
    return (
      <div className="service-telemetry" aria-label="Prediction service telemetry">
        <span><b className="status-dot" aria-hidden="true" /> Engine online</span>
        <span>{data?.health?.database?.matches ?? data?.predictions?.length ?? 0} matches indexed</span>
        <span>API /health: {data?.health?.status || 'ok'}</span>
      </div>
    );
  }
  return null;
}
