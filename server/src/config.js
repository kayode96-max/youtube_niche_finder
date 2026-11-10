// Loads .env from the repo root (one level above /server) and exposes
// typed config. Keeping all env access here means the rest of the app never
// touches process.env directly.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');

// .env lives at the repo root, one level above /server. Running `npm run dev`
// from /server means cwd-based loading would miss it — resolve explicitly.
// A .env inside /server (if present) takes precedence for local overrides.
dotenv.config({ path: path.resolve(serverRoot, '.env') });
dotenv.config({ path: path.resolve(serverRoot, '..', '.env') });

function resolveDbPath(url) {
  const raw = url && url.trim() ? url.trim() : './data/signal.sqlite';
  // Allow a bare file path (SQLite). Strip a sqlite:// prefix if present.
  const cleaned = raw.replace(/^sqlite:\/\//, '');
  return path.isAbsolute(cleaned) ? cleaned : path.resolve(serverRoot, cleaned);
}

export const config = {
  youtubeKey: process.env.YOUTUBE_API_KEY?.trim() || '',
  geminiKey: process.env.GEMINI_API_KEY?.trim() || '',
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash',
  dbPath: resolveDbPath(process.env.DATABASE_URL),
  port: parseInt(process.env.PORT || '3000', 10),
  cacheTtlHours: parseFloat(process.env.CACHE_TTL_HOURS || '6'),
  agentDailyCap: parseInt(process.env.AGENT_DAILY_CAP || '40', 10),
  serverRoot,
};

export const cacheTtlMs = config.cacheTtlHours * 60 * 60 * 1000;

export const hasYouTube = () => Boolean(config.youtubeKey);
export const hasGemini = () => Boolean(config.geminiKey);
