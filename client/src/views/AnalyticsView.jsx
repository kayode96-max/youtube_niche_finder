import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Banner from '../components/Banner.jsx';
import { LineChart, BarChart } from '../components/Charts.jsx';
import { formatNumber, formatPercent, formatCadence } from '../lib/format.js';

const COLORS = ['#FFB300', '#5AA9E6', '#3DDC84'];

function median(nums) {
  const a = nums.filter((n) => n != null && Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

// Phase 5 view: per-channel trends + side-by-side compare (up to 3) + aggregate
// stats. Charts are the bespoke SVG primitives (no chart library).
export default function AnalyticsView({ compare }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const ids = compare.items.map((c) => c.id);
  const idKey = ids.join(',');

  useEffect(() => {
    if (!ids.length) { setData(null); return; }
    let alive = true;
    setLoading(true); setError(null);
    api.analyticsCompare(ids)
      .then((r) => { if (alive) setData(r.channels); })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [idKey]);

  if (!compare.items.length) {
    return (
      <div>
        <div className="eyebrow">Signal analysis</div>
        <h1 style={{ marginBottom: 16 }}>Analytics</h1>
        <div className="state">
          <div className="tally tally-lg" />
          <div className="big">No channels queued.</div>
          <div className="sub">Add up to 3 channels from the scout (the ⇄ button on any card) to chart their view-count trend, upload cadence, and engagement — and compare them side by side.</div>
        </div>
      </div>
    );
  }

  const viewSeries = (data || []).map((d, i) => ({
    name: d.channel.title, color: COLORS[i % 3],
    points: d.series.map((p) => ({ y: p.views })),
  }));
  const engSeries = (data || []).map((d, i) => ({
    name: d.channel.title, color: COLORS[i % 3],
    points: d.series.map((p) => ({ y: p.engagement * 100 })),
  }));

  const aggSubs = median((data || []).map((d) => d.channel.subs));
  const aggViews = median((data || []).map((d) => d.metrics?.avgRecentViews));
  const aggEng = median((data || []).map((d) => d.metrics?.engagementRate));

  return (
    <div>
      <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="eyebrow">Signal analysis</div>
          <h1>Analytics</h1>
        </div>
        <button className="btn sm ghost" onClick={compare.clear}>Clear all</button>
      </div>

      <div className="compare-pick">
        {compare.items.map((c, i) => (
          <span className="pick" key={c.id}>
            <span className="dot on" style={{ background: COLORS[i % 3], boxShadow: `0 0 6px ${COLORS[i % 3]}` }} />
            {c.thumb && <img src={c.thumb} alt="" />}
            {c.title}
            <button className="muted" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => compare.remove(c.id)}>×</button>
          </span>
        ))}
      </div>

      {error && <Banner kind="error" title={error.message} hint={error.hint} onClose={() => setError(null)} />}
      {loading && <div className="panel"><div className="row"><span className="spinner" /> <span className="muted">Pulling series through the cache…</span></div></div>}

      {!loading && data && (
        <div className="analytics-grid">
          <div className="panel">
            <div className="panel-head"><h3>Aggregate — median across {data.length} channel{data.length > 1 ? 's' : ''}</h3></div>
            <div className="stat-cards">
              <div className="stat-card"><div className="k">Median subs</div><div className="v">{formatNumber(aggSubs)}</div></div>
              <div className="stat-card"><div className="k">Median avg views</div><div className="v">{formatNumber(aggViews)}</div></div>
              <div className="stat-card"><div className="k">Median engagement</div><div className="v">{aggEng != null ? formatPercent(aggEng, 1) : '—'}</div></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>View-count trend</h3><span className="muted mono" style={{ fontSize: 11 }}>recent uploads, oldest → newest</span></div>
            <LineChart series={viewSeries} yFormat={(v) => formatNumber(v)} height={200} />
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Engagement-rate trend</h3><span className="muted mono" style={{ fontSize: 11 }}>(likes + comments) ÷ views</span></div>
            <LineChart series={engSeries} yFormat={(v) => `${v.toFixed(1)}%`} height={200} />
          </div>

          {data.map((d, i) => (
            <div className="panel" key={d.channel.id}>
              <div className="panel-head">
                <span className="dot on" style={{ background: COLORS[i % 3], boxShadow: `0 0 6px ${COLORS[i % 3]}` }} />
                <h3>{d.channel.title} — upload cadence</h3>
                <span className="muted mono" style={{ fontSize: 11 }}>{formatCadence(d.metrics?.uploadsPerWeek)}</span>
              </div>
              {d.cadenceTimeline?.length > 0
                ? <BarChart bars={d.cadenceTimeline.map((g) => ({ value: g.gapDays, color: COLORS[i % 3] }))} yFormat={(v) => `${Math.round(v)}d`} height={130} />
                : <div className="muted mono" style={{ fontSize: 12 }}>Not enough uploads to chart cadence.</div>}
              <div className="muted mono" style={{ fontSize: 11, marginTop: 6 }}>Gap (days) between consecutive uploads</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
