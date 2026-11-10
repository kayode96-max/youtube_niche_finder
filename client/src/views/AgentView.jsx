import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import ChannelCard from '../components/ChannelCard.jsx';
import Banner from '../components/Banner.jsx';

// Convert a scout shortlist item (channelId + rationale) into the channel shape
// ChannelCard/bookmarks/compare expect. The agent already hydrated real stats.
function asChannel(item) {
  return {
    id: item.channelId,
    title: item.title,
    thumb: item.thumb,
    subs: item.subs,
    views: item.views,
    videos: item.videos,
    country: item.country,
  };
}

const EXAMPLES = [
  'underserved channels teaching Excel to accountants',
  'calm faceless history explainers under 100k subs',
  'high-CPM personal finance for gen z',
  'solo devs building AI tools with strong engagement',
];

// Phase 6 view — entry point (a): natural-language scouting. Free-text intent →
// the Gemini agent gathers REAL data via tools and returns a grounded shortlist.
export default function AgentView({ bookmarks, compare, onOpenVideos, onPlan }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null); // { summary, shortlist, consideredCount }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const [analyzing, setAnalyzing] = useState({});
  const [analyses, setAnalyses] = useState({});

  useEffect(() => {
    api.agentStatus().then(setStatus).catch(() => {});
  }, [result]);

  async function scout(q = query) {
    const text = q.trim();
    if (!text) { setError({ message: 'Describe what you’re scouting for.', hint: 'e.g. "underserved channels teaching Excel to accountants".' }); return; }
    setLoading(true); setError(null);
    try {
      const r = await api.scout(text);
      setResult(r);
    } catch (e) {
      setError(e); setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function analyze(channel) {
    setAnalyzing((a) => ({ ...a, [channel.id]: true }));
    try {
      const r = await api.analyze(channel.id);
      setAnalyses((a) => ({ ...a, [channel.id]: r.analysis }));
    } catch (e) {
      setError(e);
    } finally {
      setAnalyzing((a) => ({ ...a, [channel.id]: false }));
    }
  }

  return (
    <div>
      <div className="eyebrow">AI scout · powered by Gemini</div>
      <h1 style={{ marginBottom: 4 }}>Describe the signal you're hunting for</h1>
      <p className="muted" style={{ margin: '0 0 18px', maxWidth: 620 }}>
        Plain language in, a grounded shortlist out. The agent pulls real channels through the backend proxy,
        weighs their stats, and reports back — no keys ever touch the browser.
      </p>

      <div className="agent-hero">
        <textarea
          className="agent-input"
          placeholder="e.g. underserved channels teaching Excel to accountants, still small but growing fast…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) scout(); }}
          rows={3}
        />
        <div className="row wrap" style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <div className="chips">
            {EXAMPLES.map((ex) => (
              <button key={ex} className="chip" onClick={() => { setQuery(ex); scout(ex); }} disabled={loading}>{ex}</button>
            ))}
          </div>
          <button className="btn primary" onClick={() => scout()} disabled={loading}>
            {loading ? <><span className="spinner" /> Scouting</> : '◎ Scout the niche'}
          </button>
        </div>
        {status && (
          <div className="mono muted" style={{ fontSize: 11, marginTop: 8 }}>
            {status.remaining} / {status.cap} agent calls remaining today on this device.
          </div>
        )}
      </div>

      {error && <Banner kind={error.status === 429 ? 'warn' : 'error'} title={error.message} hint={error.hint} onClose={() => setError(null)} />}

      {loading && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="row"><span className="spinner" /> <span className="muted">The agent is pulling real channels and weighing the evidence… this can take a few seconds.</span></div>
        </div>
      )}

      {!loading && result && (
        <div style={{ marginTop: 20 }}>
          {result.summary && (
            <div className="agent-summary">
              <div className="eyebrow">Signal read</div>
              <p>{result.summary}</p>
              <div className="mono muted" style={{ fontSize: 11 }}>Considered {result.consideredCount} channel{result.consideredCount === 1 ? '' : 's'} · shortlisted {result.shortlist.length}</div>
            </div>
          )}

          {result.shortlist.length === 0 ? (
            <div className="state">
              <div className="big">No confident shortlist.</div>
              <div className="sub">The agent couldn't ground a shortlist for that query. Try describing the niche more concretely, or scan it directly from Search.</div>
            </div>
          ) : (
            <div className="grid">
              {result.shortlist.map((item) => {
                const channel = asChannel(item);
                return (
                  <div className="scout-item" key={item.channelId}>
                    <div className="scout-why">
                      <span className="scout-badge">Why</span>
                      <p>{item.why}</p>
                      {item.signals?.length > 0 && (
                        <div className="chips">
                          {item.signals.map((s, i) => <span key={i} className="chip static">{s}</span>)}
                        </div>
                      )}
                    </div>
                    <ChannelCard
                      channel={channel}
                      isBookmarked={bookmarks.isBookmarked('channel', channel.id)}
                      inCompare={compare.has(channel.id)}
                      analyzing={analyzing[channel.id]}
                      analysis={analyses[channel.id]}
                      onBookmark={bookmarks.toggleChannel}
                      onOpenVideos={onOpenVideos}
                      onAnalyze={analyze}
                      onPlan={(c) => onPlan({ channelId: c.id, query, title: c.title })}
                      onToggleCompare={compare.toggle}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loading && !result && !error && (
        <div className="state">
          <div className="tally tally-lg" />
          <div className="big">The dial is quiet.</div>
          <div className="sub">Describe a niche above and the agent will scout it for you — grounded in real channel data, not guesses.</div>
        </div>
      )}
    </div>
  );
}
