import test from "node:test";
import assert from "node:assert/strict";
import { createPaymentGate, paymentGateFromEnv, X402_DEFAULTS } from "../src/payments.js";
import { validateResearchReportInput, DEFAULT_RESEARCH_QUESTION } from "../src/research-report.js";
import { createRequestHandler } from "../src/handler.js";

const PAYTO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PAYER = "0x857b06519E91e3A54538791bDbb0E22373e36b66";
const TX = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

const silentLogger = { info() {}, error() {} };

function gateConfig(overrides = {}) {
  return {
    enabled: true,
    payTo: PAYTO,
    asset: ASSET,
    facilitatorUrl: "https://facilitator.example.com",
    logger: silentLogger,
    ...overrides,
  };
}

function decodeHeader(headers, name) {
  const value = headers[name];
  assert.ok(value, `expected ${name} header`);
  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

function signedHeaders(overrides = {}) {
  const payload = {
    x402Version: 2,
    accepted: {
      scheme: "exact",
      network: X402_DEFAULTS.network,
      amount: "10000",
      asset: ASSET,
      payTo: PAYTO,
      maxTimeoutSeconds: X402_DEFAULTS.maxTimeoutSeconds,
      extra: { name: X402_DEFAULTS.assetName, version: "2" },
      ...overrides.accepted,
    },
    payload: {
      signature: "0xabc",
      authorization: { from: PAYER, to: PAYTO, value: "10000", validAfter: "0", validBefore: "9999999999", nonce: "0x1" },
      ...overrides.payload,
    },
    ...("x402Version" in overrides ? { x402Version: overrides.x402Version } : {}),
  };
  return { "payment-signature": Buffer.from(JSON.stringify(payload)).toString("base64") };
}

function facilitatorFetch({ verify = { isValid: true, payer: PAYER }, settle = { success: true, transaction: TX, network: X402_DEFAULTS.network, payer: PAYER }, calls = [] } = {}) {
  return async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, body: JSON.parse(options.body) });
    const data = path === "/verify" ? verify : settle;
    return { status: 200, json: async () => data };
  };
}

test("gate is not configured when disabled or misconfigured", () => {
  assert.equal(createPaymentGate({ enabled: false, logger: silentLogger }).configured, false);
  assert.equal(createPaymentGate(gateConfig({ payTo: "not-an-address" })).configured, false);
  assert.equal(createPaymentGate(gateConfig({ asset: null })).configured, false);
  assert.equal(createPaymentGate(gateConfig({ facilitatorUrl: "http://insecure.example.com" })).configured, false);
  assert.equal(createPaymentGate(gateConfig()).configured, true);
});

test("paymentGateFromEnv parses configuration", () => {
  const gate = paymentGateFromEnv({
    X402_ENABLED: "true",
    X402_PAYTO_ADDRESS: PAYTO,
    X402_ASSET_ADDRESS: ASSET,
    X402_FACILITATOR_URL: "https://facilitator.example.com",
  }, { logger: silentLogger });
  assert.equal(gate.configured, true);
  assert.equal(gate.network, "eip155:1952");
  assert.equal(paymentGateFromEnv({}, { logger: silentLogger }).configured, false);
});

