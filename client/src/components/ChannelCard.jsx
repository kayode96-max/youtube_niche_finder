import { formatNumber, formatPercent, formatCadence, formatMonths } from '../lib/format.js';

// The core channel result card: avatar + name, the v1 "signal bar" (subs / views
// / videos), derived metric chips when enriched, and the action row (bookmark,
// preview videos, analyze, plan, compare). Analysis renders inline when present.
export default function ChannelCard({
  channel,
  isBookmarked,
  inCompare,
  analyzing,
  analysis,
  onBookmark,
  onOpenVideos,
  onAnalyze,
  onPlan,
  onToggleCompare,
}) {
  const m = channel.metrics;
  const handle = channel.customUrl ? `@${channel.customUrl.replace(/^@/, '')}` : channel.country || '';

  return (
    <div className="card">
      <div className="card-head">
        <img className="avatar" src={channel.thumb || ''} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        <div className="card-title">
          <a className="name" href={`https://www.youtube.com/channel/${channel.id}`} target="_blank" rel="noopener noreferrer" title={channel.title}>{channel.title}</a>
          <div className="handle">{handle}</div>
        </div>
        <button
          className={`iconbtn ${isBookmarked ? 'active' : ''}`}
          title={isBookmarked ? 'Bookmarked' : 'Bookmark channel'}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark channel'}
          onClick={() => onBookmark(channel)}
        >{isBookmarked ? '★' : '☆'}</button>
      </div>

      {channel.description && <div className="card-desc">{channel.description}</div>}

      <div className="signal-bar">
        <div className="signal-cell"><div className="val">{channel.subs == null ? '—' : formatNumber(channel.subs)}</div><div className="lbl">Subs</div></div>
        <div className="signal-cell"><div className="val">{formatNumber(channel.views)}</div><div className="lbl">Views</div></div>
        <div className="signal-cell"><div className="val">{formatNumber(channel.videos)}</div><div className="lbl">Videos</div></div>
      </div>

      {m && (
        <div className="metric-row">
          <span className="metric" title="Upload cadence"><span className="m-ico">⟳</span>{formatCadence(m.uploadsPerWeek)}</span>
          <span className="metric" title="Avg engagement rate"><span className="m-ico">♥</span>{formatPercent(m.engagementRate, 1)}</span>
          <span className="metric" title="Share of Shorts"><span className="m-ico">▮</span>{m.shortsPct == null ? '—' : `${Math.round(m.shortsPct)}% short`}</span>
          <span className="metric" title="Channel age"><span className="m-ico">◷</span>{formatMonths(m.ageMonths)}</span>
        </div>
      )}

      <div className="card-actions">
        <button className="btn sm ghost" onClick={() => onOpenVideos(channel)}>▶ Videos</button>
        <button className="btn sm ghost" onClick={() => onAnalyze(channel)} disabled={analyzing}>
          {analyzing ? <><span className="spinner" /> Analyzing</> : '⚡ Analyze'}
        </button>
        <button className="btn sm ghost" onClick={() => onPlan(channel)} title="Build a growth & monetization plan">◆ Plan</button>
        <button className={`iconbtn ${inCompare ? 'active' : ''}`} title="Add to compare" aria-label="Add to compare" onClick={() => onToggleCompare(channel)}>⇄</button>
      </div>

      {analysis && <AnalysisPanel analysis={analysis} onPlan={() => onPlan(channel)} />}
    </div>
  );
}

function List({ title, items }) {
  if (!items || !items.length) return null;
  return (
    <div className="analysis-list">
      <h4>{title}</h4>
      <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

function AnalysisPanel({ analysis, onPlan }) {
  return (
    <div className="analysis-panel">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="score-ring">
          {analysis.score != null && <span className="num">{analysis.score}</span>}
          <div>
            <div className="eyebrow">Signal read</div>
            <div style={{ fontSize: 13 }}>{analysis.verdict}</div>
          </div>
        </div>
      </div>
      {analysis.contentStrategy && <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 12px' }}>{analysis.contentStrategy}</p>}
      <div className="analysis-cols">
        <List title="Strengths" items={analysis.strengths} />
        <List title="Weaknesses" items={analysis.weaknesses} />
        <List title="Opportunities" items={analysis.opportunities} />
        <List title="Risks" items={analysis.risks} />
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn sm" onClick={onPlan}>◆ Build growth & monetization plan</button>
      </div>
    </div>
  );
}
