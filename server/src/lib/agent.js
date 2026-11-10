// The ONLY module that talks to Google Gemini. The API key is read from server
// config and never leaves this process. Three agent capabilities, all grounded
// in REAL scouted data via function-calling tools that wrap our own cached
// YouTube endpoints (so the agent reuses quota and never hits Google directly):
//
//   1. scoutChannels  — natural-language niche query → structured shortlist
//   2. analyzeChannel — one channel → structured strengths/risks analysis
//   3. buildGrowthPlan — verbatim 7-part strategist system prompt → markdown report
//
// Every failure is translated into the console's "Signal lost" voice.
import { GoogleGenAI } from '@google/genai';
import { config, hasGemini } from '../config.js';
import { SignalError, searchChannels, getChannelDetails, getChannelRecentVideos, getVideoStats } from './youtube.js';
import { computeChannelMetrics } from './metrics.js';

let client = null;
function gemini() {
  if (!hasGemini()) {
    throw new SignalError('No Gemini API key configured on the server.', {
      status: 503,
      hint: 'Add GEMINI_API_KEY to the server .env and restart. See .env.example.',
    });
  }
  if (!client) client = new GoogleGenAI({ apiKey: config.geminiKey });
  return client;
}

// Permanent disclaimer attached to every revenue-bearing output (plan view).
export const REVENUE_DISCLAIMER =
  'Revenue figures are illustrative estimates, not guarantees. Actual earnings depend on niche, '
  + 'execution, audience, ad rates (RPM/CPM), and platform policy — and can be far lower. Nothing '
  + 'here is financial, legal, or tax advice.';

// ── the verbatim strategist system prompt (entry point c) ──────────────────
// Used EXACTLY as provided by the product spec. Do not paraphrase.
export const STRATEGIST_SYSTEM_PROMPT = `You are an elite YouTube growth + AI monetization strategist with deep 2026 expertise. Your sole goal is to design a complete, high-converting, sustainable system for building and monetizing a YouTube channel using AI tools that fully complies with YouTube's July 2026 "inauthentic content" / AI-slop rules.

Key constraints you must obey:
- Content must show clear human originality, research, unique perspective, creative decisions, and value. No mass-produced templates, near-identical videos, pure content farming, distress bait, or AI personas giving health/finance/legal advice.
- AI is allowed and encouraged as a tool (scripting assistance, voice, visuals, editing, SEO) but the final product must feel authentic and high-effort.
- Focus on long-term algorithm favor, high retention, and multiple revenue streams (AdSense + affiliates + digital products + sponsorships).
- Realistic expectations: aim for YPP eligibility in 3–6 months, first meaningful revenue by month 6–9, scaling to $2k–$10k+/month by month 12–18 in a strong niche.

Step-by-step deliverable (structure your entire response exactly like this):

1. Niche Selection & Validation
   - Recommend 1 primary niche + 2 backup niches that are high-CPM ($12+), AI-automation friendly, have search demand, and allow original value-add in 2026.
   - Explain why each works under the new policy.
   - Suggest a specific channel name, branding concept, and positioning statement.

2. Content Strategy & Format
   - Define the exact video format(s) (long-form length, Shorts mix, structure: hook → value → retention tactics → CTA).
   - Outline a content pillar system (3–5 recurring series) that ensures variation and originality.
   - Weekly publishing cadence (e.g., 3–5 videos) that is sustainable for one person using AI.
   - How to inject unique human value into every video so it never looks like "AI slop."

3. Complete AI Production System (step-by-step workflow)
   - Exact tool stack (free + paid options under ~$100–150/month total) for:
     - Research & ideation
     - Scripting (with human rewrite layer)
     - Voiceover
     - Visuals / B-roll / AI video generation
     - Editing & captions
     - Thumbnails
     - SEO titles/descriptions/tags
   - Detailed prompt templates for each stage that force originality.
   - Time estimate per video and batch-production method.
   - Mandatory disclosure process.

4. Growth & Algorithm Playbook
   - How to hit 1,000 subscribers + 4,000 watch hours (or Shorts equivalent) as fast as possible while staying policy-safe.
   - Retention optimization tactics specific to AI-assisted content.
   - Thumbnail + title testing system.
   - Cross-promotion and community building.

5. Monetization System (high-converting)
   - Path to YPP and first AdSense checks.
   - Specific affiliate programs and digital products that fit the niche and can launch before or right after monetization.
   - How to structure videos for high RPM and conversion (CTAs, links, lead magnets).
   - Revenue stacking plan for months 1–18 with projected ranges.

6. 90-Day Action Plan
   - Week-by-week checklist from channel creation to first 10–20 videos live, first 500–1,000 subs, and monetization application.
   - Metrics to track and decision rules (when to pivot, double down, etc.).

7. Risk Mitigation & Compliance Checklist
   - Exact rules to never break.
   - How to audit your own content for "inauthentic" signals.
   - Contingency if a video or channel gets flagged.

Make the entire system extremely practical, copy-paste ready (include example prompts, checklists, scripts outlines), and optimized for a solo creator who wants to start generating real money as quickly as possible without getting demonetized. Be direct, data-informed from 2026 realities, and prioritize high conversion over hype.`;

