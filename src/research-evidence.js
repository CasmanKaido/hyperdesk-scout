const HOUR = 3_600_000;
const WINDOW = 72 * HOUR;
const API_URL = "https://api.hyperliquid.xyz/info";
const DOCS = "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint";
const MAX_BYTES = 131_072;

function numeric(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}
const timestamp = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const finite = (value) => Number.isFinite(value) ? value : null;

function fundingEmpty(status, notices = []) {
  return { status, observed_samples: null, expected_samples: 72, coverage: null,
    missing_samples: null, gap_hours: null, stale: null, duplicate_rows: null,
    invalid_rows: null, sum_realized_rates_pct: null, hourly_mean_rate: null,
    retrospective_simple_apr_pct: null, positive_share: null, sign_reversals: null,
    latest_rate: null, latest_time: null, notices };
}
function bookEmpty(status, notices = []) {
  return { status, snapshot_time: null, age_ms: null, stale: null,
    best_bid: null, best_ask: null, spread_bps: null,
    bid_visible_notional_within_10bps: null, ask_visible_notional_within_10bps: null,
    bid_level_count: null, ask_level_count: null, top_level_count: null,
    visible_band_bps: 10, band_reference: "snapshot_midpoint", notional_unit: "quote_currency",
    notices };
}

function fundingStats(data, symbol, end) {
  const result = fundingEmpty("unavailable", [
    "observed_realized_rates_only_not_position_pnl",
    "retrospective_simple_apr_not_forecast_or_guarantee",
    "positive_funding_longs_pay_shorts_negative_funding_shorts_pay_longs",
    "sign_reversals_count_only_adjacent_observed_hours_zero_is_not_a_sign",
  ]);
  if (!Array.isArray(data) || data.length > 500) {
    result.notices.push("missing_or_invalid:funding_history");
    return result;
  }
  const hours = new Map();
  const conflicts = new Set();
  let invalid = 0;
  let duplicates = 0;
  // Half-open (start, end] avoids counting 73 boundary settlements. Timestamps
  // can be a few milliseconds after the hour, as in the official example.
  const firstHour = Math.floor((end - WINDOW) / HOUR) + 1;
  const lastHour = Math.floor(end / HOUR);
  for (const row of data) {
    const time = timestamp(row?.time);
    const rate = numeric(row?.fundingRate);
    if (row?.coin !== symbol || time === null || rate === null) { invalid++; continue; }
    const hour = Math.floor(time / HOUR);
    if (time > end || hour < firstHour || hour > lastHour) continue;
    if (hours.has(hour) || conflicts.has(hour)) {
      duplicates++;
      if (hours.has(hour) && hours.get(hour).rate !== rate) {
        hours.delete(hour);
        conflicts.add(hour);
      }
      continue;
    }
    hours.set(hour, { time, rate, hour });
  }
  const rows = [...hours.values()].sort((a, b) => a.hour - b.hour);
  const count = rows.length;
  const latest = rows.at(-1);
  const sum = count ? finite(rows.reduce((total, row) => total + row.rate, 0)) : null;
  const mean = sum === null ? null : finite(sum / count);
  let gaps = 0;
  let reversals = 0;
  for (let index = 1; index < count; index++) {
    const prev = rows[index - 1];
    const row = rows[index];
    gaps += row.hour - prev.hour - 1;
    if (row.hour - prev.hour === 1 && Math.sign(row.rate) * Math.sign(prev.rate) === -1) reversals++;
  }
  Object.assign(result, {
    status: count ? "available" : "unavailable", observed_samples: count,
    coverage: count / 72, missing_samples: 72 - count, gap_hours: count ? gaps : null,
    stale: latest ? latest.hour < lastHour : null, duplicate_rows: duplicates,
    invalid_rows: invalid, sum_realized_rates_pct: sum === null ? null : finite(sum * 100),
    hourly_mean_rate: mean, retrospective_simple_apr_pct: mean === null ? null : finite(mean * 24 * 365 * 100),
    positive_share: count ? rows.filter((row) => row.rate > 0).length / count : null,
    sign_reversals: count > 1 ? reversals : null, latest_rate: latest?.rate ?? null,
    latest_time: latest?.time ?? null,
  });
  if (count < 72) result.notices.push("limited_coverage_missing_hours_not_extrapolated");
  if (gaps) result.notices.push("funding_history_gaps");
  if (result.stale) result.notices.push("stale_funding_latest_expected_hour_missing");
  if (invalid) result.notices.push("invalid_funding_rows_ignored");
  if (duplicates) result.notices.push("duplicate_hourly_settlements_deduplicated");
  if (conflicts.size) result.notices.push("conflicting_duplicate_hours_excluded");
  if (!count) result.notices.push("no_valid_hourly_settlements");
  if (count && [result.sum_realized_rates_pct, mean, result.retrospective_simple_apr_pct].includes(null)) {
    result.notices.push("non_finite_funding_calculation");
  }
  if (count && (count < 72 || invalid || conflicts.size || result.notices.includes("non_finite_funding_calculation"))) result.status = "limited";
  return result;
}