test("unpaid charge returns a spec-compliant 402 challenge", async () => {
  const gate = createPaymentGate(gateConfig());
  const result = await gate.charge({
    headers: {},
    resourceUrl: "https://hyperdesk-scout.onrender.com/api/v1/research-report",
    description: "Test report",
    amountAtomic: "10000",
    requestId: "req_1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 402);
  assert.equal(result.response.body.error, "payment_required");
  const decoded = decodeHeader(result.response.headers, "payment-required");
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.resource.url, "https://hyperdesk-scout.onrender.com/api/v1/research-report");
  assert.equal(decoded.resource.mimeType, "application/json");
  assert.equal(decoded.accepts.length, 1);
  assert.deepEqual(decoded.accepts[0], {
    scheme: "exact",
    network: "eip155:1952",
    amount: "10000",
    asset: ASSET,
    payTo: PAYTO,
    maxTimeoutSeconds: 300,
    extra: { name: "USD₮0", version: "2" },
  });
});

test("malformed or mismatched signatures are rejected without facilitator calls", async () => {
  const calls = [];
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) }));

  const malformed = await gate.charge({ headers: { "payment-signature": "!!!" }, resourceUrl: "https://x", description: "d", amountAtomic: "10000", requestId: "req_2" });
  assert.equal(malformed.response.status, 402);
  assert.equal(malformed.response.body.invalid_reason, "payment_signature_malformed");

  const wrongAmount = await gate.charge({ headers: signedHeaders({ accepted: { amount: "1" } }), resourceUrl: "https://x", description: "d", amountAtomic: "10000", requestId: "req_3" });
  assert.equal(wrongAmount.response.status, 402);
  assert.equal(wrongAmount.response.body.invalid_reason, "payment_requirements_mismatch");

  const wrongPayTo = await gate.charge({ headers: signedHeaders({ accepted: { payTo: PAYER } }), resourceUrl: "https://x", description: "d", amountAtomic: "10000", requestId: "req_4" });
  assert.equal(wrongPayTo.response.body.invalid_reason, "payment_requirements_mismatch");
  assert.equal(calls.length, 0);
});

test("invalid verification and failed settlement return fresh challenges", async () => {
  const invalid = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ verify: { isValid: false, invalidReason: "insufficient_funds" } }) }));
  const rejected = await invalid.charge({ headers: signedHeaders(), resourceUrl: "https://x", description: "d", amountAtomic: "10000", requestId: "req_5" });
  assert.equal(rejected.response.status, 402);
  assert.equal(rejected.response.body.invalid_reason, "insufficient_funds");
  assert.ok(rejected.response.headers["payment-required"]);

  const unsettled = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ settle: { success: false, errorReason: "invalid_transaction_state", transaction: "", network: X402_DEFAULTS.network } }) }));
  const failed = await unsettled.charge({ headers: signedHeaders(), resourceUrl: "https://x", description: "d", amountAtomic: "10000", requestId: "req_6" });
  assert.equal(failed.response.status, 402);
  assert.equal(failed.response.body.invalid_reason, "invalid_transaction_state");
});

test("facilitator outages never grant access", async () => {
  const down = createPaymentGate(gateConfig({ fetchImpl: async () => { throw new Error("connection refused"); } }));
  const result = await down.charge({ headers: signedHeaders(), resourceUrl: "https://x", description: "d", amountAtomic: "10000", requestId: "req_7" });
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 502);
  assert.equal(result.response.body.error, "facilitator_unavailable");
});

test("successful charge verifies, settles, and returns a receipt header", async () => {
  const calls = [];
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) }));
  const result = await gate.charge({ headers: signedHeaders(), resourceUrl: "https://x", description: "d", amountAtomic: "10000", requestId: "req_8" });
  assert.equal(result.ok, true);
  assert.equal(result.payer, PAYER);
  assert.equal(result.transaction, TX);
  assert.deepEqual(calls.map((call) => call.path), ["/verify", "/settle"]);
  assert.equal(calls[0].body.x402Version, 2);
  assert.equal(calls[0].body.paymentRequirements.amount, "10000");
  const receipt = decodeHeader(result.responseHeaders, "payment-response");
  assert.deepEqual(receipt, { success: true, transaction: TX, network: X402_DEFAULTS.network, payer: PAYER });
});

test("validateResearchReportInput bounds symbols and defaults the question", () => {
  assert.deepEqual(validateResearchReportInput({ symbols: ["btc", "ETH"] }), {
    symbols: ["BTC", "ETH"],
    topics: ["funding", "basis", "liquidity", "risk"],
    question: DEFAULT_RESEARCH_QUESTION,
  });
  assert.throws(() => validateResearchReportInput({ symbols: [] }), /between 1 and 5/);
  assert.throws(() => validateResearchReportInput({ symbols: ["A", "B", "C", "D", "E", "F"] }), /between 1 and 5/);
  assert.throws(() => validateResearchReportInput({ symbols: ["BTC"], leverage: 2 }), /Unknown request field/);
  assert.throws(() => validateResearchReportInput({ symbols: ["BTC"], question: "" }), /between 1 and 1000/);
});

