import React, { useMemo, useState } from 'react';
import { stageName } from '../api';
import AsyncState from '../components/AsyncState';
import MatchCard from '../components/MatchCard';
import { useReplayData } from '../data/ReplayDataContext';
import { useRouter } from '../router';

const stages = ['all', 'group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];

export default function Predictions() {
  const { data, error, loading, retry } = useReplayData();
  const { search } = useRouter();
  const initialTeam = new URLSearchParams(search).get('team') || '';
  const matches = useMemo(() => data?.predictions || [], [data?.predictions]);
  const [stage, setStage] = useState('all');
  const [query, setQuery] = useState(initialTeam);
  const filtered = useMemo(() => matches.filter((match) => {
    const matchesStage = stage === 'all' || match.stage === stage;
    return matchesStage && `${match.team_a} ${match.team_b} ${match.venue}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [matches, query, stage]);

  return (
    <div className="route-page predictions-page">
      <header className="route-hero page-shell">
        <p className="section-index">ATLAS INDEX / 02</p><p className="kicker">Recorded result against model probability</p>
        <h1>Every match,<br /><em>three possible stories.</em></h1>
        <p>The score is historical. The probability is the experimental model’s call. Shoot-outs and extra time remain explicitly labelled.</p>
      </header>
      <div className="filter-dock">
        <div className="page-shell filters">
          <label><span>Find a team or venue</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Spain, Dallas…" type="search" /></label>
          <fieldset><legend>Tournament stage</legend><div className="stage-tabs">{stages.map((value) => <button key={value} type="button" aria-pressed={stage === value} onClick={() => setStage(value)}>{value === 'all' ? 'All' : stageName(value)}</button>)}</div></fieldset>
        </div>
      </div>
      <section className="page-shell prediction-index" aria-labelledby="match-index-title">
        <div className="index-heading"><h2 id="match-index-title">Match index</h2><p aria-live="polite">Showing <b>{filtered.length}</b> of {matches.length} matches</p></div>
        <AsyncState loading={loading} error={!data ? error : ''} empty={!loading && (!matches.length || !filtered.length)} onRetry={retry}>
          <div className="match-list">{filtered.map((match) => <MatchCard key={match.match_id} match={match} />)}</div>
        </AsyncState>
        {filtered.length > 0 && <aside className="uncertainty-note"><b>How to read this</b><p>The largest percentage becomes the model call. The remaining percentages are not errors; they are the uncertainty the model retains.</p></aside>}
      </section>
    </div>
  );
}
