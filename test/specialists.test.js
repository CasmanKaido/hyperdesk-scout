import test from "node:test";
import assert from "node:assert/strict";
import { fundingSpecialist } from "../src/specialists/funding.js";
import { liquiditySpecialist } from "../src/specialists/liquidity.js";
import { riskSpecialist } from "../src/specialists/risk.js";
import { listSpecialists } from "../src/specialists/registry.js";

const metrics = [{
  symbol: "ETH",
  maxLeverage: 25,
  fundingRate: 0.0001,
  fundingAprPercent: 87.6,
  liquidityScore: 0.9,
  impactSpreadBps: 2,
  volume24hUsd: 100000000,
  openInterestNotionalUsd: 50000000,
}];
const constraints = { minFundingApr: 5, maxNotionalUsd: 1000, riskTolerance: "moderate" };

test("funding specialist declares hedge requirements", async () => {
  const result = await fundingSpecialist.analyze({ metrics, constraints });
  assert.equal(result.candidates[0].strategy_shape, "short_perp_long_spot");
  assert.match(result.candidates[0].hedge_requirement, /must be verified/);
});

test("liquidity specialist applies the requested notional", async () => {
  const result = await liquiditySpecialist.analyze({ metrics, constraints });
  assert.equal(result.markets[0].acceptable, true);
  assert.equal(result.markets[0].requested_notional_share_bps, 0.1);
});

test("funding fails closed even with a zero threshold", async () => {
  for (const key of ["fundingRate", "fundingAprPercent"]) {
    for (const value of [undefined, null, NaN, Infinity, "", "0"]) {
      const result = await fundingSpecialist.analyze({
        metrics: [{ ...metrics[0], [key]: value }], constraints: { ...constraints, minFundingApr: 0 },
      });
      const candidate = result.candidates[0];
      assert.equal(candidate.eligible, false);
      assert.equal(candidate.strategy_shape, null);
      assert.equal(candidate.evidence, "missing_required_evidence");
      assert.ok(candidate.missing_evidence.includes(key));
    }
  }
});

test("funding preserves signed and zero observations without verifying a hedge", async () => {
  for (const apr of [-87.6, 0, 87.6]) {
    const result = await fundingSpecialist.analyze({
      metrics: [{ ...metrics[0], fundingRate: apr / 876000, fundingAprPercent: apr }],
      constraints: { ...constraints, minFundingApr: 0 },
    });
    assert.equal(result.candidates[0].eligible, true);
    assert.deepEqual(result.candidates[0].missing_evidence, []);
    assert.equal(result.candidates[0].strategy_status, "hypothetical_unverified_hedge");
    assert.equal(result.candidates[0].strategy_shape, apr >= 0 ? "short_perp_long_spot" : "long_perp_short_spot");
  }
});

test("liquidity requires finite nonnegative evidence", async () => {
  for (const key of ["liquidityScore", "impactSpreadBps", "volume24hUsd", "openInterestNotionalUsd"]) {
    for (const value of [undefined, null, NaN, Infinity, -1, ""]) {
      const result = await liquiditySpecialist.analyze({ metrics: [{ ...metrics[0], [key]: value }], constraints });
      assert.equal(result.markets[0].acceptable, false);
      assert.ok(result.markets[0].missing_evidence.includes(key));
      assert.ok(result.markets[0].reasons.includes("missing_required_evidence"));
    }
  }
});

test("risk independently rejects unavailable policy evidence despite positive upstream decisions", async () => {
  for (const key of ["maxLeverage", "riskScore", "basisPercent", "fundingAprPercent"]) {
    for (const value of [undefined, null, NaN, Infinity, ""]) {
      const result = await riskSpecialist.analyze({
        metrics: [{ ...metrics[0], riskScore: 0.2, basisPercent: 0.1, [key]: value }],
        constraints: { ...constraints, maxLeverage: 2 },
        funding: { candidates: [{ symbol: "ETH", eligible: true }] },
        liquidity: { markets: [{ symbol: "ETH", acceptable: true }] },
        dataStatus: "fresh",
      });
      assert.equal(result.decisions[0].decision, "reject");
      assert.ok(result.decisions[0].missing_evidence.includes(key));
      assert.ok(result.decisions[0].blockers.includes("missing_required_evidence"));
    }
  }
});

test("specialist registry is explicit and fixed", () => {
  assert.deepEqual(listSpecialists().map((item) => item.id), ["funding", "liquidity", "risk"]);
});
