import test from "node:test";
import assert from "node:assert/strict";
import { createResearchEvidenceProvider } from "../src/research-evidence.js";

const HOUR = 3_600_000;
const END = Date.parse("2026-09-19T12:30:00Z");
const LAST = Math.floor(END / HOUR) * HOUR;
const row = (hoursAgo = 0, rate = "0.0001", coin = "BTC") => ({ coin, fundingRate: rate, premium: "0", time: LAST - hoursAgo * HOUR + 76 });
const history = (rate = "0.0001", coin = "BTC") => Array.from({ length: 72 }, (_, i) => row(71 - i, rate, coin));
const book = (coin = "BTC", time = END) => ({ coin, time, levels: [
  [{ px: "99.95", sz: "2", n: 50 }, { px: "99.90", sz: "3", n: 2 }, { px: "99", sz: "100", n: 1 }],
  [{ px: "100.05", sz: "4", n: 1 }, { px: "100.10", sz: "5", n: 2 }, { px: "101", sz: "100", n: 1 }],
] });
const response = (data) => ({ ok: true, json: async () => data });
function fixture(resolver = ({ type, coin }) => type === "fundingHistory" ? history("0.0001", coin) : book(coin), options = {}) {
  const calls = [];
  const enrich = createResearchEvidenceProvider({ now: () => END, ...options, fetchImpl: async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, init, body });
    return response(await resolver(body));
  } });
  return { enrich, calls };
}
const query = { symbols: ["BTC"], topics: ["funding", "liquidity", "risk"] };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("documented POST contracts, 72 unique hourly settlements, and retrospective formulas", async () => {
  const { enrich, calls } = fixture();
  const result = await enrich(query);
  assert.deepEqual(Object.keys(result), ["window_hours", "markets", "limitations"]);
  assert.equal(result.window_hours, 72);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, { type: "fundingHistory", coin: "BTC", startTime: END - 72 * HOUR, endTime: END });
  assert.deepEqual(calls[1].body, { type: "l2Book", coin: "BTC" });
  for (const call of calls) {
    assert.equal(call.url, "https://api.hyperliquid.xyz/info");
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.headers["Content-Type"], "application/json");
    assert.ok(call.init.signal instanceof AbortSignal);
  }
  const f = result.markets[0].funding_history;
  assert.equal(f.status, "available");
  assert.equal(f.observed_samples, 72);
  assert.equal(f.expected_samples, 72);
  assert.equal(f.coverage, 1);
  assert.equal(f.missing_samples, 0);
  assert.equal(f.gap_hours, 0);
  close(f.sum_realized_rates_pct, 0.72);
  close(f.hourly_mean_rate, 0.0001);
  close(f.retrospective_simple_apr_pct, 87.6);
  assert.equal(f.positive_share, 1);
  assert.equal(f.sign_reversals, 0);
  assert.equal(f.latest_time, LAST + 76);
  assert.equal(f.latest_rate, 0.0001);
  assert.equal(f.stale, false);
  assert.equal(f.source.source_time, LAST + 76);
  assert.equal(f.source.fetched_at, END);
  assert.ok(f.notices.includes("retrospective_simple_apr_not_forecast_or_guarantee"));
});

test("gaps, duplicate hours, invalid rows, future/outside window, and reversals are explicit", async () => {
  const rows = [row(5, "0.001"), row(4, "-0.002"), row(2, "0.003"), row(1, "0"), row(0, "-0.004")];
  rows.push({ ...rows[0] }, { ...rows[0], time: rows[0].time + 1 }, row(72), row(-1), row(3, ""), row(3, null), row(3, "0.1", "ETH"));
  const { enrich } = fixture(() => rows.reverse());
  const f = (await enrich({ symbols: ["BTC"], topics: ["funding"] })).markets[0].funding_history;
  assert.equal(f.status, "limited");
  assert.equal(f.observed_samples, 5);
  assert.equal(f.missing_samples, 67);
  assert.equal(f.gap_hours, 1);
  assert.equal(f.duplicate_rows, 2);
  assert.equal(f.invalid_rows, 3);
  assert.equal(f.sign_reversals, 1); // No inference across the missing hour or zero.
  close(f.coverage, 5 / 72);
  close(f.sum_realized_rates_pct, -0.2);
  close(f.hourly_mean_rate, -0.0004);
  close(f.retrospective_simple_apr_pct, -350.4);
  close(f.positive_share, 2 / 5);
});

