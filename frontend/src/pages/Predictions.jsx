import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import PredictionTable from '../components/PredictionTable';

export default function Predictions() { const [matches, setMatches] = useState([]); const [error, setError] = useState(''); useEffect(() => { api('/predictions').then(setMatches).catch(e => setError(e.message)); }, []); const groups = useMemo(() => matches.reduce((acc,m) => { (acc[m.stage] ||= []).push(m); return acc; }, {}), [matches]); return <div><h1 className="text-4xl font-black">Predictions</h1><p className="mb-6 text-slate-400">Click a row to inspect all 100 model parameter contribution deltas.</p>{error && <div className="mb-4 rounded bg-rose-900 p-4">{error}</div>}{Object.entries(groups).map(([stage, rows]) => <section key={stage} className="mb-8"><h2 className="mb-3 text-2xl font-bold uppercase text-emerald-300">{stage}</h2><PredictionTable matches={rows}/></section>)}</div>; }