function bookStats(data, symbol, end, staleMs) {
  const result = bookEmpty("unavailable", [
    "limited_visible_book_at_most_20_levels_per_side_not_full_depth",
    "visible_notional_not_executable_quote_or_fill_guarantee_no_assumed_trade_notional",
  ]);
  if (data?.coin !== symbol || !Array.isArray(data?.levels) || data.levels.length !== 2) {
    result.notices.push("missing_or_invalid:order_book");
    return result;
  }
  result.snapshot_time = timestamp(data.time);
  if (result.snapshot_time === null || result.snapshot_time > end) {
    result.snapshot_time = null;
    result.notices.push("missing_or_invalid:snapshot_time");
  } else {
    result.age_ms = end - result.snapshot_time;
    result.stale = result.age_ms > staleMs;
    if (result.stale) result.notices.push("stale_order_book");
  }
  const sides = data.levels.map((levels, index) => {
    const name = index === 0 ? "bid" : "ask";
    if (!Array.isArray(levels) || levels.length > 20) {
      result.notices.push(`missing_or_invalid:${name}_levels`);
      return null;
    }
    result[`${name}_level_count`] = levels.length;
    const parsed = levels.map((level) => ({ px: numeric(level?.px), sz: numeric(level?.sz) }));
    if (!parsed.length || parsed.some(({ px, sz }) => px === null || px <= 0 || sz === null || sz <= 0)
      || new Set(parsed.map(({ px }) => px)).size !== parsed.length) {
      result.notices.push(`missing_or_invalid:${name}_levels`);
      return null;
    }
    return parsed.sort((a, b) => index === 0 ? b.px - a.px : a.px - b.px);
  });
  if (result.bid_level_count !== null && result.ask_level_count !== null) {
    result.top_level_count = result.bid_level_count + result.ask_level_count;
  }
  result.best_bid = sides[0]?.[0].px ?? null;
  result.best_ask = sides[1]?.[0].px ?? null;
  if (!sides[0] || !sides[1]) return result;
  if (result.best_bid >= result.best_ask) {
    result.notices.push("crossed_or_locked_order_book");
    return result;
  }
  const mid = result.best_bid / 2 + result.best_ask / 2;
  result.spread_bps = finite((result.best_ask - result.best_bid) / mid * 10_000);
  for (const [index, name] of ["bid", "ask"].entries()) {
    result[`${name}_visible_notional_within_10bps`] = finite(sides[index]
      .filter(({ px }) => Math.abs(px - mid) / mid <= 0.001 + Number.EPSILON)
      .reduce((total, { px, sz }) => total + px * sz, 0));
  }
  const invalidCalculation = [result.spread_bps, result.bid_visible_notional_within_10bps,
    result.ask_visible_notional_within_10bps].includes(null);
  if (invalidCalculation) result.notices.push("non_finite_book_calculation");
  result.status = result.snapshot_time === null || result.stale || invalidCalculation ? "limited" : "available";
  return result;
}

async function readPayload(response) {
  if (!response.ok) throw new Error(`http_${Number(response.status) || "error"}`);
  if (Number(response.headers?.get?.("content-length")) > MAX_BYTES) throw new Error("payload_too_large");
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) throw new Error("payload_too_large");
        chunks.push(Buffer.from(value));
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } finally {
      // Do not await cancellation: a broken injected stream must not defeat timeout.
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  const data = await response.json();
  if (Buffer.byteLength(JSON.stringify(data)) > MAX_BYTES) throw new Error("payload_too_large");
  return data;
}

/**
 * Official contract verified 2026-09-19: POST /info, application/json.
 * fundingHistory: {type, coin, startTime, endTime}; inclusive epoch-ms bounds;
 * response [{coin, fundingRate: decimal string, premium: decimal string, time}].
 * l2Book: {type, coin}; response {coin,time,levels:[bids,asks]}, each {px,sz,n};
 * maximum 20 levels/side. No aggregation is requested; n is not a size/notional.
 * Docs: info-endpoint, info-endpoint/perpetuals, and /trading/funding.
 * enrich returns summaries only. Rates are fractions except fields ending _pct;
 * coverage and positive_share are fractions. Window uses 72 UTC hourly slots
 * (floor(start/hour), floor(end/hour)] with no imputation for missing slots.
 * Cache is LRU, successful responses only; request bounds and fetch/source times
 * remain visible on hits. Cached rows are re-evaluated against the current window.
 */
