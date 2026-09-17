import test from "node:test";
import assert from "node:assert/strict";
import { createMarketDataProvider } from "../src/market-data.js";

const markets = [{ symbol: "ETH" }];

test("caches market data within the configured TTL", async () => {
  let calls = 0;
  let time = 1000;
  const provider = createMarketDataProvider({
    fetchMarkets: async () => { calls += 1; return markets; },
    cacheTtlMs: 100,
    now: () => time,
  });

  const first = await provider();
  time = 1050;
  const second = await provider();

  assert.equal(calls, 1);
  assert.equal(first.cacheStatus, "miss");
  assert.equal(second.cacheStatus, "hit");
  assert.equal(second.ageMs, 50);
});

test("uses bounded stale data when refresh fails", async () => {
  let calls = 0;
  let time = 1000;
  const provider = createMarketDataProvider({
    fetchMarkets: async () => {
      calls += 1;
      if (calls === 1) return markets;
      throw new Error("upstream down");
    },
    cacheTtlMs: 100,
    maxStaleMs: 500,
    now: () => time,
  });

  await provider();
  time = 1200;
  const stale = await provider();
  assert.equal(stale.cacheStatus, "stale_fallback");
  assert.equal(stale.ageMs, 200);

  time = 1600;
  await assert.rejects(provider, /upstream down/);
});

test("coalesces concurrent refreshes", async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const provider = createMarketDataProvider({
    fetchMarkets: async () => { calls += 1; await pending; return markets; },
    now: () => 1000,
  });

  const first = provider();
  const second = provider();
  release();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});
