import { randomUUID } from "node:crypto";
import { calculateMetrics } from "./scoring.js";
import { ValidationError } from "./service.js";
import { getSpecialist } from "./specialists/registry.js";

const DEFAULT_SYMBOLS = ["BTC", "ETH", "SOL"];
const RISK_LEVELS = new Set(["conservative", "moderate", "aggressive"]);
const ALLOWED_FIELDS = new Set([
  "objective",
  "symbols",
  "risk_tolerance",
  "max_leverage",
  "max_notional_usd",
  "min_funding_apr",
]);

export function validateOrchestrationInput(input = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  const unknown = Object.keys(input).find((field) => !ALLOWED_FIELDS.has(field));
  if (unknown) throw new ValidationError(`Unknown request field: ${unknown}`);

  const objective = input.objective ?? "market_neutral_income";
  if (objective !== "market_neutral_income") {
    throw new ValidationError("objective must be market_neutral_income");
  }

  const symbols = input.symbols ?? DEFAULT_SYMBOLS;
  if (!Array.isArray(symbols) || symbols.length < 1 || symbols.length > 20) {
    throw new ValidationError("symbols must contain between 1 and 20 items");
  }
  const normalizedSymbols = symbols.map((symbol) => {
    if (typeof symbol !== "string" || !/^[A-Za-z0-9:_-]{1,30}$/.test(symbol)) {
      throw new ValidationError("Each symbol must be a valid Hyperliquid market name");
    }
    return symbol.toUpperCase();
  });

  const riskTolerance = input.risk_tolerance ?? "moderate";
  if (!RISK_LEVELS.has(riskTolerance)) {
    throw new ValidationError("risk_tolerance must be conservative, moderate, or aggressive");
  }

  const maxLeverage = input.max_leverage ?? 2;
  if (!Number.isFinite(maxLeverage) || maxLeverage < 1 || maxLeverage > 10) {
    throw new ValidationError("max_leverage must be between 1 and 10");
  }

  const maxNotionalUsd = input.max_notional_usd ?? 1000;
  if (!Number.isFinite(maxNotionalUsd) || maxNotionalUsd <= 0 || maxNotionalUsd > 1_000_000) {
    throw new ValidationError("max_notional_usd must be greater than 0 and no more than 1000000");
  }

  const minFundingApr = input.min_funding_apr ?? 5;
  if (!Number.isFinite(minFundingApr) || minFundingApr < 0 || minFundingApr > 10_000) {
    throw new ValidationError("min_funding_apr must be between 0 and 10000");
  }

  return {
    objective,
    symbols: [...new Set(normalizedSymbols)],
    riskTolerance,
    maxLeverage,
    maxNotionalUsd,
    minFundingApr,
  };
}

function buildConflicts(funding, liquidity, risk) {
  const liquidityBySymbol = new Map(liquidity.markets.map((item) => [item.symbol, item]));
  const riskBySymbol = new Map(risk.decisions.map((item) => [item.symbol, item]));
  const conflicts = [];

  for (const signal of funding.candidates) {
    if (!signal.eligible) continue;
    const liquidityResult = liquidityBySymbol.get(signal.symbol);
    const riskResult = riskBySymbol.get(signal.symbol);
    if (liquidityResult && !liquidityResult.acceptable) {
      conflicts.push({
        symbol: signal.symbol,
        type: "funding_vs_liquidity",
        summary: "Funding met the threshold but liquidity policy rejected the market",
      });
    }
    if (riskResult?.decision === "reject" && liquidityResult?.acceptable) {
      conflicts.push({
        symbol: signal.symbol,
        type: "funding_vs_risk",
        summary: "Funding met the threshold but risk policy rejected the market",
      });
    }
  }
  return conflicts;
}