function handlerWith(gate, options = {}) {
  return createRequestHandler({
    getMarketData: async () => ({
      markets: [{
        symbol: "BTC", maxLeverage: 40, funding: "0.0000125", markPx: "50000",
        oraclePx: "50010", openInterest: "1000", dayNtlVlm: "1000000", impactPxs: ["49990", "50010"],
      }],
      fetchedAt: "2026-09-22T00:00:00Z",
      ageMs: 100,
      cacheStatus: "hit",
    }),
    requestId: () => "req_test",
    now: () => new Date("2026-09-22T00:00:01Z"),
    logger: silentLogger,
    paymentGate: gate,
    ...options,
  });
}

test("research report route is unavailable without a configured gate", async () => {
  const handle = handlerWith(null);
  const result = await handle({ method: "POST", pathname: "/api/v1/research-report", bodyText: JSON.stringify({ symbols: ["BTC"] }) });
  assert.equal(result.status, 503);
  assert.equal(result.body.error, "payments_not_configured");

  const unconfigured = handlerWith(createPaymentGate({ enabled: false, logger: silentLogger }));
  const second = await unconfigured({ method: "POST", pathname: "/api/v1/research-report", bodyText: JSON.stringify({ symbols: ["BTC"] }) });
  assert.equal(second.status, 503);
});

test("research report route challenges unpaid requests before touching market data", async () => {
  let marketDataCalled = false;
  const handle = createRequestHandler({
    getMarketData: async () => { marketDataCalled = true; throw new Error("should not run"); },
    requestId: () => "req_test",
    logger: silentLogger,
    paymentGate: createPaymentGate(gateConfig()),
  });
  const result = await handle({ method: "POST", pathname: "/api/v1/research-report", bodyText: JSON.stringify({ symbols: ["BTC"] }) });
  assert.equal(result.status, 402);
  assert.equal(result.body.error, "payment_required");
  assert.equal(result.body.payment_required.accepts[0].amount, "10000");
  assert.ok(result.headers["payment-required"]);
  assert.equal(marketDataCalled, false);
});

test("research report route validates input before charging", async () => {
  const calls = [];
  const handle = handlerWith(createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) })));
  const result = await handle({ method: "POST", pathname: "/api/v1/research-report", bodyText: JSON.stringify({ symbols: [] }) });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "invalid_request");
  assert.equal(calls.length, 0);
});

test("paid research report returns analysis, receipt, and payment metadata", async () => {
  const handle = handlerWith(createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch() })), {
    analyzeEvidence: async ({ question, evidence }) => ({
      status: "completed",
      answer: "Grounded test answer",
      answer_source: "ai_filtered",
      findings: [],
      caveats: [],
      next_questions: [],
      provider: "test",
      model: "test-model",
      grounding: { cited: evidence.records?.length ?? 0 },
    }),
  });
  const result = await handle({
    method: "POST",
    pathname: "/api/v1/research-report",
    headers: signedHeaders(),
    bodyText: JSON.stringify({ symbols: ["BTC"] }),
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.report.kind, "hyperliquid_research_report");
  assert.equal(result.body.report.payment.scheme, "x402");
  assert.equal(result.body.report.payment.network, "eip155:1952");
  assert.equal(result.body.report.payment.amount_atomic, "10000");
  assert.equal(result.body.report.payment.payer, PAYER);
  assert.equal(result.body.report.payment.transaction, TX);
  assert.equal(result.body.analysis.status, "completed");
  assert.equal(result.body.analysis.answer, "Grounded test answer");
  assert.equal(result.body.markets[0].symbol, "BTC");
  assert.ok(result.body.evidence_ledger);
  assert.ok(result.headers["payment-response"]);
});

test("index lists the paid research report endpoint", async () => {
  const handle = handlerWith(null);
  const index = await handle({ method: "GET", pathname: "/" });
  assert.deepEqual(index.body.endpoints.research_report, { method: "POST", path: "/api/v1/research-report", payment: "x402" });
});
