import test from "node:test";
import assert from "node:assert/strict";
import {
  createPaymentGate,
  createPaymentOperationStore,
  paymentGateFromEnv,
  X402_DEFAULTS,
} from "../src/payments.js";
import {
  validateResearchReportInput,
  fingerprintResearchReportRequest,
  DEFAULT_RESEARCH_QUESTION,
} from "../src/research-report.js";
import { createRequestHandler } from "../src/handler.js";

const PAYTO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PAYER = "0x857b06519E91e3A54538791bDbb0E22373e36b66";
const TX = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const RESOURCE = {
  resourceUrl: "https://hyperdesk-scout.onrender.com/api/v1/research-report",
  description: "Test report",
  amountAtomic: "10000",
};
const FINGERPRINT = "a".repeat(64);
const OKX_CREDENTIALS = {
  facilitatorApiKey: "test-api-key",
  facilitatorSecretKey: "test-secret-key",
  facilitatorPassphrase: "test-passphrase",
};

const silentLogger = { info() {}, error() {} };

function gateConfig(overrides = {}) {
  return {
    enabled: true,
    payTo: PAYTO,
    asset: ASSET,
    facilitatorUrl: "https://facilitator.example.com",
    ...OKX_CREDENTIALS,
    logger: silentLogger,
    ...overrides,
  };
}

function decodeHeader(headers, name) {
  const value = headers[name];
  assert.ok(value, `expected ${name} header`);
  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

function signedHeaders({ accepted = {}, nonce = "0x1", signature = "0xabc", requestFingerprint = FINGERPRINT } = {}) {
  const payload = {
    x402Version: 2,
    accepted: {
      scheme: "exact",
      network: X402_DEFAULTS.network,
      amount: "10000",
      asset: ASSET,
      payTo: PAYTO,
      maxTimeoutSeconds: X402_DEFAULTS.maxTimeoutSeconds,
      extra: {
        name: X402_DEFAULTS.assetName,
        version: "2",
        liquidfluxRequest: { version: "research-report:v1", requestFingerprint },
      },
      ...accepted,
    },
    payload: {
      signature,
      authorization: {
        from: PAYER,
        to: PAYTO,
        value: "10000",
        validAfter: "0",
        validBefore: "9999999999",
        nonce,
      },
    },
  };
  return { "payment-signature": Buffer.from(JSON.stringify(payload)).toString("base64") };
}

function researchHeaders(input = { symbols: ["BTC"] }, overrides = {}) {
  const normalized = validateResearchReportInput(input);
  return signedHeaders({ ...overrides, requestFingerprint: fingerprintResearchReportRequest(normalized) });
}

function facilitatorFetch({
  verify = { isValid: true, payer: PAYER },
  settle = { success: true, transaction: TX, network: X402_DEFAULTS.network, payer: PAYER },
  calls = [],
  throwOn = null,
} = {}) {
  return async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, body: JSON.parse(options.body) });
    if (throwOn === path) throw new Error("connection refused");
    const data = path === "/verify" ? verify : settle;
    return { status: 200, json: async () => data };
  };
}

function facilitatorClient({ settle, statuses = [], calls = [], statusError = null } = {}) {
  let statusIndex = 0;
  return {
    async verify() {
      calls.push("verify");
      return { isValid: true, payer: PAYER };
    },
    async settle() {
      calls.push("settle");
      return settle ?? { success: true, status: "success", transaction: TX, network: X402_DEFAULTS.network, payer: PAYER };
    },
    async getSettleStatus(transaction) {
      calls.push(`status:${transaction}`);
      if (statusError) throw statusError;
      const result = statuses[Math.min(statusIndex, statuses.length - 1)];
      statusIndex += 1;
      return result ?? { success: true, status: "pending", transaction };
    },
  };
}

async function verifyPaid(gate, options = {}) {
  return gate.verify({
    headers: signedHeaders(options.signature),
    requestId: options.requestId || "req_verify",
    requestFingerprint: options.requestFingerprint || FINGERPRINT,
    ...RESOURCE,
  });
}

test("gate is not configured when disabled or misconfigured", () => {
  assert.equal(createPaymentGate({ enabled: false, logger: silentLogger }).configured, false);
  assert.equal(createPaymentGate(gateConfig({ payTo: "not-an-address" })).configured, false);
  assert.equal(createPaymentGate(gateConfig({ asset: null })).configured, false);
  assert.equal(createPaymentGate(gateConfig({ facilitatorUrl: "http://insecure.example.com" })).configured, false);
  assert.equal(createPaymentGate(gateConfig({ operationStore: {} })).configured, false);
  assert.equal(createPaymentGate(gateConfig({ facilitatorApiKey: null })).configured, false);
  assert.equal(createPaymentGate(gateConfig({ facilitatorSecretKey: null })).configured, false);
  assert.equal(createPaymentGate(gateConfig({ facilitatorPassphrase: null })).configured, false);
  assert.equal(createPaymentGate(gateConfig()).configured, true);
});

