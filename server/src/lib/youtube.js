// The ONLY module that talks to the YouTube Data API v3. The API key is read
// from server config and never leaves this process. Every public function is
// cache-aware (via lib/cache) so identical requests reuse quota within the TTL.
import { config, hasYouTube } from '../config.js';
import {
  getOrFetch, readChannels, writeChannel, readVideos, writeVideo,
} from './cache.js';

const BASE = 'https://www.googleapis.com/youtube/v3';

/** User-facing error carrying an HTTP status and a "Signal lost"-voiced message. */
export class SignalError extends Error {
  constructor(message, { status = 502, hint } = {}) {
    super(message);
    this.name = 'SignalError';
    this.status = status;
    this.hint = hint;
  }
}

function requireKey() {
  if (!hasYouTube()) {
    throw new SignalError('No YouTube API key configured on the server.', {
      status: 503,
      hint: 'Add YOUTUBE_API_KEY to the server .env and restart. See .env.example.',
    });
  }
}

// Low-level GET against Google. Adds the key, parses JSON, translates errors.
async function ytGet(path, params) {
  requireKey();
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  url.searchParams.set('key', config.youtubeKey);

  let res, data;
  try {
    res = await fetch(url.toString());
    data = await res.json().catch(() => ({}));
  } catch (e) {
    throw new SignalError('Could not reach the YouTube API — network error.', { status: 502 });
  }

  if (!res.ok) {
    const gErr = data?.error;
    const reason = gErr?.errors?.[0]?.reason || '';
    const raw = gErr?.message || `Request failed (${res.status})`;
    // Translate the noisy Google reasons into the console's calm voice.
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      throw new SignalError('Daily YouTube quota is spent — signal will return tomorrow.', {
        status: 429, hint: 'The free tier resets at midnight Pacific. Cached results still work.',
      });
    }
    if (reason === 'keyInvalid' || reason === 'badRequest' && /API key/i.test(raw)) {
      throw new SignalError('The server\'s YouTube API key was rejected.', {
        status: 502, hint: 'Check YOUTUBE_API_KEY in the server .env.',
      });
    }
    if (res.status === 403) {
      throw new SignalError('YouTube refused the request (access/permission).', { status: 502, hint: raw });
    }
    throw new SignalError('Signal lost talking to YouTube.', { status: 502, hint: raw });
  }
  return data;
}

