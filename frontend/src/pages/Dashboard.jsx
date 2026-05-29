import React, { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import MatchCard from '../components/MatchCard';
import AccuracyTracker from '../components/AccuracyTracker';
import TournamentBracket from '../components/TournamentBracket';

export default function Dashboard() {
  const [predictions, setPredictions] = useState([]); const [sim, setSim] = useState([]); const [accuracy, setAccuracy] = useState(null); const [error, setError] = useState('');
  useEffect(() => { Promise.all([api('/predictions'), api('/tournament/simulate'), api('/accuracy')]).then(([p,s,a]) => { setPredictions(p); setSim(s); setAccuracy(a); }).catch(e => setError(e.message)); }, []);
  const top = sim.slice(0, 8).map(t => ({...t, win: Math.round(t.win_probability * 1000) / 10}));
  return <div className="space-y-8"><div><h1 className="text-4xl font-black">Tournament Dashboard</h1><p className="text-slate-400">Live prediction overview, Monte Carlo title odds, and accuracy telemetry.</p></div>{error && <div className="rounded bg-rose-900 p-4">{error}</div>}<div className="grid grid-cols-3 gap-6"><div className="col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-4 text-xl font-bold">Top 8 title probabilities</h2><ResponsiveContainer width="100%" height={260}><BarChart data={top}><XAxis dataKey="team" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/><Tooltip/><Bar dataKey="win" fill="#34d399"/></BarChart></ResponsiveContainer></div><AccuracyTracker accuracy={accuracy}/></div><section><h2 className="mb-4 text-xl font-bold">Next 5 matches</h2><div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{predictions.slice(0,5).map(m => <MatchCard key={m.match_id} match={m}/>)}</div></section><section><h2 className="mb-4 text-xl font-bold">Projected knockout bracket</h2><TournamentBracket teams={sim}/></section><p className="text-xs text-slate-500">Last sync: {new Date().toLocaleString()}</p></div>;
}