test("conflicting duplicate settlements excluded; negative history and stale coverage retained", async () => {
  const { enrich } = fixture(() => [row(3, "-0.001"), row(2, "-0.002"), row(2, "0.002"), row(1, "-0.003")]);
  const f = (await enrich(query)).markets[0].funding_history;
  assert.equal(f.observed_samples, 2);
  assert.equal(f.stale, true);
  assert.equal(f.positive_share, 0);
  close(f.sum_realized_rates_pct, -0.4);
  assert.ok(f.notices.includes("conflicting_duplicate_hours_excluded"));
  assert.ok(f.notices.includes("stale_funding_latest_expected_hour_missing"));
});

test("exact boundary window has 72 slots, not 73", async () => {
  const end = LAST;
  const rows = Array.from({ length: 73 }, (_, i) => ({ ...row(i), time: end - i * HOUR }));
  const { enrich } = fixture(() => rows, { now: () => end });
  const f = (await enrich(query)).markets[0].funding_history;
  assert.equal(f.observed_samples, 72);
  assert.equal(f.latest_time, end);
});

test("visible book spread, midpoint 10bps notional and counts use px*sz, never n", async () => {
  const { enrich } = fixture();
  const b = (await enrich(query)).markets[0].order_book;
  assert.equal(b.status, "available");
  close(b.spread_bps, 10);
  assert.equal(b.best_bid, 99.95);
  assert.equal(b.best_ask, 100.05);
  close(b.bid_visible_notional_within_10bps, 99.95 * 2 + 99.9 * 3);
  close(b.ask_visible_notional_within_10bps, 100.05 * 4 + 100.1 * 5);
  assert.equal(b.top_level_count, 6);
  assert.equal(b.bid_level_count, 3);
  assert.equal(b.ask_level_count, 3);
  assert.equal(b.snapshot_time, END);
  assert.equal(b.source.source_time, END);
  assert.ok(b.notices.includes("limited_visible_book_at_most_20_levels_per_side_not_full_depth"));
});

test("crossed/locked book has no spread or derived notional; stale book explicitly limited", async () => {
  for (const bid of [100.05, 101]) {
    const data = book();
    data.levels[0][0].px = String(bid);
    const { enrich } = fixture(() => data);
    const b = (await enrich({ symbols: ["BTC"], topics: ["risk"] })).markets[0].order_book;
    assert.equal(b.status, "unavailable");
    assert.equal(b.spread_bps, null);
    assert.equal(b.bid_visible_notional_within_10bps, null);
    assert.ok(b.notices.includes("crossed_or_locked_order_book"));
  }
  const { enrich } = fixture(() => book("BTC", END - 60_001));
  const b = (await enrich(query)).markets[0].order_book;
  assert.equal(b.status, "limited");
  assert.equal(b.stale, true);
  assert.equal(b.age_ms, 60_001);
  assert.ok(b.notices.includes("stale_order_book"));
});

test("missing, invalid and empty funding never fabricate rates", async () => {
  for (const data of [null, {}, [], [row(0, null)], [row(0, "Infinity")], [row(0, true)]]) {
    const { enrich } = fixture(() => data);
    const f = (await enrich(query)).markets[0].funding_history;
    assert.equal(f.status, "unavailable");
    for (const key of ["sum_realized_rates_pct", "hourly_mean_rate", "retrospective_simple_apr_pct", "positive_share", "latest_rate", "latest_time", "sign_reversals"]) assert.equal(f[key], null);
    assert.ok(f.notices.length);
  }
});

