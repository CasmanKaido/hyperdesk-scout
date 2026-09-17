import test from "node:test";
import assert from "node:assert/strict";
import { createRequestHandler } from "../src/handler.js";
import { UpstreamError } from "../src/hyperliquid.js";
import { createRateLimiter } from "../src/rate-limit.js";

const market = {
  symbol: "ETH",
  maxLeverage: 25,
  funding: "0.0000125",
  markPx: "2453.87",
  oraclePx: "2454.93",
  openInterest: "974189.135",
  dayNtlVlm: "1465965463.517",
  impactPxs: ["2454.0", "2454.1"],
};

const silentLogger = { info() {}, error() {} };

function handlerWith(getMarketData) {
  return createRequestHandler({
    getMarketData,
    requestId: () => "req_test",
    now: () => new Date("2026-09-17T00:00:01Z"),
    logger: silentLogger,
  });
}

test("handles health without market data", async () => {
  const handle = handlerWith(async () => { throw new Error("should not run"); });
  const result = await handle({ method: "GET", pathname: "/health" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: "ok", service: "hyperdesk-scout", version: "0.1.0" });
});

test("returns a structured funding scan with freshness metadata", async () => {
  const handle = handlerWith(async () => ({
    markets: [market],
    fetchedAt: "2026-09-17T00:00:00.000Z",
    ageMs: 1000,
    cacheStatus: "miss",
    fetchDurationMs: 25,
  }));
  const result = await handle({
    method: "POST",
    pathname: "/api/v1/funding-scan",
    bodyText: JSON.stringify({ symbols: ["ETH"], risk_tolerance: "aggressive" }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.request_id, "req_test");
  assert.equal(result.body.opportunities[0].symbol, "ETH");
  assert.equal(result.body.data_status, "fresh");
  assert.deepEqual(result.body.market_data, {
    fetched_at: "2026-09-17T00:00:00.000Z",
    age_ms: 1000,
    cache_status: "miss",
    fetch_duration_ms: 25,
  });
});

test("returns stable validation and upstream errors", async () => {
  const invalid = await handlerWith(async () => { throw new Error("should not run"); })({
    method: "POST",
    pathname: "/api/v1/funding-scan",
    bodyText: "{",
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, "invalid_request");

  const unavailable = await handlerWith(async () => { throw new UpstreamError("timed out", 504); })({
    method: "POST",
    pathname: "/api/v1/funding-scan",
    bodyText: "{}",
  });
  assert.equal(unavailable.status, 504);
  assert.equal(unavailable.body.error, "upstream_unavailable");
});

test("supports CORS preflight and limits scan requests", async () => {
  const handle = createRequestHandler({
    getMarketData: async () => ({
      markets: [market],
      fetchedAt: "2026-09-17T00:00:00.000Z",
      ageMs: 0,
      cacheStatus: "hit",
      fetchDurationMs: 0,
    }),
    requestId: () => "req_test",
    rateLimiter: createRateLimiter({ limit: 1 }),
    logger: silentLogger,
  });

  const preflight = await handle({ method: "OPTIONS", pathname: "/api/v1/funding-scan" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers["access-control-allow-origin"], "*");

  const request = {
    method: "POST",
    pathname: "/api/v1/funding-scan",
    clientIp: "127.0.0.1",
    bodyText: JSON.stringify({ symbols: ["ETH"], risk_tolerance: "aggressive" }),
  };
  assert.equal((await handle(request)).status, 200);
  const limited = await handle(request);
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error, "rate_limited");
});

test("returns a documented not-found error", async () => {
  const result = await handlerWith(async () => ({ markets: [] }))({ method: "GET", pathname: "/missing" });
  assert.equal(result.status, 404);
  assert.deepEqual(result.body, { request_id: "req_test", error: "not_found", message: "Route not found" });
});