test("paymentGateFromEnv parses configuration", () => {
  const gate = paymentGateFromEnv({
    X402_ENABLED: "true",
    X402_PAYTO_ADDRESS: PAYTO,
    X402_ASSET_ADDRESS: ASSET,
    X402_FACILITATOR_URL: "https://facilitator.example.com",
    OKX_API_KEY: "test-api-key",
    OKX_SECRET_KEY: "test-secret-key",
    OKX_API_PASSPHRASE: "test-passphrase",
  }, { logger: silentLogger });
  assert.equal(gate.configured, true);
  assert.equal(gate.network, "eip155:1952");
  assert.equal(gate.storeDurability, "process_local");
  assert.equal(gate.facilitatorMode, "okx_sdk");
  const disabledProbe = paymentGateFromEnv({
    OKX_API_KEY: "test-api-key",
    OKX_SECRET_KEY: "test-secret-key",
    OKX_API_PASSPHRASE: "test-passphrase",
  }, { logger: silentLogger });
  assert.equal(disabledProbe.configured, false);
  assert.equal(disabledProbe.supportConfigured, true);
  assert.equal(disabledProbe.facilitatorMode, "okx_sdk");
  assert.equal(paymentGateFromEnv({}, { logger: silentLogger }).configured, false);
});

test("support discovery delegates to the configured facilitator client and caches the sanitized result", async () => {
  const supported = {
    kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:1952" }],
    extensions: [],
    signers: {},
  };
  let supportCalls = 0;
  const gate = createPaymentGate(gateConfig({
    facilitatorClient: {
      async getSupported() { supportCalls += 1; return supported; },
      async verify() { return { isValid: true }; },
      async settle() { return { success: true, status: "success", transaction: TX, network: X402_DEFAULTS.network }; },
    },
  }));
  assert.equal(gate.facilitatorMode, "okx_sdk");
  assert.deepEqual(await gate.getSupported(), supported);
  assert.deepEqual(await gate.checkSupport(), {
    expected: { x402Version: 2, scheme: "exact", network: "eip155:1952" },
    supported: true,
    matching_kind_count: 1,
    advertised_kind_count: 1,
  });
  assert.equal(supportCalls, 1);
});

test("support discovery caches failures during the retry cooldown", async () => {
  let supportCalls = 0;
  const failure = new Error("upstream rejected secret test-secret-key");
  const gate = createPaymentGate(gateConfig({
    facilitatorClient: {
      async getSupported() { supportCalls += 1; throw failure; },
      async verify() { return { isValid: true }; },
      async settle() { return { success: true, status: "success", transaction: TX, network: X402_DEFAULTS.network }; },
    },
  }));

  await assert.rejects(gate.checkSupport(), (error) => error === failure);
  await assert.rejects(gate.checkSupport(), (error) => error === failure);
  assert.equal(supportCalls, 1);
});

test("operation store expires only unconsumed verification and never evicts recovery state", async () => {
  let time = 100;
  const store = createPaymentOperationStore({ now: () => time, ttlMs: 10, maxOperations: 2 });
  assert.equal(await store.create("a", { state: "settled" }), true);
  assert.equal(await store.create("a", { state: "other" }), false);
  assert.equal(await store.create("b", { state: "verified" }), true);
  assert.equal(await store.create("c", { state: "verified" }), false, "capacity rejects new work instead of evicting");
  time = 200;
  assert.equal((await store.get("a")).state, "settled");
  assert.equal(await store.get("b"), null);
  assert.equal(await store.create("c", { state: "verified" }), true);
});

test("unpaid verification returns a spec-compliant 402 challenge", async () => {
  const gate = createPaymentGate(gateConfig());
  const result = await gate.verify({ headers: {}, requestId: "req_1", requestFingerprint: FINGERPRINT, ...RESOURCE });
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 402);
  assert.equal(result.response.body.error, "payment_required");
  const decoded = decodeHeader(result.response.headers, "payment-required");
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.resource.url, RESOURCE.resourceUrl);
  assert.equal(decoded.resource.mimeType, "application/json");
  assert.equal(decoded.extensions, undefined);
  assert.deepEqual(decoded.accepts[0], {
    scheme: "exact",
    network: "eip155:1952",
    amount: "10000",
    asset: ASSET,
    payTo: PAYTO,
    maxTimeoutSeconds: 300,
    extra: {
      name: "USD₮0",
      version: "2",
      liquidfluxRequest: { version: "research-report:v1", requestFingerprint: FINGERPRINT },
    },
  });
});

