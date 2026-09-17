import { fetchPerpMarkets } from "./hyperliquid.js";

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export function createMarketDataProvider({
  fetchMarkets = fetchPerpMarkets,
  cacheTtlMs = numberFromEnv("MARKET_DATA_CACHE_TTL_MS", 10_000),
  maxStaleMs = numberFromEnv("MARKET_DATA_MAX_AGE_MS", 30_000),
  now = () => Date.now(),
} = {}) {
  let cached = null;
  let inflight = null;

  const describe = (entry, cacheStatus, currentTime, fetchDurationMs = 0) => ({
    markets: entry.markets,
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    ageMs: Math.max(0, currentTime - entry.fetchedAt),
    cacheStatus,
    fetchDurationMs,
  });

  return async function getMarketData() {
    const currentTime = now();
    if (cached && currentTime - cached.fetchedAt <= cacheTtlMs) {
      return describe(cached, "hit", currentTime);
    }

    if (!inflight) {
      const startedAt = now();
      inflight = fetchMarkets()
        .then((markets) => {
          const fetchedAt = now();
          cached = { markets, fetchedAt };
          return describe(cached, "miss", fetchedAt, Math.max(0, fetchedAt - startedAt));
        })
        .finally(() => {
          inflight = null;
        });
    }

    try {
      return await inflight;
    } catch (error) {
      const fallbackTime = now();
      if (cached && fallbackTime - cached.fetchedAt <= maxStaleMs) {
        return describe(cached, "stale_fallback", fallbackTime);
      }
      throw error;
    }
  };
}