export function createResearchEvidenceProvider({
  fetchImpl = globalThis.fetch, apiUrl = API_URL, timeoutMs = 5_000, now = Date.now,
  cacheTtlMs = 60_000, maxCacheEntries = 100, maxConcurrency = 4, bookStaleMs = 60_000,
} = {}) {
  if (typeof fetchImpl !== "function" || typeof now !== "function") throw new TypeError("fetchImpl and now must be functions");
  for (const [name, value, max] of [["timeoutMs", timeoutMs, 5_000], ["cacheTtlMs", cacheTtlMs, 60_000],
    ["maxCacheEntries", maxCacheEntries, 1_000], ["maxConcurrency", maxConcurrency, 4], ["bookStaleMs", bookStaleMs, HOUR]]) {
    if (!Number.isInteger(value) || value < (name === "cacheTtlMs" ? 0 : 1) || value > max) throw new RangeError(`Invalid ${name}`);
  }
  const cache = new Map();
  const inflight = new Map();
  const queue = [];
  let active = 0;
  async function scheduled(task) {
    if (queue.length >= 100) throw new Error("provider_busy");
    if (active >= maxConcurrency) await new Promise((resolve) => queue.push(resolve));
    else active++;
    try { return await task(); } finally {
      if (queue.length) queue.shift()();
      else active--;
    }
  }
  function request(type, coin, end) {
    const key = `${type}:${coin}`;
    const hit = cache.get(key);
    if (hit && end >= hit.fetchedAt && end - hit.fetchedAt < cacheTtlMs) {
      cache.delete(key); cache.set(key, hit);
      return Promise.resolve({ ...hit, cacheStatus: "hit" });
    }
    cache.delete(key);
    if (inflight.has(key)) return inflight.get(key).then((value) => ({ ...value, cacheStatus: "inflight" }));
    if (inflight.size >= 100) return Promise.reject(new Error("provider_busy"));
    const body = { type, coin, ...(type === "fundingHistory" ? { startTime: end - WINDOW, endTime: end } : {}) };
    const controller = new AbortController();
    let timer;
    const transport = scheduled(async () => {
      if (controller.signal.aborted) throw new Error("timeout");
      return readPayload(await fetchImpl(apiUrl, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: controller.signal }));
    });
    // Deadline includes queueing. Retain the concurrency slot until transport
    // settles, even when an injected fetch ignores abort and the caller times out.
    const work = (async () => {
      try {
        const data = await Promise.race([
          transport,
          new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("timeout")); }, timeoutMs); }),
        ]);
        const value = { data, fetchedAt: Number(now()), body, cacheStatus: "miss" };
        cache.set(key, value);
        while (cache.size > maxCacheEntries) cache.delete(cache.keys().next().value);
        return value;
      } finally { clearTimeout(timer); }
    })().finally(() => inflight.delete(key));
    inflight.set(key, work);
    return work;
  }
  return async function enrich({ symbols = [], topics = [] } = {}) {
    if (!Array.isArray(symbols) || symbols.length > 50 || symbols.some((symbol) => typeof symbol !== "string" || !/^[A-Za-z0-9:_-]{1,30}$/.test(symbol))) {
      throw new TypeError("symbols must be an array of at most 50 valid Hyperliquid coin names");
    }
    if (!Array.isArray(topics) || topics.some((topic) => !["funding", "basis", "liquidity", "risk"].includes(topic))) throw new TypeError("Invalid topics");
    const end = Number(now());
    if (timestamp(end) === null || end < WINDOW) throw new TypeError("now must return epoch milliseconds");
    // Preserve exact meta coin names, including case-sensitive HIP-3 dex prefixes.
    const unique = [...new Set(symbols)];
    const limitations = unique.slice(5).map((symbol) => `skipped:${symbol}:five_symbol_enrichment_limit`);
    async function evidence(type, symbol, enabled) {
      const empty = type === "fundingHistory" ? fundingEmpty : bookEmpty;
      if (!enabled) return empty("not_requested", ["topic_not_requested"]);
      try {
        const value = await request(type, symbol, end);
        const evaluatedAt = Math.max(end, Number(now()));
        const stats = type === "fundingHistory" ? fundingStats(value.data, symbol, end) : bookStats(value.data, symbol, evaluatedAt, bookStaleMs);
        stats.source = { name: "Hyperliquid", api_url: apiUrl, request_type: type,
          documentation_url: type === "fundingHistory" ? `${DOCS}/perpetuals#retrieve-historical-funding-rates` : `${DOCS}#l2-book-snapshot`,
          fetched_at: value.fetchedAt, evaluated_at: evaluatedAt, age_ms: Math.max(0, evaluatedAt - value.fetchedAt),
          cache_status: value.cacheStatus, source_time: type === "fundingHistory" ? stats.latest_time : stats.snapshot_time,
          request_start_time: value.body.startTime ?? null, request_end_time: value.body.endTime ?? null,
          window_start_time: type === "fundingHistory" ? end - WINDOW : null,
          window_end_time: type === "fundingHistory" ? end : null };
        return stats;
      } catch (error) {
        const code = /^(timeout|provider_busy|payload_too_large|http_\d+)$/.test(error?.message) ? error.message : "fetch_or_payload_error";
        return empty("unavailable", [`${type}:${code}`]);
      }
    }
    const markets = await Promise.all(unique.slice(0, 5).map(async (symbol) => {
      const [funding_history, order_book] = await Promise.all([
        evidence("fundingHistory", symbol, topics.includes("funding")),
        evidence("l2Book", symbol, topics.includes("liquidity") || topics.includes("risk")),
      ]);
      return { symbol, funding_history, order_book };
    }));
    return { window_hours: 72, markets, limitations };
  };
}