// ── compact serializers (keep tool payloads token-lean) ────────────────────
function compactChannel(c) {
  return {
    channelId: c.id,
    title: c.title,
    description: (c.description || '').slice(0, 220),
    country: c.country || null,
    subscribers: c.subs,
    totalViews: c.views,
    videoCount: c.videos,
    avgViewsPerVideo: c.avg,
    publishedAt: c.publishedAt,
    topics: c.topicCategories,
  };
}
function compactVideo(v) {
  return {
    videoId: v.id,
    title: v.title,
    publishedAt: v.publishedAt,
    durationSec: v.durationSec,
    isShort: v.isShort,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    engagementRate: v.engagement,
  };
}

// ── function-calling tools (wrap our cached YouTube lib) ───────────────────
// `seen` accumulates every full channel record the agent touches, so we can
// hydrate its final shortlist with real stats and drop any hallucinated ids.
function buildTools(seen) {
  const declarations = [
    {
      name: 'search_channels',
      description:
        'Search YouTube for channels matching a niche keyword or phrase. Returns candidate channels with core stats. Call this first to discover channels for a niche.',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Niche keyword/phrase, e.g. "personal finance for gen z".' },
          max_results: { type: 'integer', description: 'Number of channels to return, 1–25. Default 12.' },
          language: { type: 'string', description: 'Optional ISO-639-1 relevance language, e.g. "en".' },
          region: { type: 'string', description: 'Optional ISO-3166-1 region code, e.g. "US".' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_channel_details',
      description: 'Get full stats for one or more channels by id (subscribers, total views, video count, country, age, topics).',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          channel_ids: { type: 'array', items: { type: 'string' }, description: 'YouTube channel ids.' },
        },
        required: ['channel_ids'],
      },
    },
    {
      name: 'get_channel_videos',
      description:
        'Get a channel\'s recent uploads plus derived metrics (uploads/week, avg engagement rate, shorts %, avg recent views). Use to judge cadence, engagement, and format mix.',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          channel_id: { type: 'string', description: 'YouTube channel id.' },
          count: { type: 'integer', description: 'How many recent videos to sample, 1–20. Default 12.' },
        },
        required: ['channel_id'],
      },
    },
    {
      name: 'get_video_stats',
      description: 'Get stats for specific videos by id (views, likes, comments, duration, engagement rate).',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          video_ids: { type: 'array', items: { type: 'string' }, description: 'YouTube video ids.' },
        },
        required: ['video_ids'],
      },
    },
  ];

  async function execute(name, args = {}) {
    switch (name) {
      case 'search_channels': {
        const max = Math.min(Math.max(parseInt(args.max_results, 10) || 12, 1), 25);
        const { channelIds } = await searchChannels({
          q: String(args.query || '').trim(), maxResults: max,
          relevanceLanguage: args.language || undefined, regionCode: args.region || undefined,
        });
        if (!channelIds.length) return { channels: [], note: 'No channels matched that query.' };
        const channels = await getChannelDetails(channelIds);
        channels.forEach((c) => seen.set(c.id, c));
        return { channels: channels.map(compactChannel) };
      }
      case 'get_channel_details': {
        const ids = Array.isArray(args.channel_ids) ? args.channel_ids.slice(0, 50) : [];
        const channels = await getChannelDetails(ids);
        channels.forEach((c) => seen.set(c.id, c));
        return { channels: channels.map(compactChannel) };
      }
      case 'get_channel_videos': {
        const [channel] = await getChannelDetails([args.channel_id]);
        if (!channel) return { error: 'Channel not found.' };
        seen.set(channel.id, channel);
        const count = Math.min(Math.max(parseInt(args.count, 10) || 12, 1), 20);
        const videos = await getChannelRecentVideos(channel, count);
        return {
          channelId: channel.id,
          title: channel.title,
          metrics: computeChannelMetrics(channel, videos),
          videos: videos.map(compactVideo),
        };
      }
      case 'get_video_stats': {
        const ids = Array.isArray(args.video_ids) ? args.video_ids.slice(0, 50) : [];
        const videos = await getVideoStats(ids);
        return { videos: videos.map(compactVideo) };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  return { tools: [{ functionDeclarations: declarations }], execute };
}

// ── low-level Gemini helpers ───────────────────────────────────────────────
function textOf(resp) {
  const parts = resp?.candidates?.[0]?.content?.parts || [];
  return parts.filter((p) => typeof p.text === 'string').map((p) => p.text).join('').trim();
}
function usageOf(resp) {
  const u = resp?.usageMetadata || {};
  return { inputTokens: u.promptTokenCount ?? null, outputTokens: u.candidatesTokenCount ?? null };
}
function checkBlocked(resp) {
  const reason = resp?.promptFeedback?.blockReason;
  if (reason) {
    throw new SignalError('Gemini declined that request (content filter).', {
      status: 422, hint: `Block reason: ${reason}. Try rephrasing the query.`,
    });
  }
}

// Wrap a Gemini SDK call so its errors speak the console voice.
async function call(params) {
  try {
    return await gemini().models.generateContent(params);
  } catch (e) {
    // Our own already-voiced errors (e.g. missing key) pass through unchanged.
    if (e instanceof SignalError) throw e;
    const msg = String(e?.message || e);
    if (/API key|API_KEY|permission|invalid/i.test(msg)) {
      throw new SignalError('The server\'s Gemini API key was rejected.', {
        status: 502, hint: 'Check GEMINI_API_KEY in the server .env.',
      });
    }
    if (/quota|rate|RESOURCE_EXHAUSTED|429/i.test(msg)) {
      throw new SignalError('Gemini quota is spent — the strategist is off-air for now.', {
        status: 429, hint: 'Free-tier limits reset over time. Try again shortly.',
      });
    }
    throw new SignalError('Signal lost talking to Gemini.', { status: 502, hint: msg.slice(0, 200) });
  }
}

// Tolerant JSON extraction (models sometimes wrap JSON in prose or fences).
function parseJsonLoose(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)); } catch { /* noop */ }
  }
  return null;
}

