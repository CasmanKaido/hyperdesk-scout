import test from "node:test";
import assert from "node:assert/strict";
import { fundingSpecialist } from "../src/specialists/funding.js";
import { liquiditySpecialist } from "../src/specialists/liquidity.js";
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

test("specialist registry is explicit and fixed", () => {
  assert.deepEqual(listSpecialists().map((item) => item.id), ["funding", "liquidity", "risk"]);
});
