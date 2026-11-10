import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import Banner from '../components/Banner.jsx';
import { formatNumber, formatDate } from '../lib/format.js';

// Phase 4 view: the dedicated bookmarks manager — filter by folder/type, edit
// notes inline, move between folders, remove, and export JSON/CSV. Reads the
// shared bookmarks hook passed from App.
export default function BookmarksView({ bookmarks, onOpenVideo, onOpenChannelVideos }) {
  const { list, folders, update, remove, addFolder, removeFolder, error, setError } = bookmarks;
  const [folderFilter, setFolderFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [noteDrafts, setNoteDrafts] = useState({});

  const filtered = useMemo(() => list.filter((b) => {
    if (folderFilter && String(b.folder_id) !== folderFilter) return false;
    if (typeFilter && b.type !== typeFilter) return false;
    return true;
  }), [list, folderFilter, typeFilter]);

  return (
    <div>
      <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="eyebrow">Saved signals</div>
          <h1>Bookmarks</h1>
        </div>
        <div className="row">
          <a className="btn sm ghost" href={api.exportBookmarksUrl('json')} download>⤓ JSON</a>
          <a className="btn sm ghost" href={api.exportBookmarksUrl('csv')} download>⤓ CSV</a>
        </div>
      </div>

      {error && <Banner kind="error" title={error.message} hint={error.hint} onClose={() => setError(null)} />}

      <div className="bm-toolbar">
        <select className="inp" style={{ width: 'auto' }} value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)}>
          <option value="">All folders</option>
          {folders.map((f) => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
        </select>
        <select className="inp" style={{ width: 'auto' }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="channel">Channels</option>
          <option value="video">Videos</option>
        </select>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <input className="inp" style={{ width: 160 }} placeholder="New folder…" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newFolder.trim()) { addFolder(newFolder.trim()); setNewFolder(''); } }} />
          <button className="btn sm" onClick={() => { if (newFolder.trim()) { addFolder(newFolder.trim()); setNewFolder(''); } }}>+ Folder</button>
        </div>
      </div>

      {folders.length > 0 && (
        <div className="chips" style={{ marginBottom: 16 }}>
          {folders.map((f) => (
            <span key={f.id} className="chip" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              {f.name}
              <button className="muted" style={{ background: 'none', border: 'none', color: 'inherit', padding: 0 }} title="Delete folder" onClick={() => removeFolder(f.id)}>×</button>
            </span>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="state">
          <div className="big">Nothing saved yet.</div>
          <div className="sub">Bookmark channels and videos from the scout to build your watchlist. Notes and folders are stored per device.</div>
        </div>
      ) : (
        <div className="bm-list">
          {filtered.map((b) => {
            const meta = b.meta || {};
            const draft = noteDrafts[b.id] !== undefined ? noteDrafts[b.id] : (b.note || '');
            return (
              <div className="bm-item" key={b.id}>
                {meta.thumb && <img src={meta.thumb} alt="" style={{ width: b.type === 'video' ? 96 : 46, aspectRatio: b.type === 'video' ? '16/9' : '1', height: b.type === 'video' ? 'auto' : 46, borderRadius: b.type === 'video' ? 6 : '50%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => openTarget(b)} />}
                <div className="bm-main">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <span className="bm-type">{b.type}</span>
                      <div className="bm-title" style={{ cursor: 'pointer' }} onClick={() => openTarget(b)}>{b.title || b.target_id}</div>
                    </div>
                    <div className="row">
                      <select className="inp sm" style={{ width: 'auto', fontSize: 12, padding: '4px 6px' }} value={b.folder_id || ''} onChange={(e) => update(b.id, { folder_id: e.target.value || null })}>
                        <option value="">No folder</option>
                        {folders.map((f) => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
                      </select>
                      <button className="iconbtn" title="Remove" onClick={() => remove(b.id)}>🗑</button>
                    </div>
                  </div>
                  <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {b.type === 'channel'
                      ? `${formatNumber(meta.subs)} subs · ${formatNumber(meta.views)} views`
                      : `${formatNumber(meta.views)} views${meta.channelTitle ? ` · ${meta.channelTitle}` : ''}`}
                    {' · saved '}{formatDate(new Date(b.created_at).toISOString())}
                  </div>
                  <textarea
                    className="bm-note"
                    placeholder="Add a note…"
                    value={draft}
                    onChange={(e) => setNoteDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                    onBlur={() => { if (draft !== (b.note || '')) update(b.id, { note: draft }); }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  function openTarget(b) {
    if (b.type === 'video') onOpenVideo?.({ id: b.target_id, title: b.title, ...(b.meta || {}) });
    else onOpenChannelVideos?.({ id: b.target_id, title: b.title, ...(b.meta || {}) });
  }
}
