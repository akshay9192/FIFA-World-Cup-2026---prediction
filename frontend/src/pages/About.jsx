import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import AsyncState from '../components/AsyncState';

export default function About() {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setMeta(await api('/meta')); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="page-section">
      <p className="eyebrow">Method, provenance, limits</p>
      <h1 className="page-title">What the model knows—and what it does not</h1>
      <p className="lead">Plain-language context for interpreting the replay responsibly.</p>
      <div className="mt-8">
        <AsyncState loading={loading} error={error} empty={!meta} onRetry={load}>
          {meta && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Info title="Methodology"><p>{meta.model.method}</p><p>The output is a probability distribution, not a promise. Confidence is the gap between the two most likely outcomes.</p></Info>
              <Info title="Limitations"><p>{meta.model.limitations}</p><p>Having many possible database fields does not make a model accurate; input quality, validation, calibration, and honest out-of-sample testing matter more.</p></Info>
              <Info title="Verified historical data"><p>Teams, groups, fixtures, venues, dates, and results in the offline replay are transcribed from the attributed tournament results page.</p><p>{meta.datetime_note}</p><a className="font-bold text-mint-300 hover:text-mint-400" href={meta.source_url} target="_blank" rel="noreferrer">Open the source page</a></Info>
              <Info title="Experimental model inputs"><p>{meta.model_input_note}</p><p>Model-generated probabilities, user predictions, and user-entered what-if scores are kept visibly distinct from verified results.</p></Info>
              <Info title="Update record"><p>Source: {meta.source_name}</p><p>Last verified: {meta.last_verified_utc}</p><p>{meta.license_note}</p></Info>
              <Info title="Independence"><p>{meta.disclaimer}</p><p>This project uses original interface styling and does not include FIFA logos, photographs, video, or tournament artwork.</p></Info>
            </div>
          )}
        </AsyncState>
      </div>
    </section>
  );
}

function Info({ title, children }) {
  return <article className="panel"><h2 className="text-xl font-black">{title}</h2><div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">{children}</div></article>;
}
