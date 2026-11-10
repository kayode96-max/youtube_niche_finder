import { useState } from 'react';
import { api } from '../lib/api.js';
import ChannelCard from '../components/ChannelCard.jsx';
import FiltersSidebar from '../components/FiltersSidebar.jsx';
import Banner from '../components/Banner.jsx';
import { formatNumber, formatPercent, formatCadence } from '../lib/format.js';

// Phase 1–2 view: the ported search pipeline with expanded filters + sorts.
// Enrichment (recent-video metrics) kicks in automatically when an advanced
// filter/sort needs it; the user can also force a deep scan.
export default function SearchView({ bookmarks, compare, onOpenVideos, onPlan }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState('relevance');
  const [language, setLanguage] = useState('');
  const [region, setRegion] = useState('');
  const [deepScan, setDeepScan] = useState(false);

  const [results, setResults] = useState(null); // { channels, aggregates, enriched }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastQuery, setLastQuery] = useState('');

  const [analyzing, setAnalyzing] = useState({});
  const [analyses, setAnalyses] = useState({});

  async function runSearch(overrides = {}) {
    const q = (overrides.query ?? query).trim();
    if (!q) { setError({ message: 'No niche entered.', hint: 'Type a keyword to scan for.' }); return; }
    setLoading(true); setError(null);
    try {
      const payload = {
        q, maxResults: 30, language, region,
        filters, sort, enrich: deepScan,
        ...overrides,
      };
      const r = await api.search(payload);
      setResults(r);
      setLastQuery(q);
    } catch (e) {
      setError(e); setResults(null);
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

  const agg = results?.aggregates;

  return (
    <>
      <div className="searchbar">
        <div className="field">
          <input
            type="text"
            placeholder="Scan a niche — e.g. “personal finance for gen z”, “solo travel japan”…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            autoFocus
          />
        </div>
        <button className="btn" onClick={() => setDeepScan((d) => !d)} title="Load recent-video metrics for every result">
          {deepScan ? '◉ Deep scan' : '○ Deep scan'}
        </button>
        <button className="btn primary" onClick={() => runSearch()} disabled={loading}>
          {loading ? <><span className="spinner" /> Scanning</> : 'Scan'}
        </button>
      </div>

      {error && <Banner kind={error.status === 429 ? 'warn' : 'error'} title={error.message} hint={error.hint} onClose={() => setError(null)} />}

      <div className="workspace">
        <FiltersSidebar
          filters={filters} setFilters={setFilters}
          sort={sort} setSort={setSort}
          language={language} setLanguage={setLanguage}
          region={region} setRegion={setRegion}
          enriched={results?.enriched}
          onApply={() => runSearch()}
        />

        <div>
          {results && (
            <div className="resultbar">
              <div className="count"><b>{results.channels.length}</b> channels on “{lastQuery}”</div>
              <div className="spacer" />
              {agg && agg.count > 0 && (
                <div className="aggregates">
                  <div className="agg"><span className="k">Median subs</span><span className="v">{formatNumber(agg.medianSubs)}</span></div>
                  <div className="agg"><span className="k">Median views</span><span className="v">{formatNumber(agg.medianViews)}</span></div>
                  {agg.medianEngagement != null && <div className="agg"><span className="k">Med engagement</span><span className="v">{formatPercent(agg.medianEngagement, 1)}</span></div>}
                  {agg.medianCadence != null && <div className="agg"><span className="k">Med cadence</span><span className="v">{formatCadence(agg.medianCadence)}</span></div>}
                </div>
              )}
              <button className="btn sm ghost" style={{ marginLeft: 12 }} onClick={() => onPlan({ query: lastQuery, aggregates: agg })}>
                ◆ Plan for this niche
              </button>
            </div>
          )}

          {loading && (
            <div className="grid">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton sk-card" />)}
            </div>
          )}

          {!loading && results && results.channels.length === 0 && (
            <div className="state">
              <div className="tally tally-lg" />
              <div className="big">No signal on that niche.</div>
              <div className="sub">Try a broader keyword, or loosen the filters — advanced filters can screen out every result if they’re too tight.</div>
            </div>
          )}

          {!loading && !results && (
            <div className="state">
              <div className="tally tally-lg" />
              <div className="big">No transmission yet.</div>
              <div className="sub">Scan a niche to pull channels through the backend proxy. Results are cached, so repeat scans are instant and don’t burn quota.</div>
            </div>
          )}

          {!loading && results && results.channels.length > 0 && (
            <div className="grid">
              {results.channels.map((ch) => (
                <ChannelCard
                  key={ch.id}
                  channel={ch}
                  isBookmarked={bookmarks.isBookmarked('channel', ch.id)}
                  inCompare={compare.has(ch.id)}
                  analyzing={analyzing[ch.id]}
                  analysis={analyses[ch.id]}
                  onBookmark={bookmarks.toggleChannel}
                  onOpenVideos={onOpenVideos}
                  onAnalyze={analyze}
                  onPlan={(c) => onPlan({ channelId: c.id, query: lastQuery, title: c.title })}
                  onToggleCompare={compare.toggle}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