test("top-level challenge extensions cannot substitute for the echoed accepts binding", async () => {
  const calls = [];
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) }));
  const headers = signedHeaders();
  const payload = decodeHeader(headers, "payment-signature");
  delete payload.accepted.extra.liquidfluxRequest;
  payload.extensions = {
    liquidfluxRequest: { info: { version: "research-report:v1", requestFingerprint: FINGERPRINT } },
  };
  headers["payment-signature"] = Buffer.from(JSON.stringify(payload)).toString("base64");

  const result = await gate.verify({ headers, requestId: "req_extension", requestFingerprint: FINGERPRINT, ...RESOURCE });
  assert.equal(result.response.status, 402);
  assert.equal(result.response.body.invalid_reason, "payment_request_binding_mismatch");
  assert.equal(calls.length, 0);
});

test("malformed, incomplete, or mismatched signatures never reach the facilitator", async () => {
  const calls = [];
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) }));
  const common = { requestFingerprint: FINGERPRINT, ...RESOURCE };

  const malformed = await gate.verify({ headers: { "payment-signature": "!!!" }, requestId: "req_2", ...common });
  assert.equal(malformed.response.body.invalid_reason, "payment_signature_malformed");

  const incomplete = Buffer.from(JSON.stringify({ x402Version: 2, accepted: {}, payload: {} })).toString("base64");
  const invalid = await gate.verify({ headers: { "payment-signature": incomplete }, requestId: "req_3", ...common });
  assert.equal(invalid.response.body.invalid_reason, "payment_signature_invalid");

  const wrongAmount = await gate.verify({ headers: signedHeaders({ accepted: { amount: "1" } }), requestId: "req_4", ...common });
  assert.equal(wrongAmount.response.body.invalid_reason, "payment_requirements_mismatch");
  assert.equal(calls.length, 0);
});

test("invalid verification returns a fresh challenge", async () => {
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ verify: { isValid: false, invalidReason: "insufficient_funds" } }) }));
  const result = await verifyPaid(gate);
  assert.equal(result.response.status, 402);
  assert.equal(result.response.body.invalid_reason, "insufficient_funds");
  assert.ok(result.response.headers["payment-required"]);
});

test("verification and settlement facilitator failures fail closed", async () => {
  const verifyDown = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ throwOn: "/verify" }) }));
  const unavailable = await verifyPaid(verifyDown);
  assert.equal(unavailable.response.status, 502);
  assert.equal(unavailable.response.body.error, "facilitator_unavailable");

  const settleDown = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ throwOn: "/settle" }) }));
  const authorization = await verifyPaid(settleDown);
  const unknown = await settleDown.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_unknown" });
  assert.equal(unknown.response.status, 502);
  assert.equal(unknown.response.body.error, "settlement_outcome_unknown");
});

test("storage failure before settlement never calls the facilitator settle endpoint", async () => {
  const calls = [];
  let operation = null;
  const store = {
    durability: "test",
    async get() { return operation; },
    async create(_key, value) { operation = value; return true; },
    async update() { return null; },
    async transition() { return null; },
    async delete() { operation = null; },
  };
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }), operationStore: store }));
  const authorization = await verifyPaid(gate);
  const result = await gate.settle({ context: authorization.context, artifact: { complete: true }, requestId: "req_store" });
  assert.equal(result.response.status, 503);
  assert.equal(result.response.body.error, "payment_state_unavailable");
  assert.deepEqual(calls.map((call) => call.path), ["/verify"]);
});

test("successful lifecycle verifies, persists artifact, settles, and returns a receipt", async () => {
  const calls = [];
  const store = createPaymentOperationStore();
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }), operationStore: store }));
  const authorization = await verifyPaid(gate);
  assert.equal(authorization.status, "verified");
  assert.deepEqual(calls.map((call) => call.path), ["/verify"]);
  assert.deepEqual(calls[0].body.paymentRequirements.extra.liquidfluxRequest, {
    version: "research-report:v1",
    requestFingerprint: FINGERPRINT,
  });

  const artifact = { generated: true };
  const result = await gate.settle({ context: authorization.context, artifact, requestId: "req_settle" });
  assert.equal(result.ok, true);
  assert.equal(result.status, "settled");
  assert.deepEqual(result.artifact, artifact);
  assert.deepEqual(calls.map((call) => call.path), ["/verify", "/settle"]);
  assert.equal(result.payer, PAYER);
  assert.equal(result.transaction, TX);
  assert.deepEqual(decodeHeader(result.responseHeaders, "payment-response"), {
    success: true, transaction: TX, network: X402_DEFAULTS.network, payer: PAYER,
  });
});

