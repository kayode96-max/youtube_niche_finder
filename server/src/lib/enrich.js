// Enrichment: attach derived metrics (cadence, engagement, shorts mix, topics)
// to channel records by fetching their recent videos, with a small concurrency
// pool. Also the server-side filter/sort/aggregate logic shared by the search
// route and the AI agent's tools.
import { getChannelRecentVideos } from './youtube.js';
import { computeChannelMetrics } from './metrics.js';

const SAMPLE = 12; // recent videos per channel used for metrics

async function pool(items, worker, concurrency = 6) {
  const results = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { results[idx] = await worker(items[idx], idx); }
      catch { results[idx] = null; }
    }
  });
  await Promise.all(runners);
  return results;
}

/** Attach `.metrics` and `.recentVideos` to each channel (mutates copies). */
export async function enrichChannels(channels, { sample = SAMPLE, concurrency = 6 } = {}) {
  const enriched = await pool(channels, async (ch) => {
    const videos = await getChannelRecentVideos(ch, sample).catch(() => []);
    return { ...ch, recentVideos: videos, metrics: computeChannelMetrics(ch, videos) };
  }, concurrency);
  return enriched.map((c, idx) => c || { ...channels[idx], recentVideos: [], metrics: null });
}

function median(nums) {
  const arr = nums.filter((n) => n != null && Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

/** Median subs / views / engagement / cadence across a result set. */
export function aggregates(channels) {
  return {
    count: channels.length,
    medianSubs: median(channels.map((c) => c.subs)),
    medianViews: median(channels.map((c) => c.views)),
    medianEngagement: median(channels.map((c) => c.metrics?.engagementRate)),
    medianCadence: median(channels.map((c) => c.metrics?.uploadsPerWeek)),
  };
}

/** True when the requested filters/sort require enrichment (recent-video data). */
export function needsEnrich(filters = {}, sort = '') {
  const f = filters;
  return Boolean(
    f.minCadence != null || f.maxCadence != null ||
    f.minEngagement != null ||
    f.shortsMin != null || f.shortsMax != null ||
    (f.topic && f.topic !== '') ||
    sort === 'engagement_desc' || sort === 'cadence_desc',
  );
}

/** Apply all filters (base + advanced) and a sort. Returns a new array. */
export function filterAndSort(channels, filters = {}, sort = 'relevance') {
  const f = filters;
  let out = channels.filter((c) => {
    const m = c.metrics || {};
    if (f.minSubs != null && (c.subs == null || c.subs < f.minSubs)) return false;
    if (f.maxSubs != null && (c.subs == null || c.subs > f.maxSubs)) return false;
    if (f.country && c.country !== f.country) return false;

    // Channel age (months). olderThan = created before X months ago.
    if (f.ageOlderThanMonths != null) {
      if (m.ageMonths == null || m.ageMonths < f.ageOlderThanMonths) return false;
    }
    if (f.ageNewerThanMonths != null) {
      if (m.ageMonths == null || m.ageMonths > f.ageNewerThanMonths) return false;
    }

    // Upload cadence (videos/week).
    if (f.minCadence != null) {
      if (m.uploadsPerWeek == null || m.uploadsPerWeek < f.minCadence) return false;
    }
    if (f.maxCadence != null) {
      if (m.uploadsPerWeek == null || m.uploadsPerWeek > f.maxCadence) return false;
    }

    // Engagement rate (fraction).
    if (f.minEngagement != null) {
      if (m.engagementRate == null || m.engagementRate < f.minEngagement) return false;
    }

    // Shorts mix (percent 0..100).
    if (f.shortsMin != null) {
      if (m.shortsPct == null || m.shortsPct < f.shortsMin) return false;
    }
    if (f.shortsMax != null) {
      if (m.shortsPct == null || m.shortsPct > f.shortsMax) return false;
    }

    // Topic/category.
    if (f.topic) {
      if (!m.topicKeys || !m.topicKeys.includes(f.topic)) return false;
    }
    return true;
  });

  const byNum = (sel, dir = -1) => (a, b) => {
    const av = sel(a), bv = sel(b);
    const an = av == null ? -Infinity : av;
    const bn = bv == null ? -Infinity : bv;
    return dir * (bn - an);
  };

  switch (sort) {
    case 'subs_desc': out.sort(byNum((c) => c.subs)); break;
    case 'subs_asc': out.sort(byNum((c) => c.subs, 1)); break;
    case 'views_desc': out.sort(byNum((c) => c.views)); break;
    case 'avg_desc': out.sort(byNum((c) => c.avg)); break;
    case 'videos_desc': out.sort(byNum((c) => c.videos)); break;
    case 'newest': out.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)); break;
    case 'oldest': out.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt)); break;
    case 'engagement_desc': out.sort(byNum((c) => c.metrics?.engagementRate)); break;
    case 'cadence_desc': out.sort(byNum((c) => c.metrics?.uploadsPerWeek)); break;
    default: break; // relevance = original search order
  }
  return out;
}
