// /api/search — the ported v1 pipeline, now server-side and cached.
// Body: { q, maxResults, language, region, filters, sort, enrich }
import { Router } from 'express';
import { searchChannels, getChannelDetails, SignalError } from '../lib/youtube.js';
import { enrichChannels, filterAndSort, aggregates, needsEnrich } from '../lib/enrich.js';

export const searchRouter = Router();

searchRouter.post('/search', async (req, res, next) => {
  try {
    const {
      q, maxResults = 25, language, region,
      filters = {}, sort = 'relevance', enrich,
    } = req.body || {};

    if (!q || !String(q).trim()) {
      throw new SignalError('No niche entered.', {
        status: 400, hint: 'Type a keyword or niche to scan for, like "personal finance".',
      });
    }
    const limit = Math.min(Math.max(parseInt(maxResults, 10) || 25, 1), 50);

    const { channelIds } = await searchChannels({
      q: String(q).trim(), maxResults: limit,
      relevanceLanguage: language || undefined, regionCode: region || undefined,
    });

    if (!channelIds.length) {
      return res.json({ channels: [], aggregates: aggregates([]), enriched: false, q });
    }

    let channels = await getChannelDetails(channelIds);

    // Enrich if the client asked, or if the requested filters/sort require it.
    const wantEnrich = enrich === true || needsEnrich(filters, sort);
    if (wantEnrich) channels = await enrichChannels(channels);

    const filtered = filterAndSort(channels, filters, sort);

    res.json({
      channels: filtered,
      aggregates: aggregates(filtered),
      enriched: wantEnrich,
      q,
    });
  } catch (err) {
    next(err);
  }
});