test("same authorization recovers the stored artifact without facilitator calls", async () => {
  const calls = [];
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) }));
  const authorization = await verifyPaid(gate);
  await gate.settle({ context: authorization.context, artifact: { stable: "original" }, requestId: "req_settle" });
  const recovered = await verifyPaid(gate, { requestId: "req_retry" });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.status, "recovered");
  assert.deepEqual(recovered.artifact, { stable: "original" });
  assert.deepEqual(calls.map((call) => call.path), ["/verify", "/settle"]);
});

test("recovery requires the exact facilitator-verified payment proof", async () => {
  const calls = [];
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) }));
  const authorization = await verifyPaid(gate);
  await gate.settle({ context: authorization.context, artifact: { paid: true }, requestId: "req_settle" });

  const forged = await verifyPaid(gate, { requestId: "req_forged", signature: { signature: "0xdifferent" } });
  assert.equal(forged.response.status, 409);
  assert.equal(forged.response.body.error, "authorization_proof_mismatch");
  assert.deepEqual(calls.map((call) => call.path), ["/verify", "/settle"]);
});

test("authorization cannot be replayed for a changed request", async () => {
  const calls = [];
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) }));
  const authorization = await verifyPaid(gate);
  await gate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_settle" });
  const mismatch = await verifyPaid(gate, { requestId: "req_changed", requestFingerprint: "b".repeat(64) });
  assert.equal(mismatch.response.status, 402);
  assert.equal(mismatch.response.body.invalid_reason, "payment_request_binding_mismatch");
  assert.deepEqual(calls.map((call) => call.path), ["/verify", "/settle"]);
});

test("concurrent duplicate authorization is blocked before a second verification", async () => {
  const calls = [];
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) }));
  const first = await verifyPaid(gate);
  assert.equal(first.status, "verified");
  const duplicate = await verifyPaid(gate, { requestId: "req_duplicate" });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.response.body.error, "payment_in_progress");
  assert.deepEqual(calls.map((call) => call.path), ["/verify"]);
});

test("atomic settlement ownership permits only one facilitator settlement call", async () => {
  const calls = [];
  const gate = createPaymentGate(gateConfig({ fetchImpl: async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, body: JSON.parse(options.body) });
    if (path === "/settle") await new Promise((resolve) => setTimeout(resolve, 10));
    const data = path === "/verify"
      ? { isValid: true, payer: PAYER }
      : { success: true, transaction: TX, network: X402_DEFAULTS.network, payer: PAYER };
    return { status: 200, json: async () => data };
  } }));
  const authorization = await verifyPaid(gate);
  const [first, second] = await Promise.all([
    gate.settle({ context: authorization.context, artifact: { report: 1 }, requestId: "req_first" }),
    gate.settle({ context: authorization.context, artifact: { report: 2 }, requestId: "req_second" }),
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.response.status, 202);
  assert.equal(second.response.body.error, "settlement_pending");
  assert.equal(calls.filter((call) => call.path === "/settle").length, 1);
});

test("post-settlement persistence failure never claims recoverable success", async () => {
  const calls = [];
  let operation = null;
  let transitions = 0;
  const store = {
    durability: "test",
    async get() { return operation; },
    async create(_key, value) { operation = value; return true; },
    async update(_key, patch) { operation = { ...operation, ...patch }; return operation; },
    async transition(_key, expected, patch) {
      if (!operation || operation.state !== expected) return null;
      transitions += 1;
      if (transitions === 2) return null;
      operation = { ...operation, ...patch };
      return operation;
    },
    async delete() { operation = null; },
  };
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }), operationStore: store }));
  const authorization = await verifyPaid(gate);
  const result = await gate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_persist" });
  assert.equal(result.response.status, 500);
  assert.equal(result.response.body.error, "payment_receipt_persistence_failed");
  assert.deepEqual(calls.map((call) => call.path), ["/verify", "/settle"]);
});

test("definitive settlement failure is terminal and is never retried blindly", async () => {
  const calls = [];
  const client = facilitatorClient({
    calls,
    settle: { success: false, errorReason: "invalid_transaction_state", transaction: "", network: X402_DEFAULTS.network },
  });
  const gate = createPaymentGate(gateConfig({ facilitatorClient: client, settlementPollIntervalMs: 0 }));
  const authorization = await verifyPaid(gate);
  const failed = await gate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_fail" });
  assert.equal(failed.response.status, 402);
  assert.equal(failed.response.body.error, "settlement_failed");
  assert.equal(failed.response.body.retryable, false);
  const retry = await verifyPaid(gate, { requestId: "req_retry" });
  assert.equal(retry.response.status, 402);
  assert.equal(retry.response.body.error, "settlement_failed");
  assert.deepEqual(calls, ["verify", "settle"]);
});

