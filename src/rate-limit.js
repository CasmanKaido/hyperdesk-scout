export function createRateLimiter({
  limit = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 60),
  windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  now = () => Date.now(),
} = {}) {
  const buckets = new Map();

  return {
    consume(key = "unknown") {
      const currentTime = now();
      const existing = buckets.get(key);
      const bucket = !existing || currentTime >= existing.resetAt
        ? { count: 0, resetAt: currentTime + windowMs }
        : existing;

      bucket.count += 1;
      buckets.set(key, bucket);
      return {
        allowed: bucket.count <= limit,
        limit,
        remaining: Math.max(0, limit - bucket.count),
        resetAt: bucket.resetAt,
      };
    },
  };
}
