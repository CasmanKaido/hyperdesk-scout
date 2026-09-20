import { ValidationError } from "./service.js";

const TOPICS = ["funding", "basis", "liquidity", "risk"];

export function validateMarketOverviewInput(input = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  for (const field of Object.keys(input)) {
    if (!["symbols", "topics", "question"].includes(field)) throw new ValidationError(`Unknown request field: ${field}`);
  }
  if (!Array.isArray(input.symbols) || input.symbols.length < 1 || input.symbols.length > 50) {
    throw new ValidationError("symbols must contain between 1 and 50 items");
  }
  const symbols = input.symbols.map((symbol) => {
    if (typeof symbol !== "string" || !/^[A-Za-z0-9:_-]{1,30}$/.test(symbol)) {
      throw new ValidationError("Each symbol must be a valid Hyperliquid market name");
    }
    return symbol.toUpperCase();
  });
  const topics = input.topics === undefined ? TOPICS : input.topics;
  if (!Array.isArray(topics) || topics.length < 1 || topics.length > 4 || topics.some((topic) => !TOPICS.includes(topic))) {
    throw new ValidationError("topics must contain between 1 and 4 items from funding, basis, liquidity, risk");
  }
  const question = input.question === undefined ? null : input.question;
    if (question !== null && (typeof question !== "string" || question.trim().length < 1 || question.trim().length > 1000)) {
      throw new ValidationError("question must be between 1 and 1000 characters");
    }
    return { symbols: [...new Set(symbols)], topics: [...new Set(topics)], ...(question === null ? {} : { question: question.trim() }) };
}

function numeric(value, valid = () => true) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && valid(number) ? number : null;
}

/**
 * Read-only contract: {generated_at, query:{symbols,topics}, evidence, markets,
 * notices, execution_included:false}. The HTTP handler adds request_id.
 * Evidence describes the shared provider snapshot, NOT an exchange timestamp.
 * Each requested symbol has {symbol,status,facts,calculations,notices}; topic
 * objects are included only when requested. Missing/invalid facts or calculation
 * inputs yield null and notices, never synthetic zeroes. Unavailable markets
 * have the same topic shape with null values. No ranking or financial filters.
 *
 * Facts: funding.hourly_rate; basis.{mark_price,oracle_price};
 * liquidity.{open_interest_base,volume_24h_usd,impact_bid_price,impact_ask_price};
 * risk.{max_leverage,is_delisted}. Prices and notionals are USD-denominated.
 * Calculations: funding.annualized_simple_percent = hourly_rate * 24 * 365 * 100;
 * basis.mark_oracle_deviation_percent = (mark-oracle)/oracle * 100 (NOT executable basis);
 * liquidity.open_interest_notional_usd = open_interest_base * mark_price;
 * liquidity.impact_spread_bps = (ask-bid)/((ask+bid)/2) * 10000.
 * Risk exposes venue metadata and limitations, not a preference or risk score.
 */