test("pending settlement persists its hash and reconciles on exact retry without resettling", async () => {
  const calls = [];
  const store = createPaymentOperationStore();
  const client = facilitatorClient({
    calls,
    settle: { success: true, status: "pending", transaction: TX, network: X402_DEFAULTS.network, payer: PAYER },
    statuses: [{ success: true, status: "success", transaction: TX, network: X402_DEFAULTS.network, payer: PAYER }],
  });
  const gate = createPaymentGate(gateConfig({ facilitatorClient: client, operationStore: store, settlementPollIntervalMs: 0 }));
  const authorization = await verifyPaid(gate);
  const pending = await gate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_pending" });
  assert.equal(pending.response.status, 202);
  assert.equal(pending.response.body.error, "settlement_pending");
  const stored = await store.get(authorization.context.key);
  assert.deepEqual(stored.settlement, { status: "pending", transaction: TX, network: X402_DEFAULTS.network, payer: PAYER });

  const recovered = await verifyPaid(gate, { requestId: "req_retry" });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.status, "recovered");
  assert.deepEqual(recovered.artifact, { report: true });
  assert.deepEqual(calls, ["verify", "settle", `status:${TX}`]);
});

test("timeout with a transaction hash polls and releases only after confirmed success", async () => {
  const calls = [];
  const client = facilitatorClient({
    calls,
    settle: { success: false, status: "timeout", txHash: TX, network: X402_DEFAULTS.network, payer: PAYER },
    statuses: [
      { success: true, status: "pending", transaction: TX },
      { success: true, status: "success", transaction: TX, network: X402_DEFAULTS.network, payer: PAYER },
    ],
  });
  const gate = createPaymentGate(gateConfig({ facilitatorClient: client, settlementPollAttempts: 2, settlementPollIntervalMs: 0 }));
  const authorization = await verifyPaid(gate);
  const result = await gate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_timeout" });
  assert.equal(result.ok, true);
  assert.equal(result.status, "recovered");
  assert.equal(result.transaction, TX);
  assert.deepEqual(calls, ["verify", "settle", `status:${TX}`, `status:${TX}`]);
});

test("timeout remains pending when bounded status polling remains pending", async () => {
  const calls = [];
  const client = facilitatorClient({
    calls,
    settle: { success: false, status: "timeout", transaction: TX, network: X402_DEFAULTS.network },
    statuses: [{ success: true, status: "pending", transaction: TX }],
  });
  const gate = createPaymentGate(gateConfig({ facilitatorClient: client, settlementPollAttempts: 2, settlementPollIntervalMs: 0 }));
  const authorization = await verifyPaid(gate);
  const result = await gate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_timeout" });
  assert.equal(result.response.status, 202);
  assert.equal(result.response.body.error, "settlement_pending");
  assert.deepEqual(calls, ["verify", "settle", `status:${TX}`, `status:${TX}`]);
});

test("status API failure keeps a timed-out settlement withheld and retryable", async () => {
  const calls = [];
  const client = facilitatorClient({
    calls,
    settle: { success: false, status: "timeout", transaction: TX },
    statusError: new Error("upstream body with secret-signature"),
  });
  const gate = createPaymentGate(gateConfig({ facilitatorClient: client, settlementPollAttempts: 2, settlementPollIntervalMs: 0 }));
  const authorization = await verifyPaid(gate);
  const result = await gate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_poll_down" });
  assert.equal(result.response.status, 202);
  assert.equal(result.response.body.error, "settlement_pending");
  assert.equal(result.response.body.retryable, true);
  assert.deepEqual(calls, ["verify", "settle", `status:${TX}`, `status:${TX}`]);
});

test("status lookup definitive failure records terminal settlement failure", async () => {
  const calls = [];
  const client = facilitatorClient({
    calls,
    settle: { success: false, status: "timeout", transaction: TX },
    statuses: [{ success: false, status: "failed", transaction: TX }],
  });
  const gate = createPaymentGate(gateConfig({ facilitatorClient: client, settlementPollIntervalMs: 0 }));
  const authorization = await verifyPaid(gate);
  const result = await gate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_chain_fail" });
  assert.equal(result.response.status, 402);
  assert.equal(result.response.body.error, "settlement_failed");
  const retry = await verifyPaid(gate, { requestId: "req_chain_fail_retry" });
  assert.equal(retry.response.body.error, "settlement_failed");
  assert.deepEqual(calls, ["verify", "settle", `status:${TX}`]);
});

test("contradictory status success without a successful response never releases the artifact", async () => {
  const calls = [];
  const client = facilitatorClient({
    calls,
    settle: { success: false, status: "timeout", transaction: TX },
    statuses: [{ success: false, status: "success", transaction: TX }],
  });
  const gate = createPaymentGate(gateConfig({ facilitatorClient: client, settlementPollIntervalMs: 0 }));
  const authorization = await verifyPaid(gate);
  const result = await gate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_contradictory" });
  assert.equal(result.response.status, 402);
  assert.equal(result.response.body.error, "settlement_failed");
  assert.deepEqual(calls, ["verify", "settle", `status:${TX}`]);
});

