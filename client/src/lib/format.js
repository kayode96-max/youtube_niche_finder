// Display helpers — ported from the v1 prototype so the copy/number voice
// stays identical across the rebuild.

export function formatNumber(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function formatDuration(sec) {
  if (!sec || sec < 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function relativeTime(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Engagement rate stored as a fraction (0..1). Show as a percentage.
export function formatPercent(frac, digits = 1) {
  if (frac == null || Number.isNaN(frac)) return '—';
  return (frac * 100).toFixed(digits) + '%';
}

export function formatCadence(perWeek) {
  if (perWeek == null || Number.isNaN(perWeek)) return '—';
  if (perWeek >= 1) return `${perWeek.toFixed(1)}/wk`;
  const perMonth = perWeek * 4.345;
  if (perMonth >= 1) return `${perMonth.toFixed(1)}/mo`;
  return '<1/mo';
}

export function formatMonths(months) {
  if (months == null || Number.isNaN(months)) return '—';
  if (months < 12) return `${Math.round(months)}mo`;
  const y = Math.floor(months / 12);
  const m = Math.round(months % 12);
  return m ? `${y}y ${m}mo` : `${y}y`;
}

export function channelUrl(id) { return `https://www.youtube.com/channel/${id}`; }
export function videoUrl(id) { return `https://www.youtube.com/watch?v=${id}`; }
