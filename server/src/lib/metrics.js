// Derived channel metrics computed from a channel record + its recent videos.
// These power the expanded filters, the new sort options, and the analytics view.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

// Curated topic buckets. YouTube's topicDetails are Wikipedia article names;
// we match them (case-insensitive substring) into these human categories.
export const TOPIC_CATEGORIES = [
  { key: 'music', label: 'Music', match: ['music', 'song', 'hip hop', 'rock', 'pop', 'jazz', 'electronic'] },
  { key: 'gaming', label: 'Gaming', match: ['game', 'video game', 'gaming', 'esports', 'role-playing'] },
  { key: 'sports', label: 'Sports', match: ['sport', 'football', 'basketball', 'soccer', 'tennis', 'american football', 'wrestling'] },
  { key: 'fitness', label: 'Health & Fitness', match: ['fitness', 'health', 'physical', 'exercise', 'wellness'] },
  { key: 'food', label: 'Food & Cooking', match: ['food', 'cooking', 'cuisine', 'recipe'] },
  { key: 'travel', label: 'Travel', match: ['travel', 'tourism', 'vacation'] },
  { key: 'tech', label: 'Technology', match: ['technology', 'gadget', 'software', 'computer', 'electronics'] },
  { key: 'science', label: 'Science & Education', match: ['science', 'physics', 'biology', 'education', 'knowledge', 'mathematics', 'engineering'] },
  { key: 'business', label: 'Business & Finance', match: ['business', 'finance', 'economics', 'entrepreneur', 'money', 'marketing'] },
  { key: 'beauty', label: 'Beauty & Fashion', match: ['fashion', 'beauty', 'cosmetics', 'clothing'] },
  { key: 'autos', label: 'Autos & Vehicles', match: ['vehicle', 'car', 'automobile', 'motorsport'] },
  { key: 'pets', label: 'Pets & Animals', match: ['pet', 'animal', 'dog', 'cat', 'wildlife'] },
  { key: 'entertainment', label: 'Entertainment', match: ['entertainment', 'film', 'television', 'humour', 'humor', 'performing arts', 'movie'] },
  { key: 'lifestyle', label: 'Lifestyle', match: ['lifestyle', 'hobby', 'society', 'home', 'fashion'] },
  { key: 'news', label: 'News & Politics', match: ['politics', 'news', 'military', 'government'] },
];

/** Map a channel's decoded topic strings to curated category keys. */
export function mapTopics(topicStrings = []) {
  const found = new Set();
  const lowered = topicStrings.map((t) => String(t).toLowerCase());
  for (const cat of TOPIC_CATEGORIES) {
    if (lowered.some((t) => cat.match.some((m) => t.includes(m)))) found.add(cat.key);
  }
  return [...found];
}

/** Average uploads per week from the timestamps of recent videos. */
export function uploadsPerWeek(videos) {
  const times = videos
    .map((v) => (v.publishedAt ? new Date(v.publishedAt).getTime() : NaN))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  if (times.length < 2) return null;
  const spanWeeks = (times[times.length - 1] - times[0]) / WEEK_MS;
  if (spanWeeks <= 0) return null;
  // (n-1) intervals across the span = average cadence.
  return (times.length - 1) / spanWeeks;
}

/** Average engagement rate ((likes+comments)/views) across videos that have data. */
export function engagementRate(videos) {
  const rates = videos.map((v) => v.engagement).filter((r) => r != null && Number.isFinite(r));
  if (!rates.length) return null;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

/** Fraction (0..1) of recent videos that are Shorts (<= 60s). */
export function shortsRatio(videos) {
  const withDur = videos.filter((v) => v.durationSec > 0);
  if (!withDur.length) return null;
  return withDur.filter((v) => v.isShort).length / withDur.length;
}

export function ageMonths(publishedAt) {
  if (!publishedAt) return null;
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / MONTH_MS;
}

/** Full derived-metrics bundle for a channel given its recent videos. */
export function computeChannelMetrics(channel, videos = []) {
  const cadence = uploadsPerWeek(videos);
  const engagement = engagementRate(videos);
  const shorts = shortsRatio(videos);
  const recentViews = videos.map((v) => v.views).filter((n) => Number.isFinite(n));
  const lastUpload = videos
    .map((v) => (v.publishedAt ? new Date(v.publishedAt).getTime() : NaN))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0] || null;
  return {
    uploadsPerWeek: cadence,
    engagementRate: engagement,
    shortsPct: shorts != null ? shorts * 100 : null,
    ageMonths: ageMonths(channel.publishedAt),
    avgRecentViews: recentViews.length ? Math.round(recentViews.reduce((a, b) => a + b, 0) / recentViews.length) : null,
    lastUploadAt: lastUpload ? new Date(lastUpload).toISOString() : null,
    sampleSize: videos.length,
    topicKeys: mapTopics(channel.topicCategories || []),
  };
}

export { WEEK_MS, MONTH_MS };
