import { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Markdown from '../components/Markdown.jsx';
import Banner from '../components/Banner.jsx';
import { api } from '../lib/api.js';

// Entry point (c): the growth & monetization plan. Fired only by an explicit
// button click (never automatically — it's the long/expensive call). Renders the
// strategist report as markdown with the PERMANENT revenue disclaimer pinned
// both above and below, and offers a plain-text download.
export default function PlanModal({ request, onClose }) {
  const [data, setData] = useState(null); // { report, grounding, disclaimer }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null); setData(null);
    api.plan(request)
      .then((r) => { if (alive) setData(r); })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [JSON.stringify(request)]);

  const title = request.title
    ? `Growth & monetization plan — ${request.title}`
    : request.query
      ? `Growth & monetization plan — “${request.query}”`
      : 'Growth & monetization plan';

  function download() {
    if (!data?.report) return;
    const body = `${title}\n\n${data.disclaimer}\n\n${'='.repeat(60)}\n\n${data.report}\n\n${'='.repeat(60)}\n\n${data.disclaimer}\n`;
    const blob = new Blob([body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signal-growth-plan.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  const footer = data && (
    <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
      <span className="mono muted" style={{ fontSize: 11 }}>
        {data.grounding?.kind ? `Grounded on: ${groundingLabel(data.grounding)}` : ''}
      </span>
      <button className="btn sm" onClick={download}>⤓ Download plan</button>
    </div>
  );

  return (
    <Modal title={title} onClose={onClose} footer={footer}>
      {error && <Banner kind={error.status === 429 ? 'warn' : 'error'} title={error.message} hint={error.hint} />}

      {loading && (
        <div className="plan-loading">
          <div className="row"><span className="spinner" /> <span className="muted">Drafting the 7-part strategy — grounding it in real scouted data. This is the long call; give it a moment.</span></div>
          <div className="skeleton" style={{ height: 14, marginTop: 16, width: '40%' }} />
          <div className="skeleton" style={{ height: 10, marginTop: 10 }} />
          <div className="skeleton" style={{ height: 10, marginTop: 8 }} />
          <div className="skeleton" style={{ height: 10, marginTop: 8, width: '80%' }} />
        </div>
      )}

      {!loading && data && (
        <>
          <div className="disclaimer">⚠ {data.disclaimer}</div>
          <div className="report">
            <Markdown>{data.report}</Markdown>
          </div>
          <div className="disclaimer">⚠ {data.disclaimer}</div>
        </>
      )}
    </Modal>
  );
}

function groundingLabel(g) {
  if (g.kind === 'channel') return g.title || g.channelId || 'a channel';
  if (g.kind === 'aggregates') return g.niche ? `search aggregates · “${g.niche}”` : 'search aggregates';
  if (g.kind === 'niche') return g.niche ? `niche “${g.niche}”` : 'a niche keyword';
  return g.kind;
}
