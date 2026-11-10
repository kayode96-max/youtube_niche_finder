// SIGNAL v2 — Express entry point. The ONLY process that talks to the YouTube
// Data API and Google Gemini; API keys live in server .env and never reach the
// browser. All routers mount under /api. A centralized error handler renders
// SignalError (and anything else) into the console's calm "Signal lost" voice.
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import './db.js'; // opens the SQLite connection + ensures schema on import
import { SignalError } from './lib/youtube.js';

import { searchRouter } from './routes/search.js';
import { channelsRouter } from './routes/channels.js';
import { videosRouter } from './routes/videos.js';
import { bookmarksRouter } from './routes/bookmarks.js';
import { analyticsRouter } from './routes/analytics.js';
import { agentRouter } from './routes/agent.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── health ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'signal-v2',
    // Booleans only — never expose whether a specific key value is present
    // beyond "configured or not", and never the key itself.
    youtube: Boolean(config.youtubeKey),
    gemini: Boolean(config.geminiKey),
    model: config.geminiModel,
    cacheTtlHours: config.cacheTtlHours,
  });
});

// ── API routers ────────────────────────────────────────────────────────────
app.use('/api', searchRouter);
app.use('/api', channelsRouter);
app.use('/api', videosRouter);
app.use('/api', bookmarksRouter);
app.use('/api', analyticsRouter);
app.use('/api', agentRouter);

// Unknown /api routes → JSON 404 in-voice (not the static/SPA fallback).
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'No signal on that channel.',
    hint: `Unknown endpoint: ${req.method} ${req.originalUrl}`,
  });
});

// ── static client (production) ─────────────────────────────────────────────
// In production we serve the built Vite client from Express so there's a single
// origin (and a single place the keys live — the server). In dev, Vite runs its
// own server and proxies /api here, so this block is simply inert.
const clientDist = path.resolve(config.serverRoot, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-/api GET returns index.html.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── centralized error handler ──────────────────────────────────────────────
// Everything user-facing speaks the "Signal lost" voice: a clear message plus
// an optional hint. Raw stack traces never reach the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isSignal = err instanceof SignalError || err?.name === 'SignalError';
  const status = isSignal ? (err.status || 502) : 500;
  if (!isSignal) {
    // Log unexpected errors server-side for debugging; keep the client message calm.
    console.error('[signal] unhandled error:', err);
  }
  res.status(status).json({
    error: isSignal ? err.message : 'Signal lost — an unexpected fault on the server.',
    hint: isSignal ? err.hint : undefined,
  });
});

app.listen(config.port, () => {
  console.log(`\n  SIGNAL v2 online → http://localhost:${config.port}`);
  console.log(`  YouTube key: ${config.youtubeKey ? 'set' : 'MISSING'}   Gemini key: ${config.geminiKey ? 'set' : 'MISSING'}   model: ${config.geminiModel}\n`);
});

export default app;