test("concurrent exact retries return the reconciled receipt without a false persistence error", async () => {
  let releaseStatuses;
  let statusCalls = 0;
  let settleCalls = 0;
  const statusesReady = new Promise((resolve) => { releaseStatuses = resolve; });
  const client = {
    async verify() { return { isValid: true, payer: PAYER }; },
    async settle() {
      settleCalls += 1;
      return { success: true, status: "pending", transaction: TX, network: X402_DEFAULTS.network, payer: PAYER };
    },
    async getSettleStatus() {
      statusCalls += 1;
      if (statusCalls === 2) releaseStatuses();
      await statusesReady;
      return { success: true, status: "success", transaction: TX, network: X402_DEFAULTS.network, payer: PAYER };
    },
  };
  const gate = createPaymentGate(gateConfig({ facilitatorClient: client, settlementPollIntervalMs: 0 }));
  const authorization = await verifyPaid(gate);
  const pending = await gate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_pending" });
  assert.equal(pending.response.status, 202);

  const [first, second] = await Promise.all([
    verifyPaid(gate, { requestId: "req_retry_1" }),
    verifyPaid(gate, { requestId: "req_retry_2" }),
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.transaction, TX);
  assert.equal(second.transaction, TX);
  assert.equal(settleCalls, 1);
  assert.equal(statusCalls, 2);
});

test("pending reconciliation fails closed when updated state cannot be persisted", async () => {
  const baseStore = createPaymentOperationStore();
  let updates = 0;
  const store = {
    durability: "test",
    get: (...args) => baseStore.get(...args),
    create: (...args) => baseStore.create(...args),
    transition: (...args) => baseStore.transition(...args),
    delete: (...args) => baseStore.delete(...args),
    async update(...args) {
      updates += 1;
      return updates === 1 ? baseStore.update(...args) : null;
    },
  };
  const client = facilitatorClient({
    settle: { success: false, status: "timeout", transaction: TX },
    statuses: [{ success: true, status: "pending", transaction: TX }],
  });
  const gate = createPaymentGate(gateConfig({
    facilitatorClient: client,
    operationStore: store,
    settlementPollAttempts: 1,
    settlementPollIntervalMs: 0,
  }));
  const authorization = await verifyPaid(gate);
  const result = await gate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_store_fail" });
  assert.equal(result.response.status, 500);
  assert.equal(result.response.body.error, "payment_settlement_state_persistence_failed");
});

test("timeout without a transaction hash remains ambiguous and fails closed", async () => {
  const calls = [];
  const client = facilitatorClient({ calls, settle: { success: false, status: "timeout", transaction: "" } });
  const gate = createPaymentGate(gateConfig({ facilitatorClient: client, settlementPollIntervalMs: 0 }));
  const authorization = await verifyPaid(gate);
  const result = await gate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_no_hash" });
  assert.equal(result.response.status, 502);
  assert.equal(result.response.body.error, "settlement_outcome_unknown");
  const retry = await verifyPaid(gate, { requestId: "req_no_hash_retry" });
  assert.equal(retry.response.status, 202);
  assert.deepEqual(calls, ["verify", "settle"]);
});

test("payment logs never contain signatures, nonce, authorization, credentials, or upstream bodies", async () => {
  const logs = [];
  const logger = { info(value) { logs.push(value); }, error(value) { logs.push(value); } };
  const fetchImpl = async (_url, options) => { throw new Error(`request failed with test-api-key: ${options.body}`); };
  const verifyGate = createPaymentGate(gateConfig({ logger, fetchImpl }));
  await verifyPaid(verifyGate, { signature: { nonce: "0xdeadbeef", signature: "0xsecret" } });

  const statusGate = createPaymentGate(gateConfig({
    logger,
    settlementPollAttempts: 1,
    settlementPollIntervalMs: 0,
    facilitatorClient: facilitatorClient({
      settle: { success: false, status: "timeout", transaction: TX },
      statusError: new Error("upstream test-secret-key body 0xprivate"),
    }),
  }));
  const authorization = await verifyPaid(statusGate);
  await statusGate.settle({ context: authorization.context, artifact: { report: true }, requestId: "req_redacted" });

  const joined = logs.join("\n");
  assert.doesNotMatch(joined, /0xsecret|0xdeadbeef|payment-signature|authorization|test-api-key|test-secret-key|0xprivate/i);
});

test("research request normalization is deterministic and request-sensitive", () => {
  const first = validateResearchReportInput({ symbols: ["btc", "ETH"], question: "  Test question  " });
  const reordered = validateResearchReportInput({ symbols: ["ETH", "BTC"], question: "Test question" });
  assert.notEqual(fingerprintResearchReportRequest(first), fingerprintResearchReportRequest(reordered));
  const changed = validateResearchReportInput({ symbols: ["BTC", "ETH"], question: "Different question" });
  assert.notEqual(fingerprintResearchReportRequest(first), fingerprintResearchReportRequest(changed));
});

test("validateResearchReportInput bounds symbols and defaults the question", () => {
  assert.deepEqual(validateResearchReportInput({ symbols: ["btc", "ETH"] }), {
    symbols: ["BTC", "ETH"], topics: ["funding", "basis", "liquidity", "risk"], question: DEFAULT_RESEARCH_QUESTION,
  });
  assert.deepEqual(validateResearchReportInput({ symbols: "btc" }), {
    symbols: ["BTC"], topics: ["funding", "basis", "liquidity", "risk"], question: DEFAULT_RESEARCH_QUESTION,
  });
  assert.equal(
    fingerprintResearchReportRequest(validateResearchReportInput({ symbols: "BTC" })),
    fingerprintResearchReportRequest(validateResearchReportInput({ symbols: ["BTC"] })),
  );
  assert.throws(() => validateResearchReportInput({}), /missing required parameter: symbols/);
  assert.throws(() => validateResearchReportInput({ symbols: [] }), /between 1 and 5/);
  assert.throws(() => validateResearchReportInput({ symbols: ["A", "B", "C", "D", "E", "F"] }), /between 1 and 5/);
  assert.throws(() => validateResearchReportInput({ symbols: ["BTC"], leverage: 2 }), /Unknown request field/);
  assert.throws(() => validateResearchReportInput({ symbols: ["BTC"], question: "" }), /between 1 and 1000/);
});

function marketData() {
  return {
    markets: [{
      symbol: "BTC", maxLeverage: 40, funding: "0.0000125", markPx: "50000",
      oraclePx: "50010", openInterest: "1000", dayNtlVlm: "1000000", impactPxs: ["49990", "50010"],
    }],
    fetchedAt: "2026-09-22T00:00:00Z",
    ageMs: 100,
    cacheStatus: "hit",
  };
}

function handlerWith(gate, options = {}) {
  return createRequestHandler({
    getMarketData: async () => marketData(),
    requestId: options.requestId || (() => "req_test"),
    now: () => new Date("2026-09-22T00:00:01Z"),
    logger: silentLogger,
    paymentGate: gate,
    analyzeEvidence: async () => ({
      status: "completed",
      answer: "Grounded test answer",
      answer_source: "ai_filtered",
      findings: [],
      caveats: [],
      next_questions: [],
      provider: "test",
      model: "test-model",
      grounding: "test",
    }),
    ...options,
  });
}

test("research report route is unavailable without a configured gate", async () => {
  const handle = handlerWith(null);
  const result = await handle({ method: "POST", pathname: "/api/v1/research-report", bodyText: JSON.stringify({ symbols: ["BTC"] }) });
  assert.equal(result.status, 503);
  assert.equal(result.body.error, "payments_not_configured");
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
  assert.equal(result.body.payment_required.accepts[0].amount, "10000");
  assert.equal(marketDataCalled, false);
});

test("research report route validates input before verification", async () => {
  const calls = [];
  const handle = handlerWith(createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) })));
  const result = await handle({ method: "POST", pathname: "/api/v1/research-report", bodyText: JSON.stringify({ symbols: [] }) });
  assert.equal(result.status, 400);
  assert.equal(calls.length, 0);
});