export async function orchestrateMarketNeutral({
  markets,
  input,
  marketData,
  generatedAt = new Date(),
  workflowId = randomUUID(),
}) {
  const requested = new Set(input.symbols);
  const selectedMarkets = markets.filter((market) => requested.has(market.symbol.toUpperCase()));
  const metrics = selectedMarkets.map((market) => ({
    symbol: market.symbol,
    maxLeverage: market.maxLeverage,
    ...calculateMetrics(market),
  }));
  const constraints = input;
  const context = { metrics, constraints };
  const fundingSpecialist = getSpecialist("funding");
  const liquiditySpecialist = getSpecialist("liquidity");
  const riskSpecialist = getSpecialist("risk");

  const [funding, liquidity] = await Promise.all([
    fundingSpecialist.analyze(context),
    liquiditySpecialist.analyze(context),
  ]);
  const risk = await riskSpecialist.analyze({
    ...context,
    funding,
    liquidity,
    dataStatus: marketData.dataStatus,
  });

  const fundingBySymbol = new Map(funding.candidates.map((item) => [item.symbol, item]));
  const liquidityBySymbol = new Map(liquidity.markets.map((item) => [item.symbol, item]));
  const opportunities = risk.decisions
    .filter((item) => item.decision !== "reject")
    .map((item) => ({
      symbol: item.symbol,
      decision: item.decision,
      strategy_shape: fundingBySymbol.get(item.symbol)?.strategy_shape,
      funding_apr_percent: fundingBySymbol.get(item.symbol)?.funding_apr_percent,
      liquidity_score: liquidityBySymbol.get(item.symbol)?.liquidity_score,
      impact_spread_bps: liquidityBySymbol.get(item.symbol)?.impact_spread_bps,
      risk_score: item.risk_score,
      basis_percent: item.basis_percent,
      max_notional_usd: constraints.maxNotionalUsd,
      max_leverage: constraints.maxLeverage,
      cautions: item.cautions,
      missing_evidence: item.missing_evidence,
      basis_description: item.basis_description,
      assessment_scope: item.assessment_scope,
      hedge_requirement: fundingBySymbol.get(item.symbol)?.hedge_requirement,
    }));
  const rejected = risk.decisions
    .filter((item) => item.decision === "reject")
    .map(({ symbol, blockers, missing_evidence, basis_description, assessment_scope }) => ({ symbol, blockers, missing_evidence, basis_description, assessment_scope }));
  const availableSymbols = new Set(metrics.map((item) => item.symbol.toUpperCase()));

  return {
    service: "LiquidFlux Orchestrator",
    version: "0.7.5",
    workflow_id: workflowId,
    generated_at: generatedAt.toISOString(),
    objective: input.objective,
    execution_included: false,
    approval_required: true,
    workflow: {
      plan: [
        { stage: 1, specialists: ["funding", "liquidity"], mode: "parallel" },
        { stage: 2, specialists: ["risk"], mode: "depends_on_stage_1" },
        { stage: 3, specialists: ["synthesis"], mode: "deterministic" },
      ],
      trace: [
        { specialist: "funding", status: funding.status, evidence_count: funding.candidates.length },
        { specialist: "liquidity", status: liquidity.status, evidence_count: liquidity.markets.length },
        { specialist: "risk", status: risk.status, evidence_count: risk.decisions.length },
      ],
    },
    provenance: {
      source: "Hyperliquid mainnet",
      fetched_at: marketData.fetchedAt,
      age_ms: marketData.ageMs,
      data_status: marketData.dataStatus,
      cache_status: marketData.cacheStatus,
    },
    constraints: {
      symbols: input.symbols,
      risk_tolerance: input.riskTolerance,
      max_leverage: input.maxLeverage,
      max_notional_usd: input.maxNotionalUsd,
      min_funding_apr: input.minFundingApr,
    },
    unavailable_symbols: input.symbols.filter((symbol) => !availableSymbols.has(symbol)),
    specialist_outputs: { funding, liquidity, risk },
    conflicts: buildConflicts(funding, liquidity, risk),
    synthesis: {
      outcome: opportunities.length > 0 ? "review_candidates" : "no_approved_opportunity",
      opportunities,
      rejected,
      next_action: opportunities.length > 0
        ? "Review hedge availability, fees, and constraints before explicitly approving any future execution"
        : "Do not execute; revise constraints or wait for market conditions to change",
    },
    disclaimer: "Informational orchestration only. No trade was executed. Funding can reverse and hedge costs can eliminate returns.",
  };
}
