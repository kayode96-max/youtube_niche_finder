import { TOPIC_OPTIONS } from '../lib/constants.js';

// The expanded filter set + sort. Controlled component: parent owns `filters`
// and `sort` state; this just renders inputs and calls setters. Mirrors the
// backend's filterAndSort keys exactly.
export default function FiltersSidebar({
  filters, setFilters, sort, setSort, language, setLanguage, region, setRegion, onApply, enriched,
}) {
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v === '' || v == null ? undefined : v }));
  const num = (v) => (v === '' || v == null ? undefined : Number(v));

  return (
    <aside className="sidebar">
      <div className="filter-group">
        <div className="group-label">Sort by</div>
        <select className="inp" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="relevance">Relevance</option>
          <option value="subs_desc">Subscribers ↓</option>
          <option value="subs_asc">Subscribers ↑</option>
          <option value="views_desc">Total views ↓</option>
          <option value="avg_desc">Avg views/video ↓</option>
          <option value="videos_desc">Video count ↓</option>
          <option value="engagement_desc">Engagement rate ↓</option>
          <option value="cadence_desc">Upload cadence ↓</option>
          <option value="newest">Newest channel</option>
          <option value="oldest">Oldest channel</option>
        </select>
      </div>

      <div className="filter-group">
        <div className="group-label">Subscribers</div>
        <div className="filter-row">
          <input className="inp mono" type="number" placeholder="min" value={filters.minSubs ?? ''} onChange={(e) => set('minSubs', num(e.target.value))} />
          <span className="sep">–</span>
          <input className="inp mono" type="number" placeholder="max" value={filters.maxSubs ?? ''} onChange={(e) => set('maxSubs', num(e.target.value))} />
        </div>
      </div>

      <div className="filter-group">
        <div className="group-label">Language / Region</div>
        <div className="filter-row">
          <select className="inp" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">Any language</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="pt">Portuguese</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="hi">Hindi</option>
            <option value="ar">Arabic</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="id">Indonesian</option>
          </select>
        </div>
        <div className="filter-row">
          <select className="inp" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Any region</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
            <option value="IN">India</option>
            <option value="NG">Nigeria</option>
            <option value="BR">Brazil</option>
            <option value="DE">Germany</option>
            <option value="JP">Japan</option>
          </select>
        </div>
      </div>

      <div className="filter-group">
        <div className="group-label">Upload cadence (videos/week)</div>
        <div className="filter-row">
          <input className="inp mono" type="number" step="0.5" placeholder="min" value={filters.minCadence ?? ''} onChange={(e) => set('minCadence', num(e.target.value))} />
          <span className="sep">–</span>
          <input className="inp mono" type="number" step="0.5" placeholder="max" value={filters.maxCadence ?? ''} onChange={(e) => set('maxCadence', num(e.target.value))} />
        </div>
        <div className="filter-hint">Uses recent uploads · triggers deep scan</div>
      </div>

      <div className="filter-group">
        <div className="group-label">Min engagement rate (%)</div>
        <div className="filter-row">
          <input className="inp mono" type="number" step="0.1" placeholder="e.g. 2" value={filters.minEngagement != null ? filters.minEngagement * 100 : ''} onChange={(e) => set('minEngagement', e.target.value === '' ? undefined : Number(e.target.value) / 100)} />
        </div>
        <div className="filter-hint">(likes + comments) ÷ views</div>
      </div>

      <div className="filter-group">
        <div className="group-label">Shorts mix (% short-form)</div>
        <div className="filter-row">
          <input className="inp mono" type="number" placeholder="min %" value={filters.shortsMin ?? ''} onChange={(e) => set('shortsMin', num(e.target.value))} />
          <span className="sep">–</span>
          <input className="inp mono" type="number" placeholder="max %" value={filters.shortsMax ?? ''} onChange={(e) => set('shortsMax', num(e.target.value))} />
        </div>
      </div>

      <div className="filter-group">
        <div className="group-label">Channel age (months)</div>
        <div className="filter-row">
          <input className="inp mono" type="number" placeholder="newer than" value={filters.ageNewerThanMonths ?? ''} onChange={(e) => set('ageNewerThanMonths', num(e.target.value))} />
        </div>
        <div className="filter-row">
          <input className="inp mono" type="number" placeholder="older than" value={filters.ageOlderThanMonths ?? ''} onChange={(e) => set('ageOlderThanMonths', num(e.target.value))} />
        </div>
      </div>

      <div className="filter-group">
        <div className="group-label">Topic / category</div>
        <div className="chips">
          {TOPIC_OPTIONS.map((t) => (
            <button
              key={t.key}
              className={`chip ${filters.topic === t.key ? 'on' : ''}`}
              onClick={() => set('topic', filters.topic === t.key ? undefined : t.key)}
            >{t.label}</button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <button className="btn primary" style={{ width: '100%' }} onClick={onApply}>Apply filters</button>
        <div className="filter-hint" style={{ marginTop: 8 }}>
          {enriched ? '◉ Deep scan active (recent-video metrics loaded)' : '○ Basic scan — advanced filters load recent videos'}
        </div>
      </div>
    </aside>
  );
}