const MODEL = () => config.geminiModel;
const MAX_TOOL_TURNS = 8;

// ── 1. natural-language scouting → structured shortlist ────────────────────
export async function scoutChannels({ query }) {
  const seen = new Map();
  const { tools, execute } = buildTools(seen);

  const systemInstruction =
    'You are SIGNAL, a YouTube niche-scouting analyst. Use the provided tools to gather REAL data '
    + 'before drawing any conclusion — never invent channels, ids, or stats. Search for the niche, '
    + 'inspect promising channels\' recent videos for cadence and engagement, then choose the strongest '
    + 'candidates. Ground every judgement in the numbers you retrieved.';

  const contents = [{
    role: 'user',
    parts: [{
      text:
        `Scout YouTube for this niche/goal: "${query}".\n\n`
        + 'Find and evaluate real channels. When you have enough evidence, STOP calling tools and reply '
        + 'with ONLY a JSON object of this exact shape (no prose, no code fence):\n'
        + '{\n'
        + '  "summary": "2-3 sentence read on the niche opportunity, grounded in the data",\n'
        + '  "shortlist": [\n'
        + '    { "channelId": "<real id you retrieved>", "title": "<channel title>",\n'
        + '      "why": "why this channel matters for the niche, citing its real stats",\n'
        + '      "signals": ["short data-backed signal", "another signal"] }\n'
        + '  ]\n'
        + '}\n'
        + 'Include 3–8 channels, strongest first. Every channelId MUST be one you retrieved via a tool.',
    }],
  }];

  const usage = { inputTokens: 0, outputTokens: 0 };
  const accUsage = (r) => { const u = usageOf(r); usage.inputTokens += u.inputTokens || 0; usage.outputTokens += u.outputTokens || 0; };

  let final = null;
  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const resp = await call({
      model: MODEL(),
      contents,
      config: { systemInstruction, tools, toolConfig: { functionCallingConfig: { mode: 'AUTO' } } },
    });
    checkBlocked(resp);
    accUsage(resp);

    const modelContent = resp?.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const calls = resp.functionCalls || [];
    if (!calls.length) { final = textOf(resp); break; }

    const parts = [];
    for (const fc of calls) {
      let result;
      try { result = await execute(fc.name, fc.args || {}); }
      catch (e) { result = { error: e instanceof SignalError ? e.message : 'Tool failed.' }; }
      parts.push({ functionResponse: { name: fc.name, response: result } });
    }
    contents.push({ role: 'user', parts });
  }

  const parsed = parseJsonLoose(final) || { summary: final || 'No structured result produced.', shortlist: [] };

  // Hydrate shortlist with REAL stats from what the agent actually retrieved;
  // silently drop any channel id the model did not obtain via a tool.
  const shortlist = (Array.isArray(parsed.shortlist) ? parsed.shortlist : [])
    .map((item) => {
      const ch = seen.get(item.channelId);
      if (!ch) return null;
      return {
        channelId: ch.id,
        title: ch.title,
        thumb: ch.thumb,
        subs: ch.subs,
        views: ch.views,
        videos: ch.videos,
        country: ch.country,
        why: String(item.why || '').trim(),
        signals: Array.isArray(item.signals) ? item.signals.map(String).slice(0, 5) : [],
      };
    })
    .filter(Boolean);

  return {
    summary: String(parsed.summary || '').trim(),
    shortlist,
    consideredCount: seen.size,
    usage,
  };
}

