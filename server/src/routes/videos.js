// /api/videos — normalized stats for one or more videos (modal metadata).
import { Router } from 'express';
import { getVideoStats, SignalError } from '../lib/youtube.js';

export const videosRouter = Router();

videosRouter.get('/videos/:id', async (req, res, next) => {
  try {
    const [video] = await getVideoStats([req.params.id]);
    if (!video) throw new SignalError('Video not found.', { status: 404 });
    res.json(video);
  } catch (err) { next(err); }
});

videosRouter.post('/videos', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 50) : [];
    if (!ids.length) throw new SignalError('No video ids provided.', { status: 400 });
    res.json({ videos: await getVideoStats(ids) });
  } catch (err) { next(err); }
});
