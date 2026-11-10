// /api/channels — details + recent uploads for a single channel.
import { Router } from 'express';
import { getChannelDetails, getChannelRecentVideos, SignalError } from '../lib/youtube.js';
import { computeChannelMetrics } from '../lib/metrics.js';

export const channelsRouter = Router();

// Full enriched record for one channel (metrics + recent videos).
channelsRouter.get('/channels/:id', async (req, res, next) => {
  try {
    const [channel] = await getChannelDetails([req.params.id]);
    if (!channel) throw new SignalError('Channel not found.', { status: 404 });
    const sample = Math.min(parseInt(req.query.sample, 10) || 15, 50);
    const recentVideos = await getChannelRecentVideos(channel, sample);
    res.json({ ...channel, recentVideos, metrics: computeChannelMetrics(channel, recentVideos) });
  } catch (err) { next(err); }
});

// Just the recent uploads (used to expand a card's video list on demand).
channelsRouter.get('/channels/:id/videos', async (req, res, next) => {
  try {
    const [channel] = await getChannelDetails([req.params.id]);
    if (!channel) throw new SignalError('Channel not found.', { status: 404 });
    const sample = Math.min(parseInt(req.query.sample, 10) || 12, 50);
    const videos = await getChannelRecentVideos(channel, sample);
    res.json({ channelId: channel.id, videos });
  } catch (err) { next(err); }
});
