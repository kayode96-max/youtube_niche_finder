// Thin cache helpers over the SQLite tables. Every YouTube call goes through
// getOrFetch: check cache → if fresh, return it → else call the fetcher,
// store the result, return it. TTL is configurable via CACHE_TTL_HOURS.
import { db } from '../db.js';
import { cacheTtlMs } from '../config.js';

const now = () => Date.now();
const isFresh = (fetchedAt) => now() - fetchedAt < cacheTtlMs;

// ---- generic api_cache (search, playlists, recent-video lists) ----
const selApi = db.prepare('SELECT raw, fetched_at FROM api_cache WHERE cache_key = ?');
const upApi = db.prepare(`
  INSERT INTO api_cache (cache_key, raw, fetched_at) VALUES (?, ?, ?)
  ON CONFLICT(cache_key) DO UPDATE SET raw = excluded.raw, fetched_at = excluded.fetched_at
`);

// ---- channels_cache ----
const selCh = db.prepare('SELECT raw, fetched_at FROM channels_cache WHERE channel_id = ?');
const upCh = db.prepare(`
  INSERT INTO channels_cache (channel_id, raw, fetched_at) VALUES (?, ?, ?)
  ON CONFLICT(channel_id) DO UPDATE SET raw = excluded.raw, fetched_at = excluded.fetched_at
`);

// ---- videos_cache ----
const selVid = db.prepare('SELECT raw, fetched_at FROM videos_cache WHERE video_id = ?');
const upVid = db.prepare(`
  INSERT INTO videos_cache (video_id, channel_id, raw, fetched_at) VALUES (?, ?, ?, ?)
  ON CONFLICT(video_id) DO UPDATE SET channel_id = excluded.channel_id, raw = excluded.raw, fetched_at = excluded.fetched_at
`);

/** Generic cache-aside for a JSON-serializable value. */
export async function getOrFetch(key, fetcher, { ttlOverrideMs } = {}) {
  const row = selApi.get(key);
  if (row) {
    const fresh = ttlOverrideMs != null ? now() - row.fetched_at < ttlOverrideMs : isFresh(row.fetched_at);
    if (fresh) return { data: JSON.parse(row.raw), cached: true };
  }
  const data = await fetcher();
  upApi.run(key, JSON.stringify(data), now());
  return { data, cached: false };
}

/** Read cached channel records; returns { hits: {id: record}, missing: [ids] }. */
export function readChannels(ids) {
  const hits = {};
  const missing = [];
  for (const id of ids) {
    const row = selCh.get(id);
    if (row && isFresh(row.fetched_at)) hits[id] = JSON.parse(row.raw);
    else missing.push(id);
  }
  return { hits, missing };
}

export function writeChannel(record) {
  upCh.run(record.id, JSON.stringify(record), now());
}

/** Read one cached channel regardless of freshness (used by analytics/bookmarks). */
export function readChannelAny(id) {
  const row = selCh.get(id);
  return row ? { record: JSON.parse(row.raw), fetchedAt: row.fetched_at, fresh: isFresh(row.fetched_at) } : null;
}

export function readVideos(ids) {
  const hits = {};
  const missing = [];
  for (const id of ids) {
    const row = selVid.get(id);
    if (row && isFresh(row.fetched_at)) hits[id] = JSON.parse(row.raw);
    else missing.push(id);
  }
  return { hits, missing };
}

export function writeVideo(record) {
  upVid.run(record.id, record.channelId || null, JSON.stringify(record), now());
}

export function readVideoAny(id) {
  const row = selVid.get(id);
  return row ? { record: JSON.parse(row.raw), fetchedAt: row.fetched_at, fresh: isFresh(row.fetched_at) } : null;
}
