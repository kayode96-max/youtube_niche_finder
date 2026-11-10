// The client's ONLY door to the backend. It never holds API keys and never
// calls Google/Gemini — every request goes to our Express proxy under /api.
// A device-scoped owner id (random, stored locally) scopes bookmarks + agent
// usage without full auth (fine for v1).

const OWNER_KEY = 'signal.owner';

function ownerId() {
  let id = localStorage.getItem(OWNER_KEY);
  if (!id) {
    id = 'own_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(OWNER_KEY, id);
  }
  return id;
}

// Error carrying the backend's user-facing message + hint ("Signal lost" voice).
export class ApiError extends Error {
  constructor(message, hint, status) {
    super(message || 'Signal lost.');
    this.name = 'ApiError';
    this.hint = hint;
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        'x-signal-owner': ownerId(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Signal lost — could not reach the server.', 'Is the backend running?', 0);
  }
  if (raw) {
    if (!res.ok) throw new ApiError('Signal lost during download.', null, res.status);
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error, data.hint, res.status);
  return data;
}

export const api = {
  ownerId,
  health: () => request('/health'),

  // search + channels + videos
  search: (payload) => request('/search', { method: 'POST', body: payload }),
  channel: (id, sample) => request(`/channels/${id}${sample ? `?sample=${sample}` : ''}`),
  channelVideos: (id, sample) => request(`/channels/${id}/videos${sample ? `?sample=${sample}` : ''}`),
  video: (id) => request(`/videos/${id}`),
  videos: (ids) => request('/videos', { method: 'POST', body: { ids } }),

  // bookmarks + folders
  bookmarks: (q = {}) => {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v != null && v !== '')).toString();
    return request(`/bookmarks${qs ? `?${qs}` : ''}`);
  },
  addBookmark: (payload) => request('/bookmarks', { method: 'POST', body: payload }),
  updateBookmark: (id, payload) => request(`/bookmarks/${id}`, { method: 'PATCH', body: payload }),
  removeBookmark: (id) => request(`/bookmarks/${id}`, { method: 'DELETE' }),
  folders: () => request('/folders'),
  addFolder: (name) => request('/folders', { method: 'POST', body: { name } }),
  removeFolder: (id) => request(`/folders/${id}`, { method: 'DELETE' }),
  // Plain URL for <a download>; a bare navigation can't send the owner header,
  // so we pass it as a query param (backend falls back to it when the header is absent).
  exportBookmarksUrl: (format) => `/api/bookmarks/export?format=${format}&owner=${encodeURIComponent(ownerId())}`,

  // analytics
  analyticsChannel: (id, sample) => request(`/analytics/channel/${id}${sample ? `?sample=${sample}` : ''}`),
  analyticsCompare: (channelIds) => request('/analytics/compare', { method: 'POST', body: { channelIds } }),

  // agent (Gemini, server-side)
  agentStatus: () => request('/agent/status'),
  scout: (query) => request('/agent/scout', { method: 'POST', body: { query } }),
  analyze: (channelId) => request('/agent/analyze', { method: 'POST', body: { channelId } }),
  plan: (context) => request('/agent/plan', { method: 'POST', body: context }),
};
