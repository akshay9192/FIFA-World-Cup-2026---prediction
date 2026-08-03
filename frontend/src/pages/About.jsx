import React from 'react';
import AsyncState from '../components/AsyncState';
import { useReplayData } from '../data/ReplayDataContext';

export default function About() {
  const { data, error, loading, retry } = useReplayData();
  const meta = data?.meta;
  return (
    <div className="route-page method-page">
      <header className="route-hero page-shell"><p className="section-index">ATLAS INDEX / 05</p><p className="kicker">Method, provenance, limits</p><h1>What the model<br /><em>can actually know.</em></h1><p>A plain-language field guide to the inputs, probability model, data source and boundaries of this experiment.</p></header>
      <section className="page-shell method-content"><AsyncState loading={loading} error={!data ? error : ''} empty={!meta} onRetry={retry}>{meta && <>
        <article className="method-lead"><span>01</span><div><p className="section-index">THE MECHANISM</p><h2>A lightweight path from strength estimates to three-way probability.</h2><p>{meta.model.method}</p></div><ol><li><b>Estimated inputs</b><span>Team strength and form establish an attacking expectation.</span></li><li><b>Goal matrix</b><span>A truncated Poisson score matrix estimates likely score combinations.</span></li><li><b>Three outcomes</b><span>Score combinations become home win, draw and away win probabilities.</span></li></ol></article>
        <div className="method-ledger"><Info number="02" title="Limitations"><p>{meta.model.limitations}</p><p>Many contextual fields use neutral defaults. A wide schema is not evidence of predictive power.</p></Info><Info number="03" title="Verified record"><p>Teams, groups, dates, venues and results in the offline replay are transcribed from the attributed tournament results page.</p><p>{meta.datetime_note}</p><a href={meta.source_url} target="_blank" rel="noopener noreferrer">Open attributed source ↗</a></Info><Info number="04" title="Experimental inputs"><p>{meta.model_input_note}</p><p>Model output, verified results and user-entered calls remain visibly distinct.</p></Info><Info number="05" title="Independence"><p>{meta.disclaimer}</p><p>This original interface includes no official logos, photography, video or tournament artwork.</p></Info></div>
        <aside className="provenance-line"><span>DATA RECORD</span><p>{meta.source_name}</p><p>Last verified {meta.last_verified_utc}</p><p>{meta.license_note}</p></aside>
      </>}</AsyncState></section>
    </div>
  );
}
function Info({ number, title, children }) { return <article><span>{number}</span><h2>{title}</h2><div>{children}</div></article>; }
