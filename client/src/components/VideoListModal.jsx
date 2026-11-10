import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../lib/api.js';
import { formatNumber, formatDuration, relativeTime } from '../lib/format.js';
import Banner from './Banner.jsx';

// Lists a channel's recent uploads; clicking one opens the in-app VideoModal.
// Reuses recentVideos if the parent already has them (from a deep scan), else
// fetches via the cached backend endpoint.
export default function VideoListModal({ channel, onClose, onPreview, onBookmarkVideo, isVideoBookmarked }) {
  const [videos, setVideos] = useState(channel.recentVideos || null);
  const [loading, setLoading] = useState(!channel.recentVideos);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (videos) return;
    let alive = true;
    setLoading(true);
    api.channelVideos(channel.id, 15)
      .then((r) => { if (alive) setVideos(r.videos); })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [channel.id]);

  return (
    <Modal title={`${channel.title} — recent uploads`} onClose={onClose}>
      {error && <Banner kind="error" title={error.message} hint={error.hint} />}
      {loading && (
        <div className="bm-list">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
        </div>
      )}
      {!loading && videos && videos.length === 0 && (
        <div className="state"><div className="sub">No transmissions found for this channel.</div></div>
      )}
      {!loading && videos && videos.length > 0 && (
        <div className="bm-list">
          {videos.map((v) => (
            <div className="bm-item" key={v.id} style={{ alignItems: 'center' }}>
              <img src={v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" style={{ width: 120, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }} onClick={() => onPreview(v)} loading="lazy" />
              <div className="bm-main" style={{ cursor: 'pointer' }} onClick={() => onPreview(v)}>
                <div className="bm-title" style={{ fontSize: 13 }}>{v.title}</div>
                <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>
                  {formatNumber(v.views)} views · {formatDuration(v.durationSec)}{v.isShort ? ' · Short' : ''} · {relativeTime(v.publishedAt)}
                </div>
              </div>
              <div className="row">
                <button className="btn sm ghost" onClick={() => onPreview(v)}>▶ Preview</button>
                {onBookmarkVideo && (
                  <button
                    className={`iconbtn ${isVideoBookmarked?.(v.id) ? 'active' : ''}`}
                    title="Bookmark video"
                    onClick={() => onBookmarkVideo(v, channel)}
                  >{isVideoBookmarked?.(v.id) ? '★' : '☆'}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
