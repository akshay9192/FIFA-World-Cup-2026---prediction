import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import AsyncState from '../components/AsyncState';

export default function Accuracy() {
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await api('/predictions');
      setAccuracy(await api('/accuracy'));
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="page-section">
      <p className="eyebrow">Transparent evaluation</p>
      <h1 className="page-title">Where the model got it right—and wrong</h1>
      <p className="lead">Accuracy means the predicted outcome matched the recorded winner or draw. It does not mean the exact score was correct.</p>
      <div className="mt-8">
        <AsyncState loading={loading} error={error} empty={!accuracy} onRetry={load}>
          {accuracy && (
            <div className="space-y-8">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Overall outcome accuracy" value={`${accuracy.accuracy_percentage.toFixed(1)}%`} />
                <Stat label="Correct predictions" value={`${accuracy.correct} / ${accuracy.total_predictions}`} />
                <Stat label="Group stage" value={`${accuracy.group_stage_accuracy.toFixed(1)}%`} />
                <Stat label="Knockout rounds" value={`${accuracy.knockout_accuracy.toFixed(1)}%`} />
              </div>
              <div className="panel">
                <h2 className="text-xl font-black">Running outcome accuracy</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Each bar shows cumulative accuracy after that match. A replay comparison is descriptive and should not be read as evidence of future performance.</p>
                <div className="mt-6 flex h-52 items-end gap-px overflow-hidden rounded-xl border border-white/10 bg-ink-950 p-3" aria-label="Running model accuracy chart">
                  {accuracy.history.map((point, index) => (
                    <span key={`${point.date}-${index}`} className="min-w-[2px] flex-1 rounded-t-sm bg-mint-400/75" style={{ height: `${Math.max(point.accuracy, 2)}%` }} title={`${point.accuracy}%`} />
                  ))}
                </div>
              </div>
              <div className="panel border-gold-400/20">
                <h2 className="text-xl font-black text-gold-300">What this metric leaves out</h2>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">Outcome accuracy does not assess calibration, exact-score quality, strength of evidence, or whether inputs were genuinely available before kick-off. The seed inputs are experimental estimates and many of the legacy model’s contextual fields use neutral defaults.</p>
              </div>
            </div>
          )}
        </AsyncState>
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return <div className="panel"><p className="text-sm text-slate-400">{label}</p><p className="stat-value">{value}</p></div>;
}