export function buildMarketOverview(markets, input, metadata = {}) {
  const bySymbol = new Map(markets.map((market) => [market.symbol.toUpperCase(), market]));
  const fetchedAt = typeof metadata.fetchedAt === "string" && Number.isFinite(Date.parse(metadata.fetchedAt))
    ? metadata.fetchedAt : null;
  const ageMs = numeric(metadata.ageMs, (value) => value >= 0);
  const cacheStatus = metadata.cacheStatus ?? null;
  const notices = ["fetch_timestamp_not_exchange_timestamp"];
  if (fetchedAt === null) notices.push("missing:fetched_at");
  if (ageMs === null) notices.push("missing:age_ms");
  if (cacheStatus === null) notices.push("missing:cache_status");
  if (cacheStatus === "stale_fallback") notices.push("stale_market_data");

  return {
    generated_at: (metadata.generatedAt ?? new Date()).toISOString(),
    query: { symbols: input.symbols, topics: input.topics },
    evidence: {
      source: "Hyperliquid",
      endpoint: "/info",
      request_type: "metaAndAssetCtxs",
      fetched_at: fetchedAt,
      age_ms: ageMs,
      cache_status: cacheStatus,
      data_status: cacheStatus === "stale_fallback" ? "stale"
        : fetchedAt !== null && ageMs !== null && ["hit", "miss"].includes(cacheStatus) ? "fresh" : "unknown",
    },
    markets: input.symbols.map((symbol) => {
      const market = bySymbol.get(symbol);
      const facts = {};
      const calculations = {};
      const notices = market ? [] : ["market_unavailable"];
      const read = (field, value, valid) => {
        const number = numeric(value, valid);
        if (number === null) notices.push(`missing_or_invalid:${field}`);
        return number;
      };
      const calculate = (field, values, formula) => {
        if (values.some((value) => value === null)) return null;
        const result = formula(...values);
        if (Number.isFinite(result)) return result;
        notices.push(`non_finite_calculation:${field}`);
        return null;
      };
      const positive = (value) => value > 0;
      const nonnegative = (value) => value >= 0;
      // Mark is also evidence for the liquidity notional calculation.
      const mark = input.topics.includes("basis") || input.topics.includes("liquidity")
        ? read("mark_price", market?.markPx, positive) : null;
      if (input.topics.includes("funding")) {
        const rate = read("hourly_rate", market?.funding);
        facts.funding = { hourly_rate: rate };
        calculations.funding = {
          annualized_simple_percent: calculate("annualized_simple_percent", [rate], (rate) => rate * 24 * 365 * 100),
        };
        notices.push("funding_annualization_not_forecast", "funding_can_reverse");
      }
      if (input.topics.includes("basis")) {
        const oracle = read("oracle_price", market?.oraclePx, positive);
        facts.basis = { mark_price: mark, oracle_price: oracle };
        calculations.basis = {
          mark_oracle_deviation_percent: calculate("mark_oracle_deviation_percent", [mark, oracle], (mark, oracle) => (mark - oracle) / oracle * 100),
        };
        notices.push("mark_oracle_deviation_not_executable_basis");
      }
      if (input.topics.includes("liquidity")) {
        const oi = read("open_interest_base", market?.openInterest, nonnegative);
        const volume = read("volume_24h_usd", market?.dayNtlVlm, nonnegative);
        const bid = read("impact_bid_price", market?.impactPxs?.[0], positive);
        const ask = read("impact_ask_price", market?.impactPxs?.[1], positive);
        facts.liquidity = {
          mark_price: mark,
          open_interest_base: oi,
          volume_24h_usd: volume,
          impact_bid_price: bid,
          impact_ask_price: ask,
        };
        const crossed = bid !== null && ask !== null && ask < bid;
        if (crossed) notices.push("invalid:crossed_impact_prices");
        calculations.liquidity = {
          open_interest_notional_usd: calculate("open_interest_notional_usd", [oi, mark], (oi, mark) => oi * mark),
          impact_spread_bps: crossed ? null : calculate("impact_spread_bps", [bid, ask], (bid, ask) => (ask - bid) / (ask / 2 + bid / 2) * 10_000),
        };
        notices.push("liquidity_metrics_not_executable_quotes_or_fill_guarantees");
      }
      if (input.topics.includes("risk")) {
        const delisted = typeof market?.isDelisted === "boolean" ? market.isDelisted : null;
        facts.risk = {
          max_leverage: read("max_leverage", market?.maxLeverage, positive),
          is_delisted: delisted,
        };
        if (delisted === null) notices.push("missing_or_invalid:is_delisted");
        notices.push("venue_max_leverage_not_recommendation", "snapshot_not_comprehensive_risk_assessment");
      }
      return { symbol, status: market ? "available" : "unavailable", facts, calculations, notices };
    }),
    notices,
    execution_included: false,
  };
}
