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

for (const [input, output] of [
  ["funding", "fundingRate"], ["oraclePx", "oraclePrice"], ["markPx", "markPrice"],
  ["maxLeverage", "maxLeverage"], ["dayNtlVlm", "volume24hUsd"], ["openInterest", "openInterest"],
]) {
  test(`preserves missing and invalid ${input} as null`, () => {
    for (const value of [undefined, null, "", "  ", "invalid", NaN, Infinity, true, []]) {
      const result = calculateMetrics({ ...market, [input]: value });
      assert.equal(result[output], null);
      assert.ok(result.missing_evidence.includes(output));
      if (input !== "maxLeverage") {
        assert.equal(result.riskScore, null);
        assert.equal(result.opportunityScore, null);
      }
      if (["oraclePx", "markPx"].includes(input)) assert.equal(result.basisPercent, null);
      if (["markPx", "dayNtlVlm", "openInterest"].includes(input)) assert.equal(result.liquidityScore, null);
    }
  });
}

test("requires valid ordered impact prices instead of inventing spread credit", () => {
  for (const impactPxs of [undefined, null, "1234", { 0: 2000, 1: 2001 }, [], ["2000"], [null, "2001"], ["", "2001"], ["0", "2001"], ["2002", "2001"], ["bad", "2001"], [Infinity, "2001"]]) {
    const result = calculateMetrics({ ...market, impactPxs });
    assert.equal(result.impactSpreadBps, null);
    assert.equal(result.liquidityScore, null);
    assert.equal(result.riskScore, null);
    assert.equal(result.opportunityScore, null);
    assert.ok(result.missing_evidence.includes("impactSpreadBps"));
  }
});

test("rejects out-of-domain evidence but retains genuine zero observations", () => {
  for (const key of ["markPx", "oraclePx", "maxLeverage", "dayNtlVlm", "openInterest"]) {
    assert.ok(calculateMetrics({ ...market, [key]: -1 }).missing_evidence.length > 0);
  }
  const result = calculateMetrics({ ...market, funding: "0", dayNtlVlm: "0", openInterest: "0" });
  assert.equal(result.fundingRate, 0);
  assert.equal(result.fundingAprPercent, 0);
  assert.equal(result.volume24hUsd, 0);
  assert.equal(result.openInterestNotionalUsd, 0);
  assert.deepEqual(result.missing_evidence, []);
  assert.ok(result.riskFlags.includes("low_24h_volume"));
  assert.ok(!calculateMetrics({ ...market, dayNtlVlm: null }).riskFlags.includes("low_24h_volume"));
});

test("retains valid-data scores and identifies basis as mark-to-oracle only", () => {
  const result = calculateMetrics(market);
  const liquidity = Math.log10(50000000) / 9 * 0.5
    + Math.log10(20200000) / 9 * 0.3 + (1 - (2 / 2020 * 10000) / 100) * 0.2;
  const risk = (1 - liquidity) * 0.6 + 1 / 5 * 0.2 + 87.6 / 500 * 0.2;
  assert.equal(result.liquidityScore, liquidity);
  assert.equal(result.riskScore, risk);
  assert.equal(result.opportunityScore, 87.6 / 100 * 0.5 + 0.5 * 0.2 + liquidity * 0.3 - risk * 0.2);
  assert.deepEqual(result.missing_evidence, []);
  assert.match(result.basis_description, /not executable/);
});

test("overflowed derived metrics remain unavailable", () => {
  const result = calculateMetrics({ ...market, funding: Number.MAX_VALUE, openInterest: Number.MAX_VALUE });
  assert.equal(result.fundingAprPercent, null);
  assert.equal(result.openInterestNotionalUsd, null);
  assert.equal(result.opportunityScore, null);
  assert.ok(result.missing_evidence.includes("fundingAprPercent"));
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
  assert.equal(result.service, "LiquidFlux Funding Specialist");
  assert.equal(result.opportunities[0].symbol, "ETH");
  assert.deepEqual(result.unavailable_symbols, ["NOPE"]);
  assert.equal(result.data_status, "fresh");
});
