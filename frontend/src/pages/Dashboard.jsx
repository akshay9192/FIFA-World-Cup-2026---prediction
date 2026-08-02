import React, { useState } from 'react';
import { api, formatPercent } from '../api';
import AsyncState from '../components/AsyncState';
import MatchCard from '../components/MatchCard';
import TournamentConstellation from '../components/TournamentConstellation';
import { useReplayData } from '../data/ReplayDataContext';
import { Link } from '../router';

export default function Dashboard() {
  const { data, error, loading, refreshing, retry, source } = useReplayData();
  const [rankings, setRankings] = useState([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState('');

  async function runSimulation() {
    setSimLoading(true);
    setSimError('');
    try { setRankings(await api('/tournament/simulate?iterations=1000')); }
    catch (requestError) { setSimError(requestError.message); }
    finally { setSimLoading(false); }
  }

  const final = data?.predictions?.find((match) => match.stage === 'final');
  const featured = data?.predictions?.filter((match) => ['final', 'sf'].includes(match.stage)).slice(-3).reverse() || [];
  const accuracy = data?.accuracy;

  return (
    <>
      <section className="atlas-hero">
        <div className="hero-registration" aria-hidden="true">ATL / 2026 / 001</div>
        <div className="page-shell hero-layout">
          <div className="hero-copy">
            <p className="kicker">An interactive prediction study · 48 teams · 104 matches</p>
            <h1>Replay the<br /><em>whole field.</em></h1>
            <p className="hero-deck">The Tournament Atlas maps every team, model call and uncertain route through the 2026 competition — a simulation project, not an official FIFA product.</p>
            <div className="hero-actions">
              <Link to="/predictions" className="button-primary">Enter the predictions <span aria-hidden="true">↗</span></Link>
              <Link to="/about" className="button-secondary">How the model reads a match</Link>
            </div>
            <div className="hero-telemetry" aria-live="polite">
              <span className={`status-dot ${refreshing ? 'is-warming' : ''}`} aria-hidden="true" />
              <b>{refreshing ? 'ENGINE WARMING' : source === 'live' ? 'ENGINE ONLINE' : 'SAVED FIELD'}</b>
              <span>{data?.predictions?.length || 0} matches loaded</span>
            </div>
          </div>
          <div className="hero-visual"><TournamentConstellation teams={data?.teams || []} /></div>
        </div>
        <a className="scroll-cue" href="#field"><span>Scroll the atlas</span><i aria-hidden="true" /></a>
      </section>

      <section id="field" className="editorial-section paper-section">
        <div className="page-shell split-intro">
          <p className="section-index">01 / THE FIELD</p>
          <div><h2>More teams.<br />More routes.<br /><em>More uncertainty.</em></h2></div>
          <div className="body-column">
            <p>The 48-team field begins as twelve groups of four. The atlas keeps that structure visible: predictions are never detached from the route that makes them possible.</p>
            <dl className="scale-ledger">
              <div><dt>Teams</dt><dd>48</dd></div><div><dt>Groups</dt><dd>12</dd></div><div><dt>Matches</dt><dd>{data?.predictions?.length || 104}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="editorial-section dark-section">
        <div className="page-shell">
          <header className="section-header"><p className="section-index">02 / PREDICTED PATHS</p><h2>The decisive<br />match strip.</h2><Link className="text-link" to="/predictions">Open all match records →</Link></header>
          <AsyncState loading={loading} error={!data ? error : ''} empty={data && !data.predictions.length} onRetry={retry}>
            <div className="featured-strip">{featured.map((match, index) => <MatchCard key={match.match_id} match={match} compact sequence={String(index + 1).padStart(2, '0')} />)}</div>
          </AsyncState>
          {final && <p className="editor-note"><span>Recorded final</span>{final.team_a} {final.actual_score_a}–{final.actual_score_b} {final.team_b}{final.result_note ? ` · ${final.result_note}` : ''}</p>}
        </div>
      </section>

      <section className="editorial-section confidence-section">
        <div className="page-shell confidence-layout">
          <div className="sticky-note"><p className="section-index">03 / CONFIDENCE</p><span>Probability is a distribution,<br />not a promise.</span></div>
          <div className="confidence-copy">
            <h2>Confidence is<br /><em>not certainty.</em></h2>
            <p>A 60% call still leaves four outcomes in ten pointing elsewhere. The interface shows all three outcome probabilities so the model’s hesitation stays visible.</p>
            <div className="probability-demo" aria-label="Example probability distribution: home win 54 percent, draw 24 percent, away win 22 percent">
              <div style={{ '--share': 54 }}><span>HOME</span><strong>54%</strong></div>
              <div style={{ '--share': 24 }}><span>DRAW</span><strong>24%</strong></div>
              <div style={{ '--share': 22 }}><span>AWAY</span><strong>22%</strong></div>
            </div>
            <p className="caption">Illustrative explanation only — not a recorded match.</p>
          </div>
        </div>
      </section>

      <section className="editorial-section paper-section measure-section">
        <div className="page-shell measure-layout">
          <div><p className="section-index">04 / MEASURING THE MODEL</p><h2>{accuracy ? `${accuracy.accuracy_percentage.toFixed(1)}%` : '—'}</h2><p className="oversize-label">recorded outcome accuracy</p></div>
          <div className="rule-copy"><p>“Correct” means the model’s most likely outcome matched the recorded winner or draw. It does not mean the scoreline was exact or the probabilities were calibrated.</p><Link className="ink-link" to="/accuracy">Read the accuracy story →</Link></div>
          <div className="accuracy-tally" aria-label={accuracy ? `${accuracy.correct} correct calls from ${accuracy.total_predictions}` : 'Accuracy unavailable'}>
            {Array.from({ length: Math.min(accuracy?.total_predictions || 0, 104) }, (_, index) => <i key={index} className={index < (accuracy?.correct || 0) ? 'is-correct' : ''} />)}
          </div>
        </div>
      </section>

      <section className="editorial-section bias-teaser">
        <div className="page-shell bias-teaser-grid">
          <p className="section-index">05 / BLIND SPOTS</p>
          <blockquote>“What changes when the person making the prediction already wants one side to win?”</blockquote>
          <div><p>The bias lab records confidence and emotional investment alongside a user pick. It is a comparison tool, not a fairness audit or psychological diagnosis.</p><Link className="button-primary" to="/bias">Test your own call</Link></div>
        </div>
      </section>

      <section className="editorial-section simulator-section">
        <div className="page-shell simulator-grid">
          <div><p className="section-index">06 / REPLAY THE ROUTE</p><h2>One thousand paths.<br />No official odds.</h2><p>Run the existing model through 1,000 experimental tournament paths. Results are cached for fifteen minutes.</p><button className="button-primary" type="button" onClick={runSimulation} disabled={simLoading}>{simLoading ? 'Tracing tournament paths…' : rankings.length ? 'Run another 1,000' : 'Run 1,000 paths'}</button>{simError && <p role="alert" className="inline-error">{simError}</p>}</div>
          <ol className="ranking-board" aria-live="polite">
            {rankings.length ? rankings.slice(0, 8).map((team, index) => <li key={team.team}><span>{String(index + 1).padStart(2, '0')}</span><strong>{team.team}</strong><i style={{ '--probability': `${team.win_probability * 100}%` }} /><b>{formatPercent(team.win_probability, 1)}</b></li>) : <li className="ranking-placeholder">The live ranking board appears after a simulation.</li>}
          </ol>
        </div>
      </section>

      <section className="final-whistle">
        <div className="page-shell"><p className="section-index">FINAL WHISTLE</p><h2>The score is fixed.<br /><em>The reading is yours.</em></h2><div><Link className="button-primary" to="/predictions">Explore every prediction</Link><Link className="button-secondary" to="/about">Read the limitations</Link></div></div>
      </section>
    </>
  );
}
