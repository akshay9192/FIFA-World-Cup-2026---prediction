import React from 'react';
import { pct } from '../api';

const flags = { USA:'🇺🇸', Panama:'🇵🇦', Morocco:'🇲🇦', Portugal:'🇵🇹', Mexico:'🇲🇽', Argentina:'🇦🇷', France:'🇫🇷', Spain:'🇪🇸', Brazil:'🇧🇷', England:'🏴', Canada:'🇨🇦' };
export default function MatchCard({ match }) {
  const color = match.confidence_score > .18 ? 'bg-emerald-500' : match.confidence_score > .08 ? 'bg-amber-400' : 'bg-rose-500';
  return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl"><div className="flex items-center justify-between text-sm text-slate-400"><span>{new Date(match.match_date).toLocaleString()}</span><span>{match.venue}</span></div><div className="mt-4 flex items-center justify-between text-xl font-bold"><span>{flags[match.team_a] || '🏳️'} {match.team_a}</span><span className="rounded-xl bg-slate-800 px-4 py-2">{match.most_likely_scoreline}</span><span>{match.team_b} {flags[match.team_b] || '🏳️'}</span></div><div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm"><span>A {pct(match.win_prob_a)}</span><span>Draw {pct(match.draw_prob)}</span><span>B {pct(match.win_prob_b)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-500" style={{width: pct(match.win_prob_a)}} /></div><span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold text-slate-950 ${color}`}>Confidence {pct(match.confidence_score)}</span></div>;
}
