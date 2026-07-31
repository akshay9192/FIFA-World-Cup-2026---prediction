import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, stageName } from '../api';
import AsyncState from '../components/AsyncState';
import MatchCard from '../components/MatchCard';

const stages = ['all', 'group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];

export default function Predictions() {
  const [matches, setMatches] = useState([]);
  const [stage, setStage] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setMatches(await api('/predictions')); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => matches.filter((match) => {
    const matchesStage = stage === 'all' || match.stage === stage;
    const haystack = `${match.team_a} ${match.team_b} ${match.venue}`.toLowerCase();
    return matchesStage && haystack.includes(query.trim().toLowerCase());
  }), [matches, query, stage]);

  return (
    <section className="page-section">
      <p className="eyebrow">Actual result vs model</p>
      <h1 className="page-title">Every match, replayed</h1>
      <p className="lead">The score is historical. The probability is the experimental model’s call. Penalty shoot-outs are identified separately.</p>
      <div className="panel my-8 grid gap-4 md:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Search team or venue</span>
          <input className="w-full rounded-xl border-white/15 bg-ink-950 text-white placeholder:text-slate-500" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Spain or Dallas" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Tournament stage</span>
          <select className="w-full rounded-xl border-white/15 bg-ink-950 text-white" value={stage} onChange={(event) => setStage(event.target.value)}>
            {stages.map((value) => <option key={value} value={value}>{value === 'all' ? 'All stages' : stageName(value)}</option>)}
          </select>
        </label>
      </div>
      <AsyncState loading={loading} error={error} empty={!loading && (!matches.length || !filtered.length)} onRetry={load}>
        <p className="mb-4 text-sm text-slate-400" aria-live="polite">Showing {filtered.length} of {matches.length} matches</p>
        <div className="grid gap-4 lg:grid-cols-2">{filtered.map((match) => <MatchCard key={match.match_id} match={match} />)}</div>
      </AsyncState>
    </section>
  );
}
