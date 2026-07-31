import React, { useCallback, useEffect, useState } from 'react';
import { api, formatPercent } from '../api';
import AsyncState from '../components/AsyncState';
import MatchCard from '../components/MatchCard';
import { Link } from '../router';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meta, predictions, accuracy] = await Promise.all([
        api('/meta'),
        api('/predictions'),
        api('/accuracy'),
      ]);
      setData({ meta, predictions, accuracy });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runSimulation() {
    setSimLoading(true);
    setSimError('');
    try {
      setRankings(await api('/tournament/simulate?iterations=1000'));
    } catch (requestError) {
      setSimError(requestError.message);
    } finally {
      setSimLoading(false);
    }
  }

  const final = data?.predictions.find((match) => match.stage === 'final');
  const featured = data?.predictions.filter((match) => ['final', 'sf'].includes(match.stage)).slice(-3).reverse() || [];
  return (
    <>
      <section className="hero-grid border-b border-white/10">
        <div className="page-shell grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
          <div>
            <p className="eyebrow">The tournament is complete</p>
            <h1 className="page-title">Replay 2026. Compare the model. Change the call.</h1>
            <p className="lead">Explore every result, see where an experimental prediction model agreed with reality, and make your own hindsight-free picks.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/predictions" className="button-primary">Replay all 104 matches</Link>
              <Link to="/bias" className="button-secondary">Make your prediction</Link>
            </div>
          </div>
          <div className="panel border-gold-400/20 bg-gold-400/[0.06]">
            <p className="eyebrow text-gold-300">Final result</p>
            {final ? (
              <>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <strong className="text-xl sm:text-2xl">{final.team_a}</strong>
                  <span className="rounded-xl bg-ink-950 px-4 py-3 text-2xl font-black">{final.actual_score_a}–{final.actual_score_b}</span>
                  <strong className="text-xl sm:text-2xl">{final.team_b}</strong>
                </div>
                <p className="mt-4 text-center text-sm text-gold-300">{final.result_note}</p>
              </>
            ) : <p className="mt-4 text-slate-400">Final data will appear when the replay seed is available.</p>}
          </div>
        </div>
      </section>

      <section className="page-section">
        <AsyncState loading={loading} error={error} empty={data && !data.predictions.length} onRetry={load}>
          {data && (
            <div className="space-y-12">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="panel"><p className="text-sm text-slate-400">Historical matches</p><p className="stat-value">{data.predictions.length}</p></div>
                <div className="panel"><p className="text-sm text-slate-400">Model outcome accuracy</p><p className="stat-value">{data.accuracy.accuracy_percentage.toFixed(1)}%</p></div>
                <div className="panel"><p className="text-sm text-slate-400">Correct outcome calls</p><p className="stat-value">{data.accuracy.correct}<span className="text-lg text-slate-500"> / {data.accuracy.total_predictions}</span></p></div>
              </div>

              <section aria-labelledby="decisive-matches">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div><p className="eyebrow">Replay highlights</p><h2 id="decisive-matches" className="mt-2 text-2xl font-black">The decisive matches</h2></div>
                  <Link to="/predictions" className="text-sm font-bold text-mint-300 hover:text-mint-400">See every match</Link>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">{featured.map((match) => <MatchCard key={match.match_id} match={match} compact />)}</div>
              </section>

              <section className="panel" aria-labelledby="rankings-title">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="eyebrow">What-if simulator</p>
                    <h2 id="rankings-title" className="mt-2 text-2xl font-black">Model title-probability rankings</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Run 1,000 experimental tournament paths on demand. Results are cached for 15 minutes and are not official odds.</p>
                  </div>
                  <button className="button-primary shrink-0" type="button" onClick={runSimulation} disabled={simLoading}>
                    {simLoading ? 'Running simulation…' : rankings.length ? 'Run again' : 'Run simulation'}
                  </button>
                </div>
                {simError && <p className="mt-5 text-sm text-rose-300" role="alert">{simError}</p>}
                {rankings.length > 0 && (
                  <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {rankings.slice(0, 8).map((team, index) => (
                      <li key={team.team} className="rounded-xl border border-white/10 bg-ink-950 p-4">
                        <div className="flex items-center justify-between gap-3"><strong>{index + 1}. {team.team}</strong><span className="text-mint-300">{formatPercent(team.win_probability, 1)}</span></div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-mint-400" style={{ width: formatPercent(team.win_probability) }} /></div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <div className="panel">
                  <p className="eyebrow">Data provenance</p>
                  <h2 className="mt-2 text-xl font-black">{data.meta.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{data.meta.datetime_note}</p>
                  <p className="mt-3 text-xs text-slate-500">Last verified: {data.meta.last_verified_utc.slice(0, 10)}</p>
                </div>
                <div className="panel">
                  <p className="eyebrow">Use with perspective</p>
                  <h2 className="mt-2 text-xl font-black">Experimental, not official</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{data.meta.model.limitations}</p>
                  <Link className="mt-4 inline-block text-sm font-bold text-mint-300" to="/about">Read the methodology and limitations</Link>
                </div>
              </section>
            </div>
          )}
        </AsyncState>
      </section>
    </>
  );
}
