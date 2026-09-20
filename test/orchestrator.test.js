import test from "node:test";
import assert from "node:assert/strict";
import { orchestrateMarketNeutral, validateOrchestrationInput } from "../src/orchestrator.js";

const liquidMarket = {
  symbol: "ETH",
  maxLeverage: 25,
  funding: "0.0001",
  markPx: "2000",
  oraclePx: "1998",
  openInterest: "100000",
  dayNtlVlm: "500000000",
  impactPxs: ["1999.9", "2000.1"],
};

const unsafeMarket = {
  symbol: "RISKY",
  maxLeverage: 3,
  funding: "0.0003",
  markPx: "12",
  oraclePx: "10",
  openInterest: "10",
  dayNtlVlm: "1000",
  impactPxs: ["10", "14"],
};

const marketData = {
  fetchedAt: "2026-09-17T16:00:00.000Z",
  ageMs: 100,
  dataStatus: "fresh",
  cacheStatus: "miss",
};

test("validates orchestration constraints", () => {
  assert.deepEqual(validateOrchestrationInput({ symbols: ["eth"] }), {
    objective: "market_neutral_income",
    symbols: ["ETH"],
    riskTolerance: "moderate",
    maxLeverage: 2,
    maxNotionalUsd: 1000,
    minFundingApr: 5,
  });
  assert.throws(() => validateOrchestrationInput({ objective: "trade_everything" }), /objective/);
  assert.throws(() => validateOrchestrationInput({ max_leverage: 20 }), /max_leverage/);
});

test("coordinates specialists and rejects unsafe candidates", async () => {
  const result = await orchestrateMarketNeutral({
    markets: [liquidMarket, unsafeMarket],
    input: validateOrchestrationInput({ symbols: ["ETH", "RISKY"] }),
    marketData,
    generatedAt: new Date("2026-09-17T16:00:01Z"),
    workflowId: "workflow_test",
  });

  assert.equal(result.service, "LiquidFlux Orchestrator");
  assert.equal(result.workflow_id, "workflow_test");
  assert.equal(result.execution_included, false);
  assert.equal(result.approval_required, true);
  assert.deepEqual(result.workflow.plan[0].specialists, ["funding", "liquidity"]);
  assert.equal(result.specialist_outputs.funding.status, "completed");
  assert.equal(result.synthesis.opportunities[0].symbol, "ETH");
  assert.deepEqual(result.synthesis.rejected[0].symbol, "RISKY");
  assert.ok(result.conflicts.some((conflict) => conflict.symbol === "RISKY"));
});

for (const [field, evidence] of [
  ["funding", "fundingRate"], ["oraclePx", "oraclePrice"], ["markPx", "markPrice"],
  ["maxLeverage", "maxLeverage"], ["dayNtlVlm", "volume24hUsd"],
  ["impactPxs", "impactSpreadBps"], ["openInterest", "openInterest"],
]) {
  test(`fails closed on missing or invalid ${field}`, async () => {
    for (const value of [undefined, null, "", "invalid"]) {
      const result = await orchestrateMarketNeutral({
        markets: [{ ...liquidMarket, [field]: value }],
        input: validateOrchestrationInput({ symbols: ["ETH"], min_funding_apr: 0 }),
        marketData,
      });
      assert.equal(result.synthesis.outcome, "no_approved_opportunity");
      assert.deepEqual(result.synthesis.opportunities, []);
      assert.ok(result.synthesis.rejected[0].blockers.includes("missing_required_evidence"));
      assert.ok(result.specialist_outputs.risk.decisions[0].missing_evidence.includes(evidence));
    }
  });
}

test("fails closed on stale market evidence", async () => {
  const result = await orchestrateMarketNeutral({
    markets: [liquidMarket],
    input: validateOrchestrationInput({ symbols: ["ETH"] }),
    marketData: { ...marketData, dataStatus: "stale" },
  });
  assert.equal(result.synthesis.outcome, "no_approved_opportunity");
  assert.ok(result.synthesis.rejected[0].blockers.includes("market_data_not_fresh"));
});
