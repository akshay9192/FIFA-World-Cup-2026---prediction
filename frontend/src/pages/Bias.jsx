import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, formatDate, formatPercent } from '../api';
import AsyncState from '../components/AsyncState';

export default function Bias() {
  const [matches, setMatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [confidence, setConfidence] = useState(5);
  const [emotion, setEmotion] = useState(5);
  const [pick, setPick] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [predictionData, biasData] = await Promise.all([api('/predictions'), api('/bias')]);
      setMatches(predictionData);
      setSummary(biasData);
      setSelectedId((current) => current || String(predictionData[0]?.match_id || ''));
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const match = useMemo(() => matches.find((item) => String(item.match_id) === selectedId), [matches, selectedId]);

  function changeMatch(event) {
    setSelectedId(event.target.value);
    setPick('');
    setRevealed(false);
    setMessage('');
  }

  async function save() {
    if (!match || !pick) {
      setMessage('Choose an outcome before revealing the result.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await api('/bias', {
        method: 'POST',
        body: JSON.stringify({
          match_id: match.match_id,
          user_prediction: pick,
          user_confidence: confidence,
          emotional_investment: emotion,
        }),
      });
      setSummary(await api('/bias'));
      setRevealed(true);
      setMessage(pick === match.actual_winner ? 'You matched the recorded outcome.' : `The recorded outcome was ${match.actual_winner}.`);
    } catch (requestError) { setMessage(requestError.message); }
    finally { setSaving(false); }
  }

  return (
    <section className="page-section">
      <p className="eyebrow">What would you have predicted?</p>
      <h1 className="page-title">Put your instinct against the model</h1>
      <p className="lead">Pick a historical match, make your call before revealing the score, and see whether you or the model read it better.</p>
      <div className="mt-8">
        <AsyncState loading={loading} error={error} empty={!matches.length} onRetry={load}>
          {match && (
            <div className="grid gap-6 lg:grid-cols-[1.4fr_.6fr]">
              <div className="panel">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Historical match</span>
                  <select className="w-full rounded-xl border-white/15 bg-ink-950 text-white" value={selectedId} onChange={changeMatch}>
                    {matches.map((item) => <option key={item.match_id} value={item.match_id}>{item.team_a} vs {item.team_b} · {formatDate(item.match_date)}</option>)}
                  </select>
                </label>
                <div className="mt-7 text-center">
                  <p className="text-sm text-slate-400">Model prediction</p>
                  <h2 className="mt-2 text-2xl font-black">{match.predicted_winner}</h2>
                  <p className="mt-2 text-sm text-slate-400">{formatPercent(match.win_prob_a)} · {formatPercent(match.draw_prob)} · {formatPercent(match.win_prob_b)}</p>
                </div>
                <fieldset className="mt-7">
                  <legend className="text-sm font-bold">Your outcome</legend>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[match.team_a, 'Draw', match.team_b].map((value) => (
                      <button key={value} type="button" aria-pressed={pick === value} onClick={() => setPick(value)} className={pick === value ? 'button-primary px-2' : 'button-secondary px-2'}>{value}</button>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <Slider label="How confident are you?" value={confidence} onChange={setConfidence} />
                  <Slider label="Emotional investment" value={emotion} onChange={setEmotion} />
                </div>
                <button className="button-primary mt-7 w-full sm:w-auto" type="button" onClick={save} disabled={saving}>{saving ? 'Saving your call…' : 'Lock prediction & reveal result'}</button>
                {message && <p className="mt-4 text-sm text-mint-300" role="status">{message}</p>}
                {revealed && (
                  <div className="mt-5 rounded-xl border border-gold-400/20 bg-gold-400/[0.06] p-5 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-gold-300">Recorded result</p>
                    <p className="mt-2 text-3xl font-black">{match.team_a} {match.actual_score_a}–{match.actual_score_b} {match.team_b}</p>
                    {match.result_note && <p className="mt-2 text-sm text-gold-300">{match.result_note}</p>}
                  </div>
                )}
              </div>
              <aside className="panel h-fit">
                <p className="eyebrow">Scoreboard</p>
                <h2 className="mt-2 text-xl font-black">You vs model</h2>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-ink-950 p-4"><p className="text-sm text-slate-400">You</p><p className="stat-value">{summary?.user_correct || 0}</p></div>
                  <div className="rounded-xl bg-ink-950 p-4"><p className="text-sm text-slate-400">Model</p><p className="stat-value">{summary?.model_correct || 0}</p></div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-400">{summary?.completed_comparisons || 0} revealed comparisons stored in this database.</p>
              </aside>
            </div>
          )}
        </AsyncState>
      </div>
    </section>
  );
}

function Slider({ label, value, onChange }) {
  return (
    <label>
      <span className="flex justify-between gap-3 text-sm font-bold"><span>{label}</span><span>{value}/10</span></span>
      <input className="mt-3 w-full accent-mint-400" type="range" min="0" max="10" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
