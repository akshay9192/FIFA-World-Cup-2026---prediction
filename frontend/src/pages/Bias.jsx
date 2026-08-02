import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, formatDate, formatPercent } from '../api';
import AsyncState from '../components/AsyncState';
import { useReplayData } from '../data/ReplayDataContext';

export default function Bias() {
  const { data, error: replayError, loading: replayLoading, retry: retryReplay } = useReplayData();
  const matches = useMemo(() => data?.predictions || [], [data?.predictions]);
  const [confederation, setConfederation] = useState('ALL');
  const confederations = useMemo(() => ['ALL', ...new Set((data?.teams || []).map((team) => team.confederation))], [data?.teams]);
  const teamConfederation = useMemo(() => new Map((data?.teams || []).map((team) => [team.name, team.confederation])), [data?.teams]);
  const focusedMatches = useMemo(() => confederation === 'ALL' ? matches : matches.filter((item) => teamConfederation.get(item.team_a) === confederation || teamConfederation.get(item.team_b) === confederation), [confederation, matches, teamConfederation]);
  const [summary, setSummary] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [confidence, setConfidence] = useState(5);
  const [emotion, setEmotion] = useState(5);
  const [pick, setPick] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { setError(''); try { setSummary(await api('/bias')); } catch (requestError) { setError(requestError.message); } }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => setSelectedId((current) => current || String(matches[0]?.match_id || '')), [matches]);
  useEffect(() => { if (focusedMatches.length && !focusedMatches.some((item) => String(item.match_id) === selectedId)) { setSelectedId(String(focusedMatches[0].match_id)); setPick(''); setRevealed(false); } }, [focusedMatches, selectedId]);
  const match = useMemo(() => matches.find((item) => String(item.match_id) === selectedId), [matches, selectedId]);
  const retry = useCallback(() => { retryReplay(); load(); }, [load, retryReplay]);
  function changeMatch(event) { setSelectedId(event.target.value); setPick(''); setRevealed(false); setMessage(''); }
  async function save() {
    if (!match || !pick) { setMessage('Choose an outcome before revealing the result.'); return; }
    setSaving(true); setMessage('');
    try {
      await api('/bias', { method: 'POST', body: JSON.stringify({ match_id: match.match_id, user_prediction: pick, user_confidence: confidence, emotional_investment: emotion }) });
      setSummary(await api('/bias')); setRevealed(true);
      setMessage(pick === match.actual_winner ? 'You matched the recorded outcome.' : `The recorded outcome was ${match.actual_winner}.`);
    } catch (requestError) { setMessage(requestError.message); } finally { setSaving(false); }
  }
  return (
    <div className="route-page bias-page">
      <header className="route-hero page-shell" data-reveal="route-hero"><p className="section-index">ATLAS INDEX / 04</p><p className="kicker">Looking for blind spots</p><h1>Your instinct,<br /><em>under floodlights.</em></h1><p>Make a historical call before the score is revealed. Record confidence and emotional investment, then compare your outcome with the model.</p></header>
      <section className="page-shell bias-explainer"><div><span>Measures</span><p>Your selected outcome, self-reported confidence, emotional investment, and whether your pick matched the recorded result.</p></div><div><span>Does not measure</span><p>Protected-class fairness, causal bias, psychological traits, or whether the model is safe and equitable in other settings.</p></div><div className="warning"><span>Important limitation</span><p>This small, self-selected interaction cannot support a fairness guarantee.</p></div></section>
      <section className="page-shell bias-workbench">
        <div className="confederation-focus" data-reveal="rule"><div><span>FOCUS THE MATCH POOL</span><p>This changes which historical matches are offered. It does not calculate a confederation fairness score.</p></div><div role="group" aria-label="Focus matches by confederation">{confederations.map((value) => <button key={value} type="button" aria-pressed={confederation === value} onClick={() => setConfederation(value)}>{value}</button>)}</div></div>
        <AsyncState loading={replayLoading && !matches.length} error={!matches.length ? replayError || error : ''} empty={!replayLoading && !matches.length} onRetry={retry}>
          {error && matches.length > 0 && <div className="inline-alert" role="alert">Live comparison totals unavailable. {error} <button type="button" onClick={load}>Retry totals</button></div>}
          {match && <div className="bias-grid">
            <div key={confederation} className="prediction-slip">
              <div className="slip-header"><span>PREDICTION SLIP</span><b>M{String(match.match_id).padStart(3, '0')}</b></div>
              <label className="select-match"><span>Historical match · {confederation === 'ALL' ? 'all confederations' : confederation}</span><select value={selectedId} onChange={changeMatch}>{focusedMatches.map((item) => <option key={item.match_id} value={item.match_id}>{item.team_a} vs {item.team_b} · {formatDate(item.match_date)}</option>)}</select></label>
              <div className="bias-match"><div><span>{match.team_a}</span><b>{formatPercent(match.win_prob_a)}</b></div><div><span>Draw</span><b>{formatPercent(match.draw_prob)}</b></div><div><span>{match.team_b}</span><b>{formatPercent(match.win_prob_b)}</b></div></div>
              <p className="model-pick">MODEL PICK <strong>{match.predicted_winner}</strong></p>
              <fieldset className="outcome-picker"><legend>01 / Your outcome</legend><div>{[match.team_a, 'Draw', match.team_b].map((value) => <button key={value} type="button" aria-pressed={pick === value} onClick={() => setPick(value)}>{value}</button>)}</div></fieldset>
              <div className="slider-pair"><Slider label="02 / Confidence" value={confidence} onChange={setConfidence} low="Guess" high="Certain" /><Slider label="03 / Emotional investment" value={emotion} onChange={setEmotion} low="None" high="High" /></div>
              <button className="button-primary lock-button" type="button" onClick={save} disabled={saving}>{saving ? 'Saving your call…' : 'Lock call & reveal result'}</button>
              {message && <p className="slip-message" role="status">{message}</p>}
              {revealed && <div className="recorded-result"><span>RECORDED RESULT</span><p>{match.team_a} <b>{match.actual_score_a}–{match.actual_score_b}</b> {match.team_b}</p>{match.result_note && <small>{match.result_note}</small>}</div>}
            </div>
            <aside className="comparison-board"><p className="section-index">COMPARISON BOARD</p><h2>You vs the model</h2><div><span><small>Your correct calls</small><b>{summary?.user_correct || 0}</b></span><i>:</i><span><small>Model correct calls</small><b>{summary?.model_correct || 0}</b></span></div><p>Based on {summary?.completed_comparisons || 0} revealed comparisons stored in this database. It is a personal activity log, not a representative sample.</p></aside>
          </div>}
        </AsyncState>
      </section>
    </div>
  );
}

function Slider({ label, value, onChange, low, high }) {
  return <label><span>{label}<b>{value}/10</b></span><input type="range" min="0" max="10" value={value} onChange={(event) => onChange(Number(event.target.value))} /><small><i>{low}</i><i>{high}</i></small></label>;
}
