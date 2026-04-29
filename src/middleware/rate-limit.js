const { HttpError } = require('../errors/http-error');

const buckets = new Map();

function cleanupExpiredEntries(now) {
  for (const [key, expiresAt] of buckets.entries()) {
    if (expiresAt <= now) {
      buckets.delete(key);
    }
  }
}

function createIpRateLimit({ windowMs, keyPrefix }) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error('windowMs must be a positive number');
  }

  return function ipRateLimit(req, res, next) {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    const bucketKey = `${keyPrefix}:${clientIp}`;
    const expiresAt = buckets.get(bucketKey);

    if (expiresAt && expiresAt > now) {
      const retryAfterSeconds = Math.ceil((expiresAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.setHeader('RateLimit-Limit', '1');
      res.setHeader('RateLimit-Remaining', '0');
      res.setHeader('RateLimit-Reset', String(retryAfterSeconds));

      next(new HttpError(429, 'Too many requests. Please wait 20 seconds before generating another PDF.'));
      return;
    }

    const nextExpiresAt = now + windowMs;
    buckets.set(bucketKey, nextExpiresAt);

    res.setHeader('RateLimit-Limit', '1');
    res.setHeader('RateLimit-Remaining', '0');
    res.setHeader('RateLimit-Reset', String(Math.ceil(windowMs / 1000)));

    next();
  };
}

module.exports = { createIpRateLimit };
