import test from "node:test";
import assert from "node:assert/strict";
import { calculateMetrics } from "../src/scoring.js";
import { buildFundingScan, validateScanInput, ValidationError } from "../src/service.js";

const market = {
  symbol: "ETH",
  maxLeverage: 50,
  funding: "0.0001",
  markPx: "2020",
  oraclePx: "2000",
  openInterest: "10000",
  dayNtlVlm: "50000000",
  impactPxs: ["2019", "2021"],
};

test("annualizes hourly funding and calculates basis", () => {
  const result = calculateMetrics(market);
  assert.equal(result.fundingAprPercent, 87.6);
  assert.equal(result.basisPercent, 1);
  assert.ok(result.liquidityScore > 0 && result.liquidityScore <= 1);
  assert.ok(result.riskFlags.includes("basis_not_guaranteed"));
});

test("validates and normalizes scan input", () => {
  assert.deepEqual(validateScanInput({ symbols: ["eth", "BTC"], min_funding_apr: 5 }), {
    symbols: ["ETH", "BTC"],
    minFundingApr: 5,
    riskTolerance: "moderate",
  });
  assert.throws(() => validateScanInput({ symbols: [] }), ValidationError);
  assert.throws(() => validateScanInput({ unknown: true }), /Unknown request field/);
});

test("builds deterministic ranked response", () => {
  const input = validateScanInput({ symbols: ["ETH", "NOPE"], risk_tolerance: "aggressive" });
  const result = buildFundingScan([market], input, { generatedAt: new Date("2026-09-17T00:00:00Z") });
  assert.equal(result.opportunities[0].symbol, "ETH");
  assert.deepEqual(result.unavailable_symbols, ["NOPE"]);
  assert.equal(result.data_status, "fresh");
});
