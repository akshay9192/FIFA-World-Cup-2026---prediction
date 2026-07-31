import React from 'react';
import { formatDate, formatPercent, stageName } from '../api';

export default function MatchCard({ match, compact = false }) {
  const modelCorrect = match.predicted_winner === match.actual_winner;
  return (
    <article className="panel min-w-0 flex h-full flex-col" aria-label={`${match.team_a} versus ${match.team_b}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>{stageName(match.stage)}{match.group_name ? ` · Group ${match.group_name}` : ''}</span>
        <time dateTime={match.match_date}>{formatDate(match.match_date)}</time>
      </div>
      <div className="mt-5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <strong className="min-w-0 break-words text-left text-base sm:text-xl">{match.team_a}</strong>
        <div className="rounded-xl border border-white/10 bg-ink-950 px-3 py-2 text-center">
          <span className="block text-xl font-black">{match.actual_score_a}–{match.actual_score_b}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Actual</span>
        </div>
        <strong className="min-w-0 break-words text-right text-base sm:text-xl">{match.team_b}</strong>
      </div>
      {match.result_note && <p className="mt-2 text-center text-xs text-gold-300">{match.result_note}</p>}
      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-slate-300">Model pick: <strong className="text-white">{match.predicted_winner}</strong></span>
          <span className={`chip ${modelCorrect ? 'border-mint-400/30 text-mint-300' : 'border-rose-400/30 text-rose-300'}`}>
            {modelCorrect ? 'Matched outcome' : 'Missed outcome'}
          </span>
        </div>
        {!compact && (
          <>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/10" aria-label="Model probabilities">
              <span className="bg-mint-400" style={{ width: formatPercent(match.win_prob_a) }} />
              <span className="bg-slate-500" style={{ width: formatPercent(match.draw_prob) }} />
              <span className="bg-gold-400" style={{ width: formatPercent(match.win_prob_b) }} />
            </div>
            <div className="mt-2 grid min-w-0 grid-cols-3 gap-1 text-xs text-slate-400">
              <span className="min-w-0 break-words">{formatPercent(match.win_prob_a)} {match.team_a}</span>
              <span className="text-center">{formatPercent(match.draw_prob)} draw</span>
              <span className="min-w-0 break-words text-right">{formatPercent(match.win_prob_b)} {match.team_b}</span>
            </div>
          </>
        )}
      </div>
      {!compact && <p className="mt-auto pt-4 text-xs text-slate-500">{match.venue}</p>}
    </article>
  );
}
