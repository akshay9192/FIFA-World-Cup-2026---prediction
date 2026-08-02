import React from 'react';
import { formatDate, formatPercent, stageName } from '../api';

export default function MatchCard({ match, compact = false, sequence }) {
  const modelCorrect = match.predicted_winner === match.actual_winner;
  const probabilities = [
    [match.team_a, match.win_prob_a, 'home'], ['Draw', match.draw_prob, 'draw'], [match.team_b, match.win_prob_b, 'away'],
  ];
  return (
    <article className={`match-strip ${compact ? 'is-compact' : ''}`} aria-label={`${match.team_a} versus ${match.team_b}`} data-reveal="strip">
      <div className="match-meta"><span>{sequence || `M${String(match.match_id).padStart(3, '0')}`}</span><span>{stageName(match.stage)}{match.group_name ? ` · Group ${match.group_name}` : ''}</span><time dateTime={match.match_date}>{formatDate(match.match_date)}</time></div>
      <div className="score-line">
        <strong>{match.team_a}</strong><span className="score"><b>{match.actual_score_a}</b><i>–</i><b>{match.actual_score_b}</b><small>FT</small></span><strong>{match.team_b}</strong>
      </div>
      {match.result_note && <p className="result-note">{match.result_note}</p>}
      <div className="model-call">
        <span className={modelCorrect ? 'outcome matched' : 'outcome missed'}>{modelCorrect ? '✓ Matched outcome' : '× Missed outcome'}</span>
        <p>Model call <strong>{match.predicted_winner}</strong></p>
      </div>
      {!compact && (
        <div className="probabilities">
          {probabilities.map(([label, value, kind]) => <div key={kind} className={kind}><span>{label}</span><i><b style={{ '--width': formatPercent(value) }} /></i><strong>{formatPercent(value)}</strong></div>)}
          <p className="sr-only">Model probabilities: {formatPercent(match.win_prob_a)} {match.team_a} win, {formatPercent(match.draw_prob)} draw, {formatPercent(match.win_prob_b)} {match.team_b} win.</p>
        </div>
      )}
      {!compact && <p className="venue">{match.venue}</p>}
    </article>
  );
}