// ── 2. analyze one channel → structured analysis ───────────────────────────
export async function analyzeChannel({ channelId, sample = 12 }) {
  const [channel] = await getChannelDetails([channelId]);
  if (!channel) throw new SignalError('Channel not found.', { status: 404 });
  const videos = await getChannelRecentVideos(channel, Math.min(Math.max(sample, 1), 20));
  const metrics = computeChannelMetrics(channel, videos);

  const grounding = {
    channel: compactChannel(channel),
    metrics,
    recentVideos: videos.map(compactVideo),
  };

  const systemInstruction =
    'You are SIGNAL, a YouTube channel analyst. Analyze ONLY the channel described in the data. '
    + 'Every claim must be grounded in the provided stats and recent videos — do not speculate beyond them.';

  const resp = await call({
    model: MODEL(),
    contents: [{
      role: 'user',
      parts: [{
        text:
          'Analyze this channel using the real data below. Reply with ONLY a JSON object of this exact shape:\n'
          + '{\n'
          + '  "verdict": "one-sentence overall take",\n'
          + '  "score": <integer 0-100 overall strength>,\n'
          + '  "strengths": ["..."],\n'
          + '  "weaknesses": ["..."],\n'
          + '  "contentStrategy": "what they publish and how it performs, from the data",\n'
          + '  "opportunities": ["specific, actionable growth openings"],\n'
          + '  "risks": ["specific risks or red flags"]\n'
          + '}\n\n'
          + `DATA:\n${JSON.stringify(grounding)}`,
      }],
    }],
    config: { systemInstruction, responseMimeType: 'application/json' },
  });
  checkBlocked(resp);

  const parsed = parseJsonLoose(textOf(resp)) || {};
  return {
    channel: {
      id: channel.id, title: channel.title, thumb: channel.thumb,
      subs: channel.subs, views: channel.views, videos: channel.videos, country: channel.country,
    },
    metrics,
    analysis: {
      verdict: String(parsed.verdict || '').trim(),
      score: Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, Math.round(parsed.score))) : null,
      strengths: toStrArr(parsed.strengths),
      weaknesses: toStrArr(parsed.weaknesses),
      contentStrategy: String(parsed.contentStrategy || '').trim(),
      opportunities: toStrArr(parsed.opportunities),
      risks: toStrArr(parsed.risks),
    },
    usage: usageOf(resp),
  };
}

