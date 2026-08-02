import React, { useMemo, useState } from 'react';
import AsyncState from '../components/AsyncState';
import { stageName } from '../api';
import { useReplayData } from '../data/ReplayDataContext';

export default function Accuracy() {
  const { data, error, loading, retry } = useReplayData();
  const accuracy = data?.accuracy;
  const [activePoint, setActivePoint] = useState(null);
  const stageRows = useMemo(() => {
    const groups = new Map();
    (data?.predictions || []).forEach((match) => {
      const row = groups.get(match.stage) || { stage: match.stage, total: 0, correct: 0 };
      row.total += 1;
      row.correct += Number(match.predicted_winner === match.actual_winner);
      groups.set(match.stage, row);
    });
    return [...groups.values()].map((row) => ({ ...row, pct: row.total ? row.correct / row.total * 100 : 0 }));
  }, [data]);
  return (
    <div className="route-page accuracy-page">
      <header className="route-hero page-shell" data-reveal="route-hero"><p className="section-index">ATLAS INDEX / 03</p><p className="kicker">Transparent evaluation</p><h1>Where the model<br /><em>held its line.</em></h1><p>Outcome accuracy asks one narrow question: did the most likely model outcome match the recorded winner or draw? It does not grade the exact score.</p></header>
      <section className="page-shell accuracy-story">
        <AsyncState loading={loading} error={!data ? error : ''} empty={!accuracy} onRetry={retry}>
          {accuracy && <>
            <div className="headline-metric" data-reveal="metric"><p>Overall outcome accuracy</p><strong data-count={accuracy.accuracy_percentage} data-decimals="1" data-suffix="%">{accuracy.accuracy_percentage.toFixed(1)}%</strong><div><b data-count={accuracy.correct}>{accuracy.correct}</b> correct calls<br />from {accuracy.total_predictions} completed matches</div></div>
            <div className="accuracy-comparison">
              <Metric label="Group stage" value={accuracy.group_stage_accuracy} note="Repeated opponents and draws make three-way calls visible." />
              <Metric label="Knockout rounds" value={accuracy.knockout_accuracy} note="Recorded shoot-out winners count as the match outcome here." />
            </div>
            <AccuracyLine history={accuracy.history} activePoint={activePoint} onPoint={setActivePoint} />
            <section className="stage-ledger" aria-labelledby="stage-ledger-title"><div><p className="section-index">THE ROUND-BY-ROUND LEDGER</p><h2 id="stage-ledger-title">Performance changes with the shape of the tournament.</h2><p>Small late-round samples can move sharply. Counts are shown beside percentages to keep that context intact.</p></div><table><caption className="sr-only">Accuracy by tournament stage</caption><thead><tr><th>Stage</th><th>Correct</th><th>Matches</th><th>Accuracy</th></tr></thead><tbody>{stageRows.map((row) => <tr key={row.stage}><th>{stageName(row.stage)}</th><td>{row.correct}</td><td>{row.total}</td><td><b>{row.pct.toFixed(1)}%</b></td></tr>)}</tbody></table></section>
            <aside className="limits-block"><p className="section-index">WHAT THIS LEAVES OUT</p><h2>Accuracy alone is not calibration.</h2><p>These numbers do not test exact-score quality, whether 60% events happened six times in ten, input availability before kick-off, or future-tournament performance. Many legacy contextual fields use neutral defaults.</p></aside>
          </>}
        </AsyncState>
      </section>
    </div>
  );
}

function Metric({ label, value, note }) {
  return <article><span>{label}</span><strong>{value.toFixed(1)}%</strong><i><b style={{ width: `${value}%` }} /></i><p>{note}</p></article>;
}

function AccuracyLine({ history, activePoint, onPoint }) {
  const points = history.map((point, index) => `${48 + index * (824 / Math.max(history.length - 1, 1))},${244 - point.accuracy * 2}`).join(' ');
  const last = history[history.length - 1];
  const interactive = history.map((point, index) => ({ ...point, index })).filter((point) => point.index % 8 === 0 || point.index === history.length - 1);
  const selected = activePoint == null ? last : history[activePoint];
  return (
    <figure className="accuracy-chart" data-reveal="chart">
      <figcaption><div><p className="section-index">RUNNING ACCURACY</p><h2>Every call changes the line.</h2></div><p>Cumulative percentage after each recorded match. The final point is {last?.accuracy?.toFixed(1) || '0.0'}%.</p></figcaption>
      <div className="chart-readout" aria-live="polite"><span>{activePoint == null ? 'FINAL READING' : `MATCH ${String(activePoint + 1).padStart(2, '0')}`}</span><b>{selected?.accuracy?.toFixed(1) || '0.0'}%</b><small>{selected?.stage ? stageName(selected.stage) : 'No recorded point'}</small></div>
      <svg viewBox="0 0 920 300" role="img" aria-labelledby="accuracy-chart-title" aria-describedby="accuracy-chart-desc">
        <title id="accuracy-chart-title">Running model outcome accuracy</title><desc id="accuracy-chart-desc">A line chart of cumulative accuracy across {history.length} matches, ending at {last?.accuracy?.toFixed(1)} percent.</desc>
        {[25, 50, 75, 100].map((tick) => <g key={tick}><line x1="48" x2="872" y1={244 - tick * 2} y2={244 - tick * 2} /><text x="8" y={248 - tick * 2}>{tick}%</text></g>)}
        <polyline pathLength="1" points={points} />{interactive.map((point) => <circle key={point.index} className={activePoint === point.index ? 'is-active' : ''} tabIndex="0" role="button" aria-label={`Match ${point.index + 1}, ${point.accuracy.toFixed(1)} percent running accuracy, ${stageName(point.stage)}`} cx={48 + point.index * (824 / Math.max(history.length - 1, 1))} cy={244 - point.accuracy * 2} r="5" onFocus={() => onPoint(point.index)} onBlur={() => onPoint(null)} onPointerDown={() => onPoint(point.index)} />)}<line className="axis" x1="48" x2="872" y1="244" y2="244" /><text x="48" y="274">MATCH 01</text><text x="872" y="274" textAnchor="end">MATCH {String(history.length).padStart(2, '0')}</text>
      </svg>
    </figure>
  );
}
