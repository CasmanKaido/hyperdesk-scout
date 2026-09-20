import { calculateMetrics } from "./scoring.js";

const DEFAULT_SYMBOLS = ["BTC", "ETH", "SOL"];
const RISK_LEVELS = new Set(["conservative", "moderate", "aggressive"]);

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.status = 400;
  }
}

export function validateScanInput(input = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Request body must be a JSON object");
  }

  const allowedFields = new Set(["symbols", "min_funding_apr", "risk_tolerance"]);
  const unknownFields = Object.keys(input).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw new ValidationError(`Unknown request field: ${unknownFields[0]}`);
  }

  const symbols = input.symbols ?? DEFAULT_SYMBOLS;
  if (!Array.isArray(symbols) || symbols.length < 1 || symbols.length > 50) {
    throw new ValidationError("symbols must contain between 1 and 50 items");
  }

  const normalizedSymbols = symbols.map((symbol) => {
    if (typeof symbol !== "string" || !/^[A-Za-z0-9:_-]{1,30}$/.test(symbol)) {
      throw new ValidationError("Each symbol must be a valid Hyperliquid market name");
    }
    return symbol.toUpperCase();
  });

  const minFundingApr = input.min_funding_apr ?? 0;
  if (typeof minFundingApr !== "number" || !Number.isFinite(minFundingApr) || minFundingApr < 0) {
    throw new ValidationError("min_funding_apr must be a non-negative number");
  }

  const riskTolerance = input.risk_tolerance ?? "moderate";
  if (!RISK_LEVELS.has(riskTolerance)) {
    throw new ValidationError("risk_tolerance must be conservative, moderate, or aggressive");
  }

  return { symbols: [...new Set(normalizedSymbols)], minFundingApr, riskTolerance };
}

export function buildFundingScan(markets, input, metadata = {}) {
  const generatedAt = metadata.generatedAt ?? new Date();
  const ageMs = Math.max(0, Number(metadata.ageMs ?? 0));
  const requested = new Set(input.symbols);
  const riskCaps = { conservative: 0.45, moderate: 0.7, aggressive: 1 };

  const opportunities = markets
    .filter((market) => requested.has(market.symbol.toUpperCase()))
    .map((market) => ({ symbol: market.symbol, maxLeverage: market.maxLeverage, ...calculateMetrics(market) }))
    .filter((market) => [market.fundingAprPercent, market.riskScore, market.opportunityScore].every(Number.isFinite))
    .filter((market) => market.missing_evidence.length === 0)
    .filter((market) => Math.abs(market.fundingAprPercent) >= input.minFundingApr)
    .filter((market) => market.riskScore <= riskCaps[input.riskTolerance])
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  const available = new Set(markets.map((market) => market.symbol.toUpperCase()));
  return {
    service: "LiquidFlux Funding Specialist",
    version: "0.7.6",
    generated_at: generatedAt.toISOString(),
    data_source: "Hyperliquid mainnet",
    data_status: metadata.cacheStatus === "stale_fallback" ? "stale" : "fresh",
    market_data: {
      fetched_at: metadata.fetchedAt ?? generatedAt.toISOString(),
      age_ms: ageMs,
      cache_status: metadata.cacheStatus ?? "miss",
      fetch_duration_ms: Math.max(0, Number(metadata.fetchDurationMs ?? 0)),
    },
    methodology: {
      funding_apr: "current hourly funding rate × 24 × 365; not a forecast",
      basis: "(mark price - oracle price) / oracle price",
      scoring: "deterministic funding, basis, liquidity, and risk factors",
    },
    query: {
      symbols: input.symbols,
      min_funding_apr: input.minFundingApr,
      risk_tolerance: input.riskTolerance,
    },
    unavailable_symbols: input.symbols.filter((symbol) => !available.has(symbol)),
    opportunities,
    disclaimer: "Informational market data only. Funding can reverse and returns are not guaranteed.",
  };
}
