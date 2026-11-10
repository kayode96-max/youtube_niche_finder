import { useState } from 'react';
import Modal from './Modal.jsx';
import { formatNumber, formatDuration, formatDate, formatPercent } from '../lib/format.js';

// In-app video preview. Playback stays entirely on YouTube's IFrame player
// (we embed it — never download or scrape the file). No autoplay: the poster
// shows first and the embed (with autoplay=1) only mounts after the user clicks
// play. Closing is handled by the Modal shell (Escape / click-outside / button).
export default function VideoModal({ video, onClose }) {
  const [playing, setPlaying] = useState(false);
  if (!video) return null;

  const poster = video.thumb
    || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

  return (
    <Modal title={video.title || 'Preview'} onClose={onClose}>
      <div className="player-frame">
        {playing ? (
          <iframe
            title={video.title || 'YouTube player'}
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div
            className="player-poster"
            style={{ backgroundImage: `url(${poster})` }}
            role="button"
            tabIndex={0}
            aria-label="Play video"
            onClick={() => setPlaying(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPlaying(true); } }}
          >
            <span className="play-btn" aria-hidden>▶</span>
          </div>
        )}
      </div>

      <div className="video-meta">
        <div className="vm"><span className="k">Views</span><span className="v">{formatNumber(video.views)}</span></div>
        <div className="vm"><span className="k">Likes</span><span className="v">{formatNumber(video.likes)}</span></div>
        <div className="vm"><span className="k">Comments</span><span className="v">{formatNumber(video.comments)}</span></div>
        <div className="vm"><span className="k">Engagement</span><span className="v">{formatPercent(video.engagement, 2)}</span></div>
        <div className="vm"><span className="k">Length</span><span className="v">{formatDuration(video.durationSec)}{video.isShort ? ' · Short' : ''}</span></div>
        <div className="vm"><span className="k">Published</span><span className="v" style={{ fontSize: 12 }}>{formatDate(video.publishedAt)}</span></div>
      </div>

      <div style={{ marginTop: 14 }}>
        <a
          className="btn ghost sm"
          href={`https://www.youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on YouTube ↗
        </a>
      </div>
    </Modal>
  );
}