test("report generation failure abandons verification and never settles", async () => {
  const calls = [];
  let attempt = 0;
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) }));
  const handle = handlerWith(gate, {
    getMarketData: async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("upstream failed before report was ready");
      return marketData();
    },
  });
  const request = { method: "POST", pathname: "/api/v1/research-report", headers: researchHeaders(), bodyText: JSON.stringify({ symbols: ["BTC"] }) };
  const failed = await handle(request);
  assert.equal(failed.status, 500);
  assert.deepEqual(calls.map((call) => call.path), ["/verify"]);
  const retry = await handle(request);
  assert.equal(retry.status, 200);
  assert.deepEqual(calls.map((call) => call.path), ["/verify", "/verify", "/settle"]);
});

test("unavailable paid analysis abandons authorization and never settles", async () => {
  const calls = [];
  let analysisAttempts = 0;
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) }));
  const handle = handlerWith(gate, {
    analyzeEvidence: async () => {
      analysisAttempts += 1;
      return analysisAttempts === 1
        ? { status: "unavailable", reason: "providers_failed" }
        : { status: "completed", answer: "Grounded retry", answer_source: "ai_filtered", findings: [], caveats: [], next_questions: [], provider: "test", model: "test-model", grounding: "test" };
    },
  });
  const request = { method: "POST", pathname: "/api/v1/research-report", headers: researchHeaders(), bodyText: JSON.stringify({ symbols: ["BTC"] }) };

  const unavailable = await handle(request);
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.error, "report_generation_unavailable");
  assert.equal(unavailable.body.retryable, true);
  assert.deepEqual(calls.map((call) => call.path), ["/verify"]);

  const retry = await handle(request);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.analysis.answer, "Grounded retry");
  assert.deepEqual(calls.map((call) => call.path), ["/verify", "/verify", "/settle"]);
});