test("invalid book sizes/times and empty sides are not invented; overflow is null", async () => {
  for (const sz of [null, "", "NaN", "-1", 0, true]) {
    const data = book();
    data.levels[0][0].sz = sz;
    const { enrich } = fixture(() => data);
    const b = (await enrich(query)).markets[0].order_book;
    assert.equal(b.best_bid, null);
    assert.equal(b.bid_visible_notional_within_10bps, null);
    assert.equal(b.spread_bps, null);
  }
  for (const time of [null, END + 1, "123"]) {
    const { enrich } = fixture(() => book("BTC", time));
    const b = (await enrich(query)).markets[0].order_book;
    assert.equal(b.snapshot_time, null);
    assert.equal(b.status, "limited");
  }
  const data = book();
  data.levels[0] = [];
  const empty = fixture(() => data);
  const b = (await empty.enrich(query)).markets[0].order_book;
  assert.equal(b.bid_level_count, 0);
  assert.equal(b.best_bid, null);
  assert.equal(b.bid_visible_notional_within_10bps, null);
  const huge = fixture(() => history("1e308"));
  const f = (await huge.enrich(query)).markets[0].funding_history;
  assert.equal(f.sum_realized_rates_pct, null);
  assert.equal(f.retrospective_simple_apr_pct, null);
});

test("topic routing, five-symbol limit, deduplication, and exact HIP-3 coin names", async () => {
  const { enrich, calls } = fixture();
  const result = await enrich({ symbols: ["BTC", "ETH", "SOL", "xyz:XYZ100", "HYPE", "DOGE", "ADA", "BTC"], topics: ["risk"] });
  assert.equal(result.markets.length, 5);
  assert.equal(calls.length, 5);
  assert.ok(calls.every(({ body }) => body.type === "l2Book"));
  assert.equal(calls[3].body.coin, "xyz:XYZ100");
  assert.deepEqual(result.limitations, ["skipped:DOGE:five_symbol_enrichment_limit", "skipped:ADA:five_symbol_enrichment_limit"]);
  assert.ok(result.markets.every((m) => m.funding_history.status === "not_requested"));
  await enrich({ symbols: ["BTC"], topics: ["basis"] });
  assert.equal(calls.length, 5);
  await enrich({ symbols: ["BTC"], topics: ["funding"] });
  assert.equal(calls.length, 6);
});

test("partial fetch failures isolated by market and endpoint; failures not cached", async () => {
  const { enrich, calls } = fixture(({ type, coin }) => {
    if (type === "fundingHistory" && coin === "BTC") throw new Error("secret upstream detail");
    return type === "fundingHistory" ? history("0.0001", coin) : book(coin);
  });
  const input = { ...query, symbols: ["BTC", "ETH"] };
  const result = await enrich(input);
  assert.equal(result.markets[0].funding_history.status, "unavailable");
  assert.equal(result.markets[0].order_book.status, "available");
  assert.equal(result.markets[1].funding_history.status, "available");
  assert.ok(!JSON.stringify(result).includes("secret"));
  await enrich(input);
  assert.equal(calls.length, 5);
});

test("60 second TTL, current-window reevaluation, cache isolation, and LRU bound", async () => {
  let clock = END;
  const { enrich, calls } = fixture(undefined, { now: () => clock, maxCacheEntries: 2 });
  const request = (coin) => enrich({ symbols: [coin], topics: ["funding"] });
  const first = await request("BTC");
  first.markets[0].funding_history.notices.push("mutated");
  clock += 59_999;
  const hit = await request("BTC");
  assert.equal(calls.length, 1);
  assert.equal(hit.markets[0].funding_history.source.cache_status, "hit");
  assert.equal(hit.markets[0].funding_history.source.age_ms, 59_999);
  assert.ok(!hit.markets[0].funding_history.notices.includes("mutated"));
  clock++;
  await request("BTC");
  assert.equal(calls.length, 2);
  await request("ETH");
  await request("BTC"); // Touch BTC; evict ETH next.
  await request("SOL");
  await request("ETH");
  assert.equal(calls.length, 5);
});

