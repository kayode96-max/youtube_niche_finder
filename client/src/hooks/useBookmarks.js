import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// Central bookmark state shared across views. Backs onto the device-scoped
// backend endpoints (owner header handled inside api.js). Exposes fast lookup
// by target id so cards can show their bookmarked state without prop-drilling.
export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.bookmarks();
      setBookmarks(r.bookmarks || []);
      setFolders(r.folders || []);
    } catch (e) { setError(e); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const byTarget = new Map(bookmarks.map((b) => [`${b.type}:${b.target_id}`, b]));
  const isBookmarked = (type, id) => byTarget.has(`${type}:${id}`);

  // Toggle a channel/video bookmark. `payload` carries type/target_id/title/meta.
  const toggle = useCallback(async (payload) => {
    const key = `${payload.type}:${payload.target_id}`;
    const existing = bookmarks.find((b) => `${b.type}:${b.target_id}` === key);
    try {
      if (existing) {
        await api.removeBookmark(existing.id);
      } else {
        await api.addBookmark(payload);
      }
      await refresh();
    } catch (e) { setError(e); }
  }, [bookmarks, refresh]);

  const update = useCallback(async (id, patch) => {
    try { await api.updateBookmark(id, patch); await refresh(); } catch (e) { setError(e); }
  }, [refresh]);

  const remove = useCallback(async (id) => {
    try { await api.removeBookmark(id); await refresh(); } catch (e) { setError(e); }
  }, [refresh]);

  const addFolder = useCallback(async (name) => {
    try { await api.addFolder(name); await refresh(); } catch (e) { setError(e); }
  }, [refresh]);

  const removeFolder = useCallback(async (id) => {
    try { await api.removeFolder(id); await refresh(); } catch (e) { setError(e); }
  }, [refresh]);

  return {
    bookmarks, folders, error, setError,
    isBookmarked, toggle, update, remove, addFolder, removeFolder, refresh,
  };
}

// Build a channel bookmark payload from a channel record.
export function channelBookmark(ch) {
  return {
    type: 'channel',
    target_id: ch.id,
    title: ch.title,
    meta: { thumb: ch.thumb, subs: ch.subs, views: ch.views, videos: ch.videos, country: ch.country },
  };
}

// Build a video bookmark payload from a video record (+ its channel for context).
export function videoBookmark(v, channel) {
  return {
    type: 'video',
    target_id: v.id,
    title: v.title,
    meta: {
      thumb: v.thumb, views: v.views, durationSec: v.durationSec, isShort: v.isShort,
      channelId: v.channelId || channel?.id, channelTitle: channel?.title,
    },
  };
}