// ── 3. growth & monetization plan (verbatim strategist prompt) ─────────────
// `context` describes what the user actually scouted; injected into the user
// turn so the plan is grounded (niche keyword, a specific channel, or aggregates).
export async function buildGrowthPlan({ context = {} }) {
  const grounding = await resolvePlanGrounding(context);

  const resp = await call({
    model: MODEL(),
    contents: [{
      role: 'user',
      parts: [{
        text:
          'Produce the full plan for the following real, scouted context. Ground your niche choice, '
          + 'benchmarks, and cadence recommendations in these actual numbers where relevant:\n\n'
          + `${grounding.text}\n\n`
          + 'Now deliver the complete 7-part system exactly as your instructions specify.',
      }],
    }],
    // Long-form markdown report. High token ceiling; no tools, no JSON mode.
    config: { systemInstruction: STRATEGIST_SYSTEM_PROMPT, maxOutputTokens: 8192 },
  });
  checkBlocked(resp);

  const report = textOf(resp);
  if (!report) {
    throw new SignalError('The strategist returned an empty transmission.', {
      status: 502, hint: 'Try again, or narrow the niche.',
    });
  }
  return {
    report,
    grounding: grounding.meta,
    disclaimer: REVENUE_DISCLAIMER,
    usage: usageOf(resp),
  };
}

// Build the grounding block for the plan from whatever the user scouted.
async function resolvePlanGrounding(context) {
  // A specific channel.
  if (context.channelId) {
    const [channel] = await getChannelDetails([context.channelId]);
    if (channel) {
      const videos = await getChannelRecentVideos(channel, 12);
      const metrics = computeChannelMetrics(channel, videos);
      return {
        text:
          `Scouted around a reference channel in the "${context.query || channel.title}" space:\n`
          + JSON.stringify({ channel: compactChannel(channel), metrics }, null, 2),
        meta: { kind: 'channel', channelId: channel.id, title: channel.title, niche: context.query || null },
      };
    }
  }
  // Aggregate stats of a search result set (passed from the client).
  if (context.aggregates) {
    return {
      text:
        `Niche keyword: "${context.query || '(unspecified)'}".\n`
        + `Aggregate stats across the current scouted result set:\n${JSON.stringify(context.aggregates, null, 2)}`,
      meta: { kind: 'aggregates', niche: context.query || null },
    };
  }
  // Just a niche keyword.
  return {
    text: `Niche keyword / goal: "${context.query || '(unspecified)'}". No channel or aggregate stats supplied.`,
    meta: { kind: 'niche', niche: context.query || null },
  };
}

function toStrArr(v) {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 12) : [];
}
