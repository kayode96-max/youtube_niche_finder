// /api/agent — the three AI entry points, all rate-limited (cost guardrails):
//   POST /agent/scout    { query }                         → structured shortlist
//   POST /agent/analyze  { channelId }                     → structured analysis
//   POST /agent/plan     { query?, channelId?, aggregates?} → 7-part growth report
//
// Guards: a per-owner+kind debounce (rejects rapid-fire) and a per-owner daily
// cap counted from agent_query_log (AGENT_DAILY_CAP). The long/expensive plan is
// only ever produced on an explicit POST (button click), never automatically.
import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { SignalError } from '../lib/youtube.js';
import { scoutChannels, analyzeChannel, buildGrowthPlan, REVENUE_DISCLAIMER } from '../lib/agent.js';

export const agentRouter = Router();

const owner = (req) => (req.get('x-signal-owner') || 'default').slice(0, 128);
const now = () => Date.now();

const countToday = db.prepare(
  'SELECT COUNT(*) AS n FROM agent_query_log WHERE owner = ? AND created_at >= ?',
);
const insLog = db.prepare(`
  INSERT INTO agent_query_log (owner, kind, query_text, response_summary, input_tokens, output_tokens, created_at)
  VALUES (@owner, @kind, @query_text, @response_summary, @input_tokens, @output_tokens, @created_at)
`);

// In-memory debounce: last call time per `${owner}:${kind}`. Fine for v1
// (single process); move to the DB/Redis if the server is ever horizontally scaled.
const lastCall = new Map();
const DEBOUNCE_MS = 1500;

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Enforce debounce + daily cap. Returns the owner id for logging.
function guard(req, kind) {
  const who = owner(req);
  const key = `${who}:${kind}`;
  const prev = lastCall.get(key) || 0;
  if (now() - prev < DEBOUNCE_MS) {
    throw new SignalError('Easy on the dial — that request came too fast.', {
      status: 429, hint: 'Wait a moment before sending the agent again.',
    });
  }
  const { n } = countToday.get(who, startOfTodayMs());
  if (n >= config.agentDailyCap) {
    throw new SignalError('Daily AI scouting limit reached for this device.', {
      status: 429, hint: `The cap is ${config.agentDailyCap} agent calls per day. It resets at midnight.`,
    });
  }
  lastCall.set(key, now());
  return who;
}

function log(who, kind, queryText, summary, usage) {
  try {
    insLog.run({
      owner: who, kind, query_text: (queryText || '').slice(0, 500),
      response_summary: (summary || '').slice(0, 500),
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
      created_at: now(),
    });
  } catch { /* logging must never break the response */ }
}

// ── 1. natural-language scouting ───────────────────────────────────────────
agentRouter.post('/agent/scout', async (req, res, next) => {
  try {
    const query = String(req.body?.query || '').trim();
    if (!query) {
      throw new SignalError('No scouting query entered.', {
        status: 400, hint: 'Describe the niche or goal, e.g. "underserved channels teaching Excel to accountants".',
      });
    }
    const who = guard(req, 'scout');
    const result = await scoutChannels({ query });
    log(who, 'scout', query, result.summary, result.usage);
    res.json({
      query,
      summary: result.summary,
      shortlist: result.shortlist,
      consideredCount: result.consideredCount,
    });
  } catch (err) { next(err); }
});

// ── 2. analyze a channel ───────────────────────────────────────────────────
agentRouter.post('/agent/analyze', async (req, res, next) => {
  try {
    const channelId = String(req.body?.channelId || '').trim();
    if (!channelId) throw new SignalError('No channel id provided.', { status: 400 });
    const who = guard(req, 'analyze');
    const result = await analyzeChannel({ channelId });
    log(who, 'analyze', channelId, result.analysis?.verdict, result.usage);
    res.json({ channel: result.channel, metrics: result.metrics, analysis: result.analysis });
  } catch (err) { next(err); }
});

// ── 3. growth & monetization plan (button click only) ──────────────────────
agentRouter.post('/agent/plan', async (req, res, next) => {
  try {
    const { query, channelId, aggregates } = req.body || {};
    if (!query && !channelId && !aggregates) {
      throw new SignalError('Nothing to build a plan around.', {
        status: 400, hint: 'Provide a niche keyword, a channelId, or aggregate stats from a search.',
      });
    }
    const who = guard(req, 'plan');
    const result = await buildGrowthPlan({
      context: {
        query: query ? String(query).trim() : undefined,
        channelId: channelId ? String(channelId).trim() : undefined,
        aggregates: aggregates || undefined,
      },
    });
    log(who, 'plan', query || channelId || 'aggregates', result.grounding?.kind, result.usage);
    res.json({
      report: result.report,
      grounding: result.grounding,
      disclaimer: result.disclaimer, // permanent revenue-estimate disclaimer
    });
  } catch (err) { next(err); }
});

// Lightweight status: remaining daily budget + the standing disclaimer.
agentRouter.get('/agent/status', (req, res) => {
  const who = owner(req);
  const { n } = countToday.get(who, startOfTodayMs());
  res.json({
    used: n,
    cap: config.agentDailyCap,
    remaining: Math.max(0, config.agentDailyCap - n),
    disclaimer: REVENUE_DISCLAIMER,
  });
});
