import test from "node:test";
import assert from "node:assert/strict";
import { fetchPerpMarkets, UpstreamError } from "../src/hyperliquid.js";

const response = (payload, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => payload,
});

test("maps and filters Hyperliquid market metadata", async () => {
  const markets = await fetchPerpMarkets({
    fetchImpl: async () => response([
      { universe: [
        { name: "ETH", maxLeverage: 25 },
        { name: "OLD", maxLeverage: 3, isDelisted: true },
      ] },
      [{ markPx: "2000" }, { markPx: "1" }],
    ]),
  });
  assert.deepEqual(markets, [{ symbol: "ETH", maxLeverage: 25, isDelisted: false, markPx: "2000" }]);
});

test("rejects HTTP and malformed upstream responses", async () => {
  await assert.rejects(
    fetchPerpMarkets({ fetchImpl: async () => response({}, { ok: false, status: 503 }) }),
    (error) => error instanceof UpstreamError && error.status === 502,
  );
  await assert.rejects(
    fetchPerpMarkets({ fetchImpl: async () => response({ unexpected: true }) }),
    /unexpected payload/,
  );
});

test("turns an abort into a gateway timeout", async () => {
  const fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  await assert.rejects(
    fetchPerpMarkets({ fetchImpl, timeoutMs: 1 }),
    (error) => error instanceof UpstreamError && error.status === 504,
  );
});
