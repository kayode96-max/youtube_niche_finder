// /api/bookmarks + /api/folders — device/browser-scoped (no full auth in v1).
// The client sends an `x-signal-owner` header (a random id it stores locally).
import { Router } from 'express';
import { db } from '../db.js';
import { SignalError } from '../lib/youtube.js';

export const bookmarksRouter = Router();

// Owner comes from the device-scoped header on normal API calls. The export
// route is hit by a bare <a download> navigation, which can't set a header, so
// we also accept ?owner= as a fallback there.
const owner = (req) => (req.get('x-signal-owner') || req.query.owner || 'default').slice(0, 128);
const now = () => Date.now();

// ── prepared statements ────────────────────────────────────────────────
const listBookmarks = db.prepare(`
  SELECT b.*, f.name AS folder_name FROM bookmarks b
  LEFT JOIN bookmark_folders f ON f.id = b.folder_id
  WHERE b.owner = ? ORDER BY b.created_at DESC
`);
const insBookmark = db.prepare(`
  INSERT INTO bookmarks (owner, type, target_id, folder_id, title, meta, note, created_at)
  VALUES (@owner, @type, @target_id, @folder_id, @title, @meta, @note, @created_at)
  ON CONFLICT(owner, type, target_id) DO UPDATE SET
    folder_id = excluded.folder_id, title = excluded.title,
    meta = excluded.meta, note = excluded.note
`);
const getBookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ? AND owner = ?');
const updBookmark = db.prepare('UPDATE bookmarks SET note = ?, folder_id = ? WHERE id = ? AND owner = ?');
const delBookmark = db.prepare('DELETE FROM bookmarks WHERE id = ? AND owner = ?');

const listFolders = db.prepare('SELECT * FROM bookmark_folders WHERE owner = ? ORDER BY name');
const insFolder = db.prepare('INSERT OR IGNORE INTO bookmark_folders (owner, name, created_at) VALUES (?, ?, ?)');
const getFolderByName = db.prepare('SELECT * FROM bookmark_folders WHERE owner = ? AND name = ?');
const delFolder = db.prepare('DELETE FROM bookmark_folders WHERE id = ? AND owner = ?');

// ── folders ────────────────────────────────────────────────────────────
bookmarksRouter.get('/folders', (req, res) => {
  res.json({ folders: listFolders.all(owner(req)) });
});

bookmarksRouter.post('/folders', (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) throw new SignalError('Folder needs a name.', { status: 400 });
    insFolder.run(owner(req), name, now());
    res.json({ folder: getFolderByName.get(owner(req), name) });
  } catch (err) { next(err); }
});

bookmarksRouter.delete('/folders/:id', (req, res) => {
  delFolder.run(parseInt(req.params.id, 10), owner(req));
  res.json({ ok: true });
});

// ── bookmarks ──────────────────────────────────────────────────────────
bookmarksRouter.get('/bookmarks', (req, res) => {
  let rows = listBookmarks.all(owner(req)).map(hydrate);
  const { folder, type } = req.query;
  if (folder) rows = rows.filter((r) => String(r.folder_id) === String(folder));
  if (type) rows = rows.filter((r) => r.type === type);
  res.json({ bookmarks: rows, folders: listFolders.all(owner(req)) });
});

bookmarksRouter.post('/bookmarks', (req, res, next) => {
  try {
    const { type, target_id, folder_id, title, meta, note } = req.body || {};
    if (!['channel', 'video'].includes(type)) throw new SignalError('Bookmark type must be channel or video.', { status: 400 });
    if (!target_id) throw new SignalError('Bookmark needs a target id.', { status: 400 });
    insBookmark.run({
      owner: owner(req), type, target_id,
      folder_id: folder_id ? parseInt(folder_id, 10) : null,
      title: title || null,
      meta: meta ? JSON.stringify(meta) : null,
      note: note || null,
      created_at: now(),
    });
    const row = db.prepare('SELECT * FROM bookmarks WHERE owner = ? AND type = ? AND target_id = ?')
      .get(owner(req), type, target_id);
    res.json({ bookmark: hydrate(row) });
  } catch (err) { next(err); }
});

bookmarksRouter.patch('/bookmarks/:id', (req, res, next) => {
  try {
    const existing = getBookmark.get(parseInt(req.params.id, 10), owner(req));
    if (!existing) throw new SignalError('Bookmark not found.', { status: 404 });
    const note = req.body?.note != null ? req.body.note : existing.note;
    const folderId = req.body?.folder_id !== undefined
      ? (req.body.folder_id ? parseInt(req.body.folder_id, 10) : null)
      : existing.folder_id;
    updBookmark.run(note, folderId, existing.id, owner(req));
    res.json({ bookmark: hydrate(getBookmark.get(existing.id, owner(req))) });
  } catch (err) { next(err); }
});

bookmarksRouter.delete('/bookmarks/:id', (req, res) => {
  delBookmark.run(parseInt(req.params.id, 10), owner(req));
  res.json({ ok: true });
});

// ── export ─────────────────────────────────────────────────────────────
bookmarksRouter.get('/bookmarks/export', (req, res) => {
  const rows = listBookmarks.all(owner(req)).map(hydrate);
  const format = (req.query.format || 'json').toLowerCase();
  if (format === 'csv') {
    const cols = ['id', 'type', 'target_id', 'title', 'folder_name', 'note', 'created_at'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="signal-bookmarks.csv"');
    return res.send(csv);
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="signal-bookmarks.json"');
  res.send(JSON.stringify(rows, null, 2));
});

function hydrate(row) {
  if (!row) return row;
  return { ...row, meta: row.meta ? safeParse(row.meta) : null };
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