test("paid report settles only after analysis and returns payment metadata", async () => {
  const events = [];
  const gate = createPaymentGate(gateConfig({ fetchImpl: async (url, options) => {
    const path = new URL(url).pathname;
    events.push(path);
    const data = path === "/verify" ? { isValid: true, payer: PAYER } : { success: true, transaction: TX, network: X402_DEFAULTS.network, payer: PAYER };
    return { status: 200, json: async () => data };
  } }));
  const handle = handlerWith(gate, {
    analyzeEvidence: async () => {
      events.push("analysis");
      return { status: "completed", answer: "Grounded test answer", answer_source: "ai_filtered", findings: [], caveats: [], next_questions: [], provider: "test", model: "test-model", grounding: "test" };
    },
  });
  const result = await handle({ method: "POST", pathname: "/api/v1/research-report", headers: researchHeaders(), bodyText: JSON.stringify({ symbols: ["BTC"] }) });
  assert.equal(result.status, 200);
  assert.deepEqual(events, ["/verify", "analysis", "/settle"]);
  assert.equal(result.body.report.payment.recovered, false);
  assert.equal(result.body.report.payment.transaction, TX);
  assert.equal(result.body.analysis.answer, "Grounded test answer");
  assert.ok(result.headers["payment-response"]);
});

test("route returns 200 only after a pending settlement is reconciled as successful", async () => {
  const calls = [];
  let marketCalls = 0;
  const gate = createPaymentGate(gateConfig({
    facilitatorClient: facilitatorClient({
      calls,
      settle: { success: true, status: "pending", transaction: TX, network: X402_DEFAULTS.network, payer: PAYER },
      statuses: [{ success: true, status: "success", transaction: TX, network: X402_DEFAULTS.network, payer: PAYER }],
    }),
    settlementPollIntervalMs: 0,
  }));
  const handle = handlerWith(gate, {
    getMarketData: async () => { marketCalls += 1; return marketData(); },
  });
  const request = { method: "POST", pathname: "/api/v1/research-report", headers: researchHeaders(), bodyText: JSON.stringify({ symbols: ["BTC"] }) };

  const pending = await handle(request);
  assert.equal(pending.status, 202);
  assert.equal(pending.body.error, "settlement_pending");
  const recovered = await handle(request);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.report.payment.recovered, true);
  assert.equal(recovered.body.report.payment.transaction, TX);
  assert.equal(marketCalls, 1);
  assert.deepEqual(calls, ["verify", "settle", `status:${TX}`]);
});

test("route recovers the exact stored report and rejects changed replay", async () => {
  const calls = [];
  let marketCalls = 0;
  let requestNumber = 0;
  let rateCalls = 0;
  const gate = createPaymentGate(gateConfig({ fetchImpl: facilitatorFetch({ calls }) }));
  const handle = handlerWith(gate, {
    requestId: () => `req_${++requestNumber}`,
    getMarketData: async () => { marketCalls += 1; return marketData(); },
    rateLimiter: { consume() { rateCalls += 1; return { allowed: rateCalls === 1, limit: 1, remaining: 0, resetAt: Date.now() + 60000 }; } },
  });
  const base = { method: "POST", pathname: "/api/v1/research-report", headers: researchHeaders(), bodyText: JSON.stringify({ symbols: ["BTC"] }) };
  const first = await handle(base);
  const recovered = await handle(base);
  assert.equal(first.status, 200);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.report.payment.recovered, true);
  assert.equal(recovered.body.generated_at, first.body.generated_at);
  assert.equal(recovered.body.request_id, "req_2");
  assert.equal(marketCalls, 1);
  assert.equal(rateCalls, 1, "settled recovery bypasses ordinary generation rate limiting");
  assert.deepEqual(calls.map((call) => call.path), ["/verify", "/settle"]);

  const changed = await handle({ ...base, bodyText: JSON.stringify({ symbols: ["BTC"], question: "A changed request" }) });
  assert.equal(changed.status, 409);
  assert.equal(changed.body.error, "authorization_request_mismatch");
  assert.equal(marketCalls, 1);
});

test("index lists the paid research report endpoint", async () => {
  const handle = handlerWith(null);
  const index = await handle({ method: "GET", pathname: "/" });
  assert.deepEqual(index.body.endpoints.research_report, { method: "POST", path: "/api/v1/research-report", payment: "x402" });
});
