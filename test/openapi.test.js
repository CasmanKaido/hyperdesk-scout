import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequestHandler } from "../src/handler.js";

const spec = JSON.parse(await readFile(new URL("../openapi.json", import.meta.url), "utf8"));

test("publishes an OpenAPI 3.1 contract for every route", () => {
  assert.equal(spec.openapi, "3.1.0");
  assert.ok(spec.paths["/health"].get);
  assert.ok(spec.paths["/openapi.json"].get);
  assert.ok(spec.paths["/api/v1/orchestrate"].post);
  assert.ok(spec.paths["/api/v1/funding-scan"].post);
  assert.ok(spec.components.schemas.FundingScanResponse.required.includes("market_data"));
});

test("the documented required response fields match an actual response", async () => {
  const handle = createRequestHandler({
    getMarketData: async () => ({
      markets: [{
        symbol: "ETH",
        maxLeverage: 25,
        funding: "0.0000125",
        markPx: "2453.87",
        oraclePx: "2454.93",
        openInterest: "974189.135",
        dayNtlVlm: "1465965463.517",
        impactPxs: ["2454.0", "2454.1"],
      }],
      fetchedAt: "2026-09-17T00:00:00.000Z",
      ageMs: 0,
      cacheStatus: "miss",
      fetchDurationMs: 10,
    }),
    requestId: () => "req_contract",
    now: () => new Date("2026-09-17T00:00:01Z"),
    logger: { info() {}, error() {} },
  });
  const response = await handle({
    method: "POST",
    pathname: "/api/v1/funding-scan",
    bodyText: JSON.stringify({ symbols: ["ETH"], risk_tolerance: "aggressive" }),
  });

  for (const field of spec.components.schemas.FundingScanResponse.required) {
    assert.ok(Object.hasOwn(response.body, field), `missing response field: ${field}`);
  }
  for (const field of spec.components.schemas.Opportunity.required) {
    assert.ok(Object.hasOwn(response.body.opportunities[0], field), `missing opportunity field: ${field}`);
  }

  const orchestration = await handle({
    method: "POST",
    pathname: "/api/v1/orchestrate",
    bodyText: JSON.stringify({ symbols: ["ETH"], risk_tolerance: "aggressive" }),
  });
  for (const field of spec.components.schemas.OrchestrationResponse.required) {
    assert.ok(Object.hasOwn(orchestration.body, field), `missing orchestration field: ${field}`);
  }
});
