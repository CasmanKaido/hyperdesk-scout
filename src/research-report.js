import { createHash } from "node:crypto";
import { ValidationError } from "./service.js";
import { buildMarketOverview } from "./market-overview.js";
import { buildEvidenceLedger } from "./ai-analyst.js";

export const DEFAULT_RESEARCH_QUESTION =
  "Assess realized funding persistence, visible order-book liquidity, and the main limitations of this evidence for these markets.";

/**
 * Paid research report input: 1–5 symbols (the research enrichment bound) and
 * an optional question. A missing question uses the default research prompt so
 * every paid report includes grounded analysis.
 */
export function validateResearchReportInput(input = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  for (const field of Object.keys(input)) {
    if (!["symbols", "question"].includes(field)) throw new ValidationError(`Unknown request field: ${field}`);
  }
  if (!Array.isArray(input.symbols) || input.symbols.length < 1 || input.symbols.length > 5) {
    throw new ValidationError("symbols must contain between 1 and 5 items");
  }
  const symbols = input.symbols.map((symbol) => {
    if (typeof symbol !== "string" || !/^[A-Za-z0-9:_-]{1,30}$/.test(symbol)) {
      throw new ValidationError("Each symbol must be a valid Hyperliquid market name");
    }
    return symbol.toUpperCase();
  });
  const question = input.question === undefined ? DEFAULT_RESEARCH_QUESTION : input.question;
  if (typeof question !== "string" || question.trim().length < 1 || question.trim().length > 1000) {
    throw new ValidationError("question must be between 1 and 1000 characters");
  }
  // A research report always covers every topic.
  return { symbols: [...new Set(symbols)], topics: ["funding", "basis", "liquidity", "risk"], question: question.trim() };
}

/**
 * Shared pipeline for the free market overview and the paid research report:
 * snapshot facts, optional 72h funding/L2-book enrichment, evidence ledger,
 * and grounded AI analysis when a question and analyst are available.
 */
export function fingerprintResearchReportRequest(input) {
  const canonical = JSON.stringify({
    version: "research-report:v1",
    method: "POST",
    path: "/api/v1/research-report",
    symbols: [...input.symbols],
    topics: [...input.topics],
    question: input.question,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export async function assembleEnrichedOverview({
  input,
  getMarketData,
  enrichMarketEvidence = null,
  analyzeEvidence = null,
  now = () => new Date(),
}) {
  const marketData = await getMarketData();
  const overview = buildMarketOverview(marketData.markets, input, {
    generatedAt: now(),
    fetchedAt: marketData.fetchedAt,
    ageMs: marketData.ageMs,
    cacheStatus: marketData.cacheStatus,
  });
  if (typeof enrichMarketEvidence === "function") {
    const research = await enrichMarketEvidence(input);
    const bySymbol = new Map(research.markets.map((item) => [item.symbol, item]));
    for (const market of overview.markets) market.research = bySymbol.get(market.symbol) || null;
    overview.research = { window_hours: research.window_hours, limitations: research.limitations };
  }
  overview.evidence_ledger = buildEvidenceLedger(overview);
  overview.analysis = input.question && typeof analyzeEvidence === "function"
    ? await analyzeEvidence({ question: input.question, evidence: overview.evidence_ledger })
    : { status: "unavailable", reason: input.question ? "not_configured" : "question_not_supplied" };
  return overview;
}
