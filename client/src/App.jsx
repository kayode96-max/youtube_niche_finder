import { useEffect, useState } from 'react';
import { api } from './lib/api.js';
import { useBookmarks, channelBookmark, videoBookmark } from './hooks/useBookmarks.js';
import SearchView from './views/SearchView.jsx';
import BookmarksView from './views/BookmarksView.jsx';
import AnalyticsView from './views/AnalyticsView.jsx';
import AgentView from './views/AgentView.jsx';
import PlanModal from './views/PlanModal.jsx';
import VideoModal from './components/VideoModal.jsx';
import VideoListModal from './components/VideoListModal.jsx';

const MAX_COMPARE = 3;

export default function App() {
  const [view, setView] = useState('search'); // search | bookmarks | analytics | agent
  const [health, setHealth] = useState(null);

  // Compare state (up to 3 channels for analytics)
  const [compareItems, setCompareItems] = useState([]); // { id, title, thumb }[]

  // Modals
  const [videoModal, setVideoModal] = useState(null);
  const [videoListModal, setVideoListModal] = useState(null); // { channel, isBookmarked, onBookmark }
  const [planModal, setPlanModal] = useState(null); // { query?, channelId?, aggregates?, title? }

  // Bookmarks hook — provides { bookmarks, folders, error, setError, isBookmarked, toggle, update, remove, addFolder, removeFolder, refresh }
  const bookmarksHook = useBookmarks();

  // Adapt the hook API to what the views expect:
  // Views call `bookmarks.toggleChannel(ch)` and `bookmarks.toggleVideo(v, channel)`,
  // but the hook exposes `toggle(payload)`. Build adapters:
  const bookmarksAdapter = {
    list: bookmarksHook.bookmarks, // BookmarksView expects `.list` not `.bookmarks`
    folders: bookmarksHook.folders,
    error: bookmarksHook.error,
    setError: bookmarksHook.setError,
    isBookmarked: bookmarksHook.isBookmarked,
    update: bookmarksHook.update,
    remove: bookmarksHook.remove,
    addFolder: bookmarksHook.addFolder,
    removeFolder: bookmarksHook.removeFolder,
    refresh: bookmarksHook.refresh,
    toggleChannel: (ch) => bookmarksHook.toggle(channelBookmark(ch)),
    toggleVideo: (v, channel) => bookmarksHook.toggle(videoBookmark(v, channel)),
  };

  const compareAdapter = {
    items: compareItems,
    has: (id) => compareItems.some((c) => c.id === id),
    toggle: (ch) => {
      if (compareItems.some((c) => c.id === ch.id)) {
        setCompareItems((prev) => prev.filter((c) => c.id !== ch.id));
      } else if (compareItems.length < MAX_COMPARE) {
        setCompareItems((prev) => [...prev, { id: ch.id, title: ch.title, thumb: ch.thumb }]);
      }
    },
    remove: (id) => setCompareItems((prev) => prev.filter((c) => c.id !== id)),
    clear: () => setCompareItems([]),
  };

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);

  function openVideos(channel) {
    setVideoListModal({
      channel,
      isBookmarked: bookmarksHook.isBookmarked('channel', channel.id),
      onBookmark: () => bookmarksAdapter.toggleChannel(channel),
    });
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="tally" />
          <span className="mark">◆</span>
          SIGNAL
        </div>
        <nav className="nav">
          <button className={view === 'search' ? 'active' : ''} onClick={() => setView('search')}>Scout</button>
          <button className={view === 'bookmarks' ? 'active' : ''} onClick={() => setView('bookmarks')}>
            Bookmarks
            {bookmarksHook.bookmarks.length > 0 && <span className="badge">{bookmarksHook.bookmarks.length}</span>}
          </button>
          <button className={view === 'analytics' ? 'active' : ''} onClick={() => setView('analytics')}>
            Analytics
            {compareItems.length > 0 && <span className="badge">{compareItems.length}</span>}
          </button>
          <button className={view === 'agent' ? 'active' : ''} onClick={() => setView('agent')}>AI Scout</button>
        </nav>
        <div className="topbar-spacer" />
        {health && (
          <div className="status">
            <span className={`dot ${health.youtube && health.gemini ? 'on' : 'off'}`} />
            <span>{health.youtube ? 'YouTube' : 'No key'} · {health.gemini ? health.model : 'No AI'}</span>
          </div>
        )}
      </div>

      <main className="main">
        {view === 'search' && (
          <SearchView
            bookmarks={bookmarksAdapter}
            compare={compareAdapter}
            onOpenVideos={openVideos}
            onPlan={setPlanModal}
          />
        )}
        {view === 'bookmarks' && (
          <BookmarksView
            bookmarks={bookmarksAdapter}
            onOpenVideo={setVideoModal}
            onOpenChannelVideos={(ch) => setVideoListModal({ channel: ch })}
          />
        )}
        {view === 'analytics' && <AnalyticsView compare={compareAdapter} />}
        {view === 'agent' && (
          <AgentView
            bookmarks={bookmarksAdapter}
            compare={compareAdapter}
            onOpenVideos={openVideos}
            onPlan={setPlanModal}
          />
        )}
      </main>

      {videoModal && <VideoModal video={videoModal} onClose={() => setVideoModal(null)} />}

      {videoListModal && (
        <VideoListModal
          channel={videoListModal.channel}
          onClose={() => setVideoListModal(null)}
          onPreview={setVideoModal}
          onBookmarkVideo={(v, ch) => bookmarksAdapter.toggleVideo(v, ch)}
          isVideoBookmarked={(id) => bookmarksHook.isBookmarked('video', id)}
        />
      )}

      {planModal && <PlanModal request={planModal} onClose={() => setPlanModal(null)} />}
    </div>
  );
}
