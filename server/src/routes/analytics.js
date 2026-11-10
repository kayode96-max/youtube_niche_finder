// /api/analytics — trend series for bookmarked/scouted channels, and compare.
import { Router } from 'express';
import { getChannelDetails, getChannelRecentVideos, SignalError } from '../lib/youtube.js';
import { computeChannelMetrics } from '../lib/metrics.js';

export const analyticsRouter = Router();

async function buildSeries(channelId, sample = 20) {
  const [channel] = await getChannelDetails([channelId]);
  if (!channel) return null;
  const videos = await getChannelRecentVideos(channel, sample);
  // Oldest → newest for left-to-right trend charts.
  const chron = [...videos].sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
  const series = chron.map((v) => ({
    videoId: v.id,
    title: v.title,
    publishedAt: v.publishedAt,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    engagement: v.engagement,
    durationSec: v.durationSec,
    isShort: v.isShort,
  }));
  // Gaps between consecutive uploads, in days (cadence timeline).
  const cadenceTimeline = [];
  for (let i = 1; i < chron.length; i++) {
    const gapDays = (new Date(chron[i].publishedAt) - new Date(chron[i - 1].publishedAt)) / 86400000;
    cadenceTimeline.push({ at: chron[i].publishedAt, gapDays: Math.round(gapDays * 10) / 10 });
  }
  return {
    channel: {
      id: channel.id, title: channel.title, thumb: channel.thumb,
      subs: channel.subs, views: channel.views, videos: channel.videos, country: channel.country,
    },
    metrics: computeChannelMetrics(channel, videos),
    series,
    cadenceTimeline,
  };
}

analyticsRouter.get('/analytics/channel/:id', async (req, res, next) => {
  try {
    const sample = Math.min(parseInt(req.query.sample, 10) || 20, 50);
    const data = await buildSeries(req.params.id, sample);
    if (!data) throw new SignalError('Channel not found.', { status: 404 });
    res.json(data);
  } catch (err) { next(err); }
});

analyticsRouter.post('/analytics/compare', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.channelIds) ? req.body.channelIds.slice(0, 3) : [];
    if (!ids.length) throw new SignalError('Provide 1–3 channel ids to compare.', { status: 400 });
    const results = [];
    for (const id of ids) {
      const d = await buildSeries(id, 20).catch(() => null);
      if (d) results.push(d);
    }
    res.json({ channels: results });
  } catch (err) { next(err); }
});
