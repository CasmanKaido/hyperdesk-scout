import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketOverview, validateMarketOverviewInput } from "../src/market-overview.js";
import { ValidationError } from "../src/service.js";

const market = {
  symbol: "ETH", funding: "-0.0001", markPx: "101", oraclePx: "100",
  openInterest: "2", dayNtlVlm: "0", impactPxs: ["99", "101"],
  maxLeverage: 25, isDelisted: false,
};
const metadata = {
  generatedAt: new Date("2026-09-19T00:00:01Z"),
  fetchedAt: "2026-09-19T00:00:00Z", ageMs: 1000, cacheStatus: "hit",
};
const build = (markets = [market], request = { symbols: ["ETH"] }, meta = metadata) =>
  buildMarketOverview(markets, validateMarketOverviewInput(request), meta);

test("requires symbols and rejects financial defaults, filters, and invalid topics", () => {
  for (const input of [null, [], {}, { symbols: [] }, { symbols: [" "] },
    { symbols: [1] }, { symbols: Array(51).fill("ETH") },
    ...[null, [], ["unknown"], "funding", Array(5).fill("funding")].map((topics) => ({ symbols: ["ETH"], topics })),
    ...["risk_tolerance", "min_funding_apr", "max_leverage"].map((field) => ({ symbols: ["ETH"], [field]: 0 })),
  ]) assert.throws(() => validateMarketOverviewInput(input), ValidationError);
  assert.deepEqual(validateMarketOverviewInput({ symbols: ["eth", "ETH", "btc"] }), {
    symbols: ["ETH", "BTC"], topics: ["funding", "basis", "liquidity", "risk"],
  });
});

test("returns exact contract, negative funding, raw facts and deterministic calculations", () => {
  const result = build();
  assert.deepEqual(Object.keys(result), ["generated_at", "query", "evidence", "markets", "notices", "execution_included"]);
  assert.deepEqual(result.evidence, {
    source: "Hyperliquid", endpoint: "/info", request_type: "metaAndAssetCtxs",
    fetched_at: metadata.fetchedAt, age_ms: 1000, cache_status: "hit", data_status: "fresh",
  });
  assert.deepEqual(result.markets[0], {
    symbol: "ETH", status: "available",
    facts: {
      funding: { hourly_rate: -0.0001 },
      basis: { mark_price: 101, oracle_price: 100 },
      liquidity: { mark_price: 101, open_interest_base: 2, volume_24h_usd: 0, impact_bid_price: 99, impact_ask_price: 101 },
      risk: { max_leverage: 25, is_delisted: false },
    },
    calculations: {
      funding: { annualized_simple_percent: -0.0001 * 24 * 365 * 100 },
      basis: { mark_oracle_deviation_percent: 1 },
      liquidity: { open_interest_notional_usd: 202, impact_spread_bps: 200 },
    },
    notices: ["funding_annualization_not_forecast", "funding_can_reverse", "mark_oracle_deviation_not_executable_basis",
      "liquidity_metrics_not_executable_quotes_or_fill_guarantees", "venue_max_leverage_not_recommendation", "snapshot_not_comprehensive_risk_assessment"],
  });
  assert.equal(result.execution_included, false);
});

test("preserves request order, unavailable entries and all funding signs without policy filtering", () => {
  const result = build([market, { ...market, symbol: "BTC", funding: "0" },
    { ...market, symbol: "SOL", funding: "0.001", dayNtlVlm: "1", isDelisted: true }],
  { symbols: ["SOL", "UNKNOWN", "ETH", "BTC"] });
  assert.deepEqual(result.markets.map((entry) => entry.symbol), ["SOL", "UNKNOWN", "ETH", "BTC"]);
  assert.equal(result.markets[1].status, "unavailable");
  assert.equal(result.markets[1].facts.funding.hourly_rate, null);
  assert.equal(result.markets[1].calculations.basis.mark_oracle_deviation_percent, null);
  assert.ok(result.markets[1].notices.includes("market_unavailable"));
  assert.equal(result.markets[3].calculations.funding.annualized_simple_percent, 0);
});

test("topics select evidence, not markets; liquidity includes its mark input", () => {
  const result = build([market], { symbols: ["ETH"], topics: ["liquidity", "liquidity"] });
  assert.deepEqual(result.query.topics, ["liquidity"]);
  assert.deepEqual(Object.keys(result.markets[0].facts), ["liquidity"]);
  assert.deepEqual(Object.keys(result.markets[0].calculations), ["liquidity"]);
  assert.equal(result.markets[0].facts.liquidity.mark_price, 101);
  const risk = build([market], { symbols: ["ETH"], topics: ["risk"] }).markets[0];
  assert.deepEqual(risk.calculations, {});
  assert.deepEqual(Object.keys(risk.facts), ["risk"]);
});

test("missing, blank, non-finite and invalid values are not fabricated as zero", () => {
  for (const value of [undefined, null, "", " ", "bad", Infinity, true, [], {}]) {
    const result = build([{ symbol: "ETH", funding: value, markPx: value, oraclePx: value,
      openInterest: value, dayNtlVlm: value, impactPxs: [value, value] }]).markets[0];
    assert.equal(result.facts.funding.hourly_rate, null);
    assert.equal(result.calculations.funding.annualized_simple_percent, null);
    assert.equal(result.calculations.basis.mark_oracle_deviation_percent, null);
    assert.equal(result.calculations.liquidity.open_interest_notional_usd, null);
    assert.equal(result.calculations.liquidity.impact_spread_bps, null);
    assert.ok(result.notices.includes("missing_or_invalid:hourly_rate"));
  }
  assert.equal(build([{ ...market, oraclePx: "0" }]).markets[0].calculations.basis.mark_oracle_deviation_percent, null);
  const crossed = build([{ ...market, impactPxs: ["101", "99"] }]).markets[0];
  assert.equal(crossed.calculations.liquidity.impact_spread_bps, null);
  assert.ok(crossed.notices.includes("invalid:crossed_impact_prices"));
  assert.equal(build([{ ...market, funding: "1e308" }]).markets[0].calculations.funding.annualized_simple_percent, null);
});

test("reports stale and missing provenance without inventing freshness", () => {
  const stale = build([market], { symbols: ["ETH"] }, { ...metadata, cacheStatus: "stale_fallback", ageMs: 20000 });
  assert.equal(stale.evidence.data_status, "stale");
  assert.equal(stale.evidence.age_ms, 20000);
  assert.ok(stale.notices.includes("stale_market_data"));
  const missing = build([market], { symbols: ["ETH"] }, {});
  assert.equal(missing.evidence.fetched_at, null);
  assert.equal(missing.evidence.age_ms, null);
  assert.equal(missing.evidence.cache_status, null);
  assert.equal(missing.evidence.data_status, "unknown");
  assert.deepEqual(missing.notices, ["fetch_timestamp_not_exchange_timestamp", "missing:fetched_at", "missing:age_ms", "missing:cache_status"]);
});