test("cached funding across an hour boundary does not claim complete current coverage", async () => {
  let clock = LAST + HOUR - 10_000;
  const { enrich } = fixture(() => history(), { now: () => clock });
  await enrich(query);
  clock += 20_000;
  const f = (await enrich(query)).markets[0].funding_history;
  assert.equal(f.source.cache_status, "hit");
  assert.equal(f.observed_samples, 71);
  assert.equal(f.stale, true);
  assert.equal(f.status, "limited");
});

test("provider-wide concurrency <=4 and inflight dedupe across simultaneous enrich calls", async () => {
  let active = 0;
  let peak = 0;
  const { enrich, calls } = fixture(async ({ type, coin }) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return type === "fundingHistory" ? history("0.0001", coin) : book(coin);
  });
  const input = { ...query, symbols: ["BTC", "ETH", "SOL", "HYPE", "DOGE"] };
  const results = await Promise.all([enrich(input), enrich(input), enrich(input)]);
  assert.equal(peak, 4);
  assert.equal(calls.length, 10);
  assert.equal(results[1].markets[0].funding_history.source.cache_status, "inflight");
  assert.ok(results.every((r) => r.markets.every((m) => m.order_book.status === "available")));
});

test("timeout aborts fetch, includes body-read timeout, and releases capacity", async () => {
  for (const hangBody of [false, true]) {
    let signal;
    const enrich = createResearchEvidenceProvider({ now: () => END, timeoutMs: 10, fetchImpl: async (_, init) => {
      signal = init.signal;
      const pending = new Promise(() => {});
      return hangBody ? { ok: true, json: () => pending } : pending;
    } });
    const result = await enrich({ symbols: ["BTC"], topics: ["funding"] });
    assert.equal(signal.aborted, true);
    assert.equal(result.markets[0].funding_history.status, "unavailable");
    assert.ok(result.markets[0].funding_history.notices.includes("fundingHistory:timeout"));
  }
});

test("abort-ignoring transports never exceed four active fetches and queued calls time out", async () => {
  let calls = 0;
  const enrich = createResearchEvidenceProvider({ now: () => END, timeoutMs: 10, fetchImpl: () => {
    calls++;
    return new Promise(() => {});
  } });
  const input = { ...query, symbols: ["BTC", "ETH", "SOL", "HYPE", "DOGE"] };
  const result = await enrich(input);
  assert.equal(calls, 4);
  assert.ok(result.markets.every((m) => m.funding_history.status === "unavailable" && m.order_book.status === "unavailable"));
  await enrich(input);
  assert.equal(calls, 4);
});

test("bounded payloads, malformed JSON, HTTP failures, and standard streamed Response", async () => {
  for (const resp of [new Response("nope"), new Response("{}", { status: 429 }),
    new Response(" ".repeat(131_073)), response(Array(501).fill(row()))]) {
    const enrich = createResearchEvidenceProvider({ now: () => END, fetchImpl: async () => resp });
    const f = (await enrich({ symbols: ["BTC"], topics: ["funding"] })).markets[0].funding_history;
    assert.equal(f.status, "unavailable");
  }
  const enrich = createResearchEvidenceProvider({ now: () => END, fetchImpl: async () => new Response(JSON.stringify(history())) });
  assert.equal((await enrich({ symbols: ["BTC"], topics: ["funding"] })).markets[0].funding_history.status, "available");
});

test("limits cannot be configured beyond safety bounds", () => {
  for (const options of [{ timeoutMs: 5001 }, { maxConcurrency: 5 }, { cacheTtlMs: 60_001 }, { maxCacheEntries: Infinity }]) {
    assert.throws(() => createResearchEvidenceProvider(options), RangeError);
  }
});
