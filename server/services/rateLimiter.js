function createRateLimiter({ windowMs = 60_000, max = 10, message = "请求过于频繁，请稍后再试。" } = {}) {
  const buckets = new Map();

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    const key = Array.isArray(ip) ? ip[0] : String(ip).split(",")[0].trim();
    const current = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > current.resetAt) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }

    current.count += 1;
    buckets.set(key, current);

    if (current.count > max) {
      res.status(429).json({
        ok: false,
        message,
        fallbackAvailable: true
      });
      return;
    }

    next();
  };
}

module.exports = { createRateLimiter };
