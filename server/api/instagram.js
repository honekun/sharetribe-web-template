const express = require('express');
const fetch = require('node-fetch');
const { createTTLCache } = require('../api-util/cache');
const { createRateLimiter } = require('../api-util/rateLimit');
const { getInstagramTokenService } = require('../services/instagramTokenService');

const router = express.Router();
const feedRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: { ok: false, error: 'rate_limited' },
});

const GRAPH_BASE = 'https://graph.instagram.com/v18.0';
const CACHE_TTL = 3600; // 1 hour

const igCache = createTTLCache(CACHE_TTL);

// An expired token needs a person in the Meta dashboard, not a retry, so it is
// worth telling apart from a transient upstream error. Instagram reports it as
// OAuthException / code 190.
class InstagramApiError extends Error {
  constructor(status, body) {
    super(`Instagram API ${status}: ${body}`);
    this.status = status;
    this.body = body;
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      parsed = null;
    }
    const error = parsed && parsed.error;
    this.isTokenExpired = !!error && (error.code === 190 || error.type === 'OAuthException');
    this.detail = error?.message || null;
  }
}

const fetchJSON = async url => {
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new InstagramApiError(r.status, body);
  }
  return r.json();
};

router.get('/feed', feedRateLimit, async (_req, res) => {
  const ACCESS_TOKEN = await getInstagramTokenService()
    .getAccessToken()
    .catch(() => process.env.INSTAGRAM_ACCESS_TOKEN || null);

  if (!ACCESS_TOKEN) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  // createTTLCache returns a Proxy: every get yields an envelope
  // { data, timestamp, expiresAt } with `data: null` on miss/expired.
  const { data: cachedFeed } = igCache.feed || {};
  if (cachedFeed) {
    return res.json(cachedFeed);
  }

  try {
    const [mediaData, profileData] = await Promise.all([
      fetchJSON(
        `${GRAPH_BASE}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=12&access_token=${ACCESS_TOKEN}`
      ),
      fetchJSON(
        `${GRAPH_BASE}/me?fields=name,username,profile_picture_url&access_token=${ACCESS_TOKEN}`
      ),
    ]);

    const result = {
      ok: true,
      profile: {
        name: profileData.name || 'Archivo Vintach',
        username: profileData.username || 'archivovintach',
        profilePictureUrl: profileData.profile_picture_url || null,
      },
      posts: (mediaData.data || []).map(p => ({
        id: p.id,
        mediaUrl: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url,
        videoUrl: p.media_type === 'VIDEO' ? p.media_url || null : null,
        permalink: p.permalink,
        caption: p.caption || '',
        likeCount: p.like_count ?? null,
        commentsCount: p.comments_count ?? null,
        mediaType: p.media_type,
        timestamp: p.timestamp || null,
      })),
    };

    igCache.feed = result;
    return res.json(result);
  } catch (e) {
    if (e.isTokenExpired) {
      // Silence here is what let the token stay dead for seven weeks in 2026.
      // Say plainly what has to happen, and use a status that reads as
      // "operator action required" rather than "upstream hiccup".
      console.error(
        '[instagram] ACCESS TOKEN REJECTED — the feed is hidden until a new long-lived token is ' +
          'minted in the Meta dashboard and set as INSTAGRAM_ACCESS_TOKEN on this environment. ' +
          'Instagram said:',
        e.detail || e.message
      );
      return res.status(503).json({ ok: false, error: 'token_expired' });
    }
    console.error('[instagram] feed fetch failed:', e.message);
    return res.status(502).json({ ok: false, error: 'fetch_failed' });
  }
});

module.exports = router;