// ── normalizers ────────────────────────────────────────────────────────
function parseDurationSec(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

function normalizeChannel(ch) {
  const st = ch.statistics || {};
  const subs = st.hiddenSubscriberCount ? null : parseInt(st.subscriberCount || '0', 10);
  const views = parseInt(st.viewCount || '0', 10);
  const videos = parseInt(st.videoCount || '0', 10);
  const thumbs = ch.snippet?.thumbnails || {};
  return {
    id: ch.id,
    title: ch.snippet?.title || '',
    description: ch.snippet?.description || '',
    thumb: (thumbs.medium || thumbs.default || {}).url || '',
    country: ch.snippet?.country || '',
    customUrl: ch.snippet?.customUrl || '',
    publishedAt: ch.snippet?.publishedAt || null,
    subs, views, videos,
    avg: videos > 0 ? Math.round(views / videos) : 0,
    uploadsPlaylist: ch.contentDetails?.relatedPlaylists?.uploads || null,
    topicCategories: (ch.topicDetails?.topicCategories || []).map((u) =>
      decodeURIComponent(String(u).split('/wiki/').pop() || '').replace(/_/g, ' ')),
  };
}

function normalizeVideo(v) {
  const st = v.statistics || {};
  const durationSec = parseDurationSec(v.contentDetails?.duration);
  const thumbs = v.snippet?.thumbnails || {};
  const views = parseInt(st.viewCount || '0', 10);
  const likes = st.likeCount != null ? parseInt(st.likeCount, 10) : null;
  const comments = st.commentCount != null ? parseInt(st.commentCount, 10) : null;
  return {
    id: v.id,
    channelId: v.snippet?.channelId || '',
    title: v.snippet?.title || '',
    thumb: (thumbs.medium || thumbs.default || {}).url || '',
    publishedAt: v.snippet?.publishedAt || null,
    duration: v.contentDetails?.duration || '',
    durationSec,
    isShort: durationSec > 0 && durationSec <= 60,
    views, likes, comments,
    engagement: views > 0 && (likes != null || comments != null)
      ? ((likes || 0) + (comments || 0)) / views : null,
  };
}

// ── public, cache-aware API ────────────────────────────────────────────

/** search.list for channels. Cached by (q, maxResults, language, region). */
export async function searchChannels({ q, maxResults = 25, relevanceLanguage, regionCode } = {}) {
  const key = `search:ch:${q}|${maxResults}|${relevanceLanguage || ''}|${regionCode || ''}`;
  const { data, cached } = await getOrFetch(key, async () => {
    const raw = await ytGet('search', {
      part: 'snippet', type: 'channel', q, maxResults,
      relevanceLanguage, regionCode,
    });
    const ids = (raw.items || [])
      .map((it) => it.snippet?.channelId || it.id?.channelId)
      .filter(Boolean);
    return { ids };
  });
  return { channelIds: data.ids, cached };
}

/** channels.list for details. Per-channel cache; batches misses in groups of 50. */
export async function getChannelDetails(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  const { hits, missing } = readChannels(unique);
  if (missing.length) {
    for (let i = 0; i < missing.length; i += 50) {
      const batch = missing.slice(i, i + 50);
      const raw = await ytGet('channels', {
        part: 'snippet,statistics,contentDetails,topicDetails',
        id: batch.join(','), maxResults: 50,
      });
      for (const ch of raw.items || []) {
        const rec = normalizeChannel(ch);
        writeChannel(rec);
        hits[rec.id] = rec;
      }
    }
  }
  // Preserve the incoming order (relevance order from search).
  return unique.map((id) => hits[id]).filter(Boolean);
}

/** Uploads playlist → ordered video ids. Cached by (playlistId, count). */
export async function getUploadVideoIds(playlistId, count = 15) {
  if (!playlistId) return { videoIds: [], cached: false };
  const key = `uploads:${playlistId}|${count}`;
  const { data, cached } = await getOrFetch(key, async () => {
    const raw = await ytGet('playlistItems', {
      part: 'snippet,contentDetails', playlistId, maxResults: Math.min(count, 50),
    });
    const ids = (raw.items || [])
      .map((it) => it.contentDetails?.videoId || it.snippet?.resourceId?.videoId)
      .filter(Boolean);
    return { ids };
  });
  return { videoIds: data.ids, cached };
}

/** videos.list stats. Per-video cache; batches misses in groups of 50. */
export async function getVideoStats(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  const { hits, missing } = readVideos(unique);
  if (missing.length) {
    for (let i = 0; i < missing.length; i += 50) {
      const batch = missing.slice(i, i + 50);
      const raw = await ytGet('videos', {
        part: 'snippet,statistics,contentDetails', id: batch.join(','), maxResults: 50,
      });
      for (const v of raw.items || []) {
        const rec = normalizeVideo(v);
        writeVideo(rec);
        hits[rec.id] = rec;
      }
    }
  }
  return unique.map((id) => hits[id]).filter(Boolean);
}

/** Convenience: recent normalized videos for a channel (uploads → stats). */
export async function getChannelRecentVideos(channel, count = 15) {
  const playlist = channel?.uploadsPlaylist;
  if (!playlist) return [];
  const { videoIds } = await getUploadVideoIds(playlist, count);
  if (!videoIds.length) return [];
  const vids = await getVideoStats(videoIds);
  // Return in upload order (newest first, as the uploads playlist provides).
  const order = new Map(videoIds.map((id, i) => [id, i]));
  return vids.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export { parseDurationSec, normalizeChannel, normalizeVideo };
