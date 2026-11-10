// SQLite via better-sqlite3. Synchronous, fast, zero-config for dev.
// Schema is kept clean/normalized enough to port to Postgres later
// (no SQLite-only column types beyond TEXT/INTEGER, timestamps as epoch ms).
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Ensure the data directory exists before opening the file.
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- Raw YouTube channel payloads, cached with a fetch timestamp for TTL checks.
  CREATE TABLE IF NOT EXISTS channels_cache (
    channel_id  TEXT PRIMARY KEY,
    raw         TEXT NOT NULL,          -- JSON of the normalized channel record
    fetched_at  INTEGER NOT NULL        -- epoch ms
  );

  -- Raw YouTube video payloads, cached per video id.
  CREATE TABLE IF NOT EXISTS videos_cache (
    video_id    TEXT PRIMARY KEY,
    channel_id  TEXT,
    raw         TEXT NOT NULL,          -- JSON of the normalized video record
    fetched_at  INTEGER NOT NULL
  );

  -- Generic keyed cache for anything else we proxy (search results,
  -- uploads playlists, recent-video lists) so identical requests reuse quota.
  CREATE TABLE IF NOT EXISTS api_cache (
    cache_key   TEXT PRIMARY KEY,
    raw         TEXT NOT NULL,
    fetched_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookmark_folders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner       TEXT NOT NULL DEFAULT 'default',  -- device/browser-scoped id
    name        TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    UNIQUE(owner, name)
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner       TEXT NOT NULL DEFAULT 'default',
    type        TEXT NOT NULL CHECK (type IN ('channel','video')),
    target_id   TEXT NOT NULL,
    folder_id   INTEGER REFERENCES bookmark_folders(id) ON DELETE SET NULL,
    title       TEXT,                   -- denormalized label for quick display
    meta        TEXT,                   -- JSON snapshot (thumb, subs, channelId…)
    note        TEXT,
    created_at  INTEGER NOT NULL,
    UNIQUE(owner, type, target_id)
  );

  CREATE INDEX IF NOT EXISTS idx_bookmarks_owner ON bookmarks(owner);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_folder ON bookmarks(folder_id);

  -- Not user-facing: for debugging + rough cost tracking of agent calls.
  CREATE TABLE IF NOT EXISTS agent_query_log (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    owner            TEXT,
    kind             TEXT,              -- scout | analyze | plan
    query_text       TEXT,
    response_summary TEXT,
    input_tokens     INTEGER,
    output_tokens    INTEGER,
    created_at       INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_agentlog_owner_day ON agent_query_log(owner, created_at);
`);

export default db;
