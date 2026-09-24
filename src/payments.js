import { createHash } from "node:crypto";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";

/**
 * x402 v2 seller gate (OKX Agent Payments Protocol compatible).
 *
 * Lifecycle: challenge -> verify -> build resource -> settle -> release.
 * The caller must finish building the complete resource before calling settle.
 * A bounded operation store binds each verified authorization to one normalized
 * request and preserves the generated artifact before settlement. This permits
 * duplicate/lost-response recovery while the store remains available.
 *
 * The default store is process-local and intentionally identified as such.
 * Testnet may use it for mechanical proof, but production/mainnet requires a
 * durable shared store so reconciliation survives restarts and multiple instances.
 */

export class PaymentError extends Error {
  constructor(message, code = "payment_error", status = 402) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.status = status;
  }
}

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ATOMIC_AMOUNT_PATTERN = /^[0-9]+$/;
const NONCE_PATTERN = /^0x[0-9a-fA-F]+$/;

export const X402_DEFAULTS = {
  network: "eip155:1952",
  assetName: "USD₮0",
  assetDecimals: 6,
  maxTimeoutSeconds: 300,
  timeoutMs: 10000,
  settlementPollAttempts: 5,
  settlementPollIntervalMs: 1000,
  operationTtlMs: 24 * 60 * 60 * 1000,
  maxOperations: 1000,
  facilitatorUrl: "https://web3.okx.com",
};

function base64Encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function base64DecodeJson(value) {
  try {
    return JSON.parse(Buffer.from(String(value), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function hash(parts) {
  return createHash("sha256").update(parts.join("\u001f"), "utf8").digest("hex");
}

function validAmount(value) {
  return typeof value === "string" && ATOMIC_AMOUNT_PATTERN.test(value) && value !== "0";
}

function failure(status, requestId, error, message, headers = {}, extra = {}) {
  return { ok: false, response: { status, headers, body: { request_id: requestId, error, message, ...extra } } };
}

/**
 * Bounded process-local store. A custom store may implement the same methods:
 * get(key), create(key, operation), update(key, patch), delete(key).
 */
export function createPaymentOperationStore({
  now = () => Date.now(),
  ttlMs = X402_DEFAULTS.operationTtlMs,
  maxOperations = X402_DEFAULTS.maxOperations,
} = {}) {
  const operations = new Map();

  function prune() {
    const cutoff = now() - ttlMs;
    // Never forget settling or settled authorization bindings. Once capacity is
    // reached, reject new work rather than evict replay/recovery state.
    for (const [key, value] of operations) {
      if (value.state === "verified" && value.updatedAt < cutoff) operations.delete(key);
    }
  }

  return {
    durability: "process_local",
    async get(key) {
      prune();
      return operations.get(key) || null;
    },
    async create(key, operation) {
      prune();
      if (operations.has(key) || operations.size >= maxOperations) return false;
      operations.set(key, { ...operation, updatedAt: now() });
      return true;
    },
    async update(key, patch) {
      const current = operations.get(key);
      if (!current) return null;
      const next = { ...current, ...patch, updatedAt: now() };
      operations.set(key, next);
      return next;
    },
    async transition(key, expectedState, patch) {
      const current = operations.get(key);
      if (!current || current.state !== expectedState) return null;
      const next = { ...current, ...patch, updatedAt: now() };
      operations.set(key, next);
      return next;
    },
    async delete(key) {
      operations.delete(key);
    },
  };
}

export function createPaymentGate({
  enabled = false,
  payTo = null,
  network = X402_DEFAULTS.network,
  asset = null,
  assetName = X402_DEFAULTS.assetName,
  assetDecimals = X402_DEFAULTS.assetDecimals,
  facilitatorUrl = null,
  facilitatorApiKey = null,
  facilitatorSecretKey = null,
  facilitatorPassphrase = null,
  facilitatorClient = null,
  maxTimeoutSeconds = X402_DEFAULTS.maxTimeoutSeconds,
  fetchImpl = null,
  logger = console,
  timeoutMs = X402_DEFAULTS.timeoutMs,
  settlementPollAttempts = X402_DEFAULTS.settlementPollAttempts,
  settlementPollIntervalMs = X402_DEFAULTS.settlementPollIntervalMs,
  operationStore = createPaymentOperationStore(),
} = {}) {
  const problems = [];
  if (!enabled) problems.push("disabled");
  if (enabled && (typeof payTo !== "string" || !ADDRESS_PATTERN.test(payTo))) problems.push("invalid_payto_address");
  if (enabled && (typeof asset !== "string" || !ADDRESS_PATTERN.test(asset))) problems.push("invalid_asset_address");
  if (enabled && (typeof facilitatorUrl !== "string" || !/^https:\/\//.test(facilitatorUrl))) problems.push("invalid_facilitator_url");
  const customFacilitator = facilitatorClient !== null || fetchImpl !== null;
  if (enabled && !customFacilitator && (typeof facilitatorApiKey !== "string" || facilitatorApiKey.trim() === "")) problems.push("missing_facilitator_api_key");
  if (enabled && !customFacilitator && (typeof facilitatorSecretKey !== "string" || facilitatorSecretKey.trim() === "")) problems.push("missing_facilitator_secret_key");
  if (enabled && !customFacilitator && (typeof facilitatorPassphrase !== "string" || facilitatorPassphrase.trim() === "")) problems.push("missing_facilitator_passphrase");
  if (enabled && facilitatorClient !== null && (typeof facilitatorClient?.verify !== "function" || typeof facilitatorClient?.settle !== "function")) problems.push("invalid_facilitator_client");
  if (enabled && fetchImpl !== null && typeof fetchImpl !== "function") problems.push("invalid_facilitator_transport");
  if (enabled && (!Number.isInteger(assetDecimals) || assetDecimals < 0 || assetDecimals > 36)) problems.push("invalid_asset_decimals");
  if (enabled && (!Number.isInteger(maxTimeoutSeconds) || maxTimeoutSeconds < 1)) problems.push("invalid_max_timeout");
  if (enabled && (!Number.isInteger(settlementPollAttempts) || settlementPollAttempts < 1)) problems.push("invalid_settlement_poll_attempts");
  if (enabled && (!Number.isInteger(settlementPollIntervalMs) || settlementPollIntervalMs < 0)) problems.push("invalid_settlement_poll_interval");
  for (const method of ["get", "create", "update", "transition", "delete"]) {
    if (enabled && typeof operationStore?.[method] !== "function") problems.push("invalid_operation_store");
  }
  const configured = problems.length === 0;
  const validFacilitatorUrl = typeof facilitatorUrl === "string" && /^https:\/\//.test(facilitatorUrl);
  const facilitatorBase = validFacilitatorUrl ? facilitatorUrl.replace(/\/+$/, "") : null;
  const credentialsAvailable = typeof facilitatorApiKey === "string" && facilitatorApiKey.trim() !== ""
    && typeof facilitatorSecretKey === "string" && facilitatorSecretKey.trim() !== ""
    && typeof facilitatorPassphrase === "string" && facilitatorPassphrase.trim() !== "";
  const validInjectedClient = facilitatorClient !== null
    && typeof facilitatorClient?.verify === "function"
    && typeof facilitatorClient?.settle === "function";
  const activeFacilitator = validInjectedClient
    ? facilitatorClient
    : !fetchImpl && validFacilitatorUrl && credentialsAvailable
      ? new OKXFacilitatorClient({
        apiKey: facilitatorApiKey,
        secretKey: facilitatorSecretKey,
        passphrase: facilitatorPassphrase,
        baseUrl: facilitatorBase,
        syncSettle: true,
      })
      : null;
  const supportConfigured = Boolean(
    (activeFacilitator && typeof activeFacilitator.getSupported === "function")
    || (typeof fetchImpl === "function" && facilitatorBase),
  );
  let supportedCache = null;
  let supportedCacheExpiresAt = 0;
  let supportedError = null;
  let supportedErrorExpiresAt = 0;
  let supportedRequest = null;

  function paymentRequirements(amountAtomic, requestFingerprint) {
    if (!validAmount(amountAtomic)) throw new PaymentError("Invalid price configuration", "invalid_price", 500);
    return {
      scheme: "exact",
      network,
      amount: amountAtomic,
      asset,
      payTo,
      maxTimeoutSeconds,
      extra: {
        name: assetName,
        version: "2",
        liquidfluxRequest: { version: "research-report:v1", requestFingerprint },
      },
    };
  }

  function paymentRequiredPayload({ resourceUrl, description, amountAtomic, requestFingerprint, error }) {
    return {
      x402Version: 2,
      ...(error ? { error } : {}),
      resource: { url: resourceUrl, description, mimeType: "application/json" },
      // The OKX buyer preserves the selected accepts[] entry in
      // PAYMENT-SIGNATURE, while top-level challenge extensions are not echoed.
      accepts: [paymentRequirements(amountAtomic, requestFingerprint)],
    };
  }

  function challengeResponse({ resourceUrl, description, amountAtomic, requestId, requestFingerprint, error, invalidReason }) {
    const payload = paymentRequiredPayload({
      resourceUrl,
      description,
      amountAtomic,
      requestFingerprint,
      error: error || "PAYMENT-SIGNATURE header is required",
    });
    return {
      status: 402,
      headers: { "payment-required": base64Encode(payload) },
      body: {
        request_id: requestId,
        error: "payment_required",
        ...(invalidReason ? { invalid_reason: invalidReason } : {}),
        payment_required: payload,
      },
    };
  }

  function extractPaymentPayload(headers) {
    const raw = headers["payment-signature"] || headers["Payment-Signature"] || headers["PAYMENT-SIGNATURE"];
    if (!raw) return { payload: null, error: null };
    const decoded = base64DecodeJson(raw);
    if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
      return { payload: null, error: "payment_signature_malformed" };
    }
    const authorization = decoded.payload?.authorization;
    if (decoded.x402Version !== 2 || typeof decoded.accepted !== "object" || decoded.accepted === null
      || typeof decoded.payload !== "object" || decoded.payload === null
      || typeof decoded.payload.signature !== "string" || decoded.payload.signature.length < 3
      || typeof authorization !== "object" || authorization === null
      || typeof authorization.from !== "string" || !ADDRESS_PATTERN.test(authorization.from)
      || typeof authorization.nonce !== "string" || !NONCE_PATTERN.test(authorization.nonce)) {
      return { payload: null, error: "payment_signature_invalid" };
    }
    return { payload: decoded, proofDigest: hash([String(raw)]), error: null };
  }

  function matchesRequirements(payload, requirements) {
    const accepted = payload.accepted;
    return accepted.scheme === requirements.scheme
      && accepted.network === requirements.network
      && typeof accepted.asset === "string" && accepted.asset.toLowerCase() === requirements.asset.toLowerCase()
      && typeof accepted.payTo === "string" && accepted.payTo.toLowerCase() === requirements.payTo.toLowerCase()
      && accepted.amount === requirements.amount;
  }

  function matchesRequestBinding(payload, requestFingerprint) {
    const binding = payload.accepted?.extra?.liquidfluxRequest;
    return binding?.version === "research-report:v1" && binding.requestFingerprint === requestFingerprint;
  }

  function operationKey(payload, requirements) {
    const authorization = payload.payload.authorization;
    return hash([
      requirements.scheme,
      requirements.network,
      requirements.asset.toLowerCase(),
      authorization.from.toLowerCase(),
      authorization.nonce.toLowerCase(),
    ]);
  }

  async function withTimeout(operation) {
    let timer;
    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error("Facilitator request timed out");
            error.name = "AbortError";
            reject(error);
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function postTestFacilitator(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${facilitatorBase}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (response.status !== 200) throw new Error(`Facilitator request failed: ${response.status}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function callFacilitator(method, payload, requirements) {
    if (activeFacilitator) return withTimeout(activeFacilitator[method](payload, requirements));
    return postTestFacilitator(`/${method}`, {
      x402Version: 2,
      paymentPayload: payload,
      paymentRequirements: requirements,
    });
  }

  async function requestSupported() {
    if (activeFacilitator && typeof activeFacilitator.getSupported === "function") {
      return withTimeout(activeFacilitator.getSupported());
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${facilitatorBase}/supported`, { signal: controller.signal });
      if (response.status !== 200) throw new Error(`Facilitator request failed: ${response.status}`);
      return response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function getSupported() {
    if (!supportConfigured) {
      throw new PaymentError("Facilitator support discovery is not configured", "facilitator_support_not_configured", 503);
    }
    if (supportedCache && Date.now() < supportedCacheExpiresAt) return supportedCache;
    if (supportedError && Date.now() < supportedErrorExpiresAt) throw supportedError;
    if (!supportedRequest) {
      supportedRequest = requestSupported()
        .then((response) => {
          supportedCache = response;
          supportedCacheExpiresAt = Date.now() + (5 * 60 * 1000);
          supportedError = null;
          supportedErrorExpiresAt = 0;
          return response;
        })
        .catch((error) => {
          supportedError = error;
          supportedErrorExpiresAt = Date.now() + (60 * 1000);
          throw error;
        })
        .finally(() => { supportedRequest = null; });
    }
    return supportedRequest;
  }

  async function checkSupport() {
    const expected = { x402Version: 2, scheme: "exact", network };
    const response = await getSupported();
    const kinds = Array.isArray(response?.kinds) ? response.kinds : [];
    const matchingKindCount = kinds.filter((kind) => (
      kind?.x402Version === expected.x402Version
      && kind?.scheme === expected.scheme
      && kind?.network === expected.network
    )).length;
    return {
      expected,
      supported: matchingKindCount > 0,
      matching_kind_count: matchingKindCount,
      advertised_kind_count: kinds.length,
    };
  }

  function receiptHeaders(receipt) {
    return { "payment-response": base64Encode(receipt) };
  }

  function settlementTransaction(result) {
    const value = result?.transaction || result?.txHash;
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }

  function sanitizedSettlement(result, fallback = {}) {
    return {
      status: typeof result?.status === "string" ? result.status : fallback.status || "unknown",
      transaction: settlementTransaction(result) || fallback.transaction || null,
      network: typeof result?.network === "string" ? result.network : fallback.network || network,
      payer: typeof result?.payer === "string" ? result.payer : fallback.payer || null,
    };
  }

  function pendingSettlement(requestId) {
    return failure(202, requestId, "settlement_pending", "Payment settlement is pending reconciliation", { "retry-after": "5" }, { retryable: true });
  }

  function failedSettlement(requestId) {
    return failure(402, requestId, "settlement_failed", "Payment settlement was definitively rejected", {}, { retryable: false });
  }

  async function recordSettlementFailure(key, operation, requestId, settlement) {
    const recorded = await operationStore.transition(key, "settling", {
      state: "failed",
      settlement: { ...settlement, status: "failed" },
      payload: null,
      requirements: null,
      resourceUrl: null,
      description: null,
    });
    if (!recorded) {
      const current = await operationStore.get(key);
      if (current?.state === "settled" || current?.state === "failed") return resolveExisting(key, current, requestId);
      logger.error?.(JSON.stringify({ event: "payment_failure_persistence_failed", requestId, operation: key.slice(0, 12) }));
      return failure(500, requestId, "payment_failure_persistence_failed", "Settlement failed but its terminal state could not be persisted; operator reconciliation is required");
    }
    logger.error?.(JSON.stringify({ event: "payment_settlement_failed", requestId, operation: key.slice(0, 12), network: settlement.network, transaction: settlement.transaction }));
    return failedSettlement(requestId);
  }

  async function recordSettlementSuccess(key, operation, requestId, settlement, status = "settled") {
    const receipt = {
      success: true,
      transaction: settlement.transaction,
      network: settlement.network || network,
      payer: settlement.payer || operation.payer || null,
    };
    const recorded = await operationStore.transition(key, "settling", {
      state: "settled",
      artifact: operation.artifact,
      receipt,
      settlement: null,
      payload: null,
      requirements: null,
      resourceUrl: null,
      description: null,
    });
    if (!recorded) {
      const current = await operationStore.get(key);
      if (current?.state === "settled" || current?.state === "failed") return resolveExisting(key, current, requestId);
      logger.error?.(JSON.stringify({ event: "payment_receipt_persistence_failed", requestId, operation: key.slice(0, 12), network: receipt.network, transaction: receipt.transaction }));
      return failure(500, requestId, "payment_receipt_persistence_failed", "Payment settled but the recoverable receipt could not be persisted; operator reconciliation is required");
    }
    logger.info?.(JSON.stringify({ event: "payment_settled", requestId, operation: key.slice(0, 12), network: receipt.network, transaction: receipt.transaction }));
    return {
      ok: true,
      status,
      artifact: operation.artifact,
      payer: receipt.payer,
      transaction: receipt.transaction,
      responseHeaders: receiptHeaders(receipt),
    };
  }

  async function reconcileSettlement(key, operation, requestId) {
    const transaction = operation.settlement?.transaction;
    if (!transaction || typeof activeFacilitator?.getSettleStatus !== "function") return pendingSettlement(requestId);

    for (let attempt = 0; attempt < settlementPollAttempts; attempt += 1) {
      let result;
      try {
        result = await withTimeout(activeFacilitator.getSettleStatus(transaction));
      } catch (cause) {
        logger.error?.(JSON.stringify({ event: "payment_settlement_status_unavailable", requestId, operation: key.slice(0, 12), errorType: cause?.name || "Error" }));
        if (attempt + 1 < settlementPollAttempts && settlementPollIntervalMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, settlementPollIntervalMs));
        }
        continue;
      }

      const status = typeof result?.status === "string" ? result.status.toLowerCase() : "unknown";
      const settlement = sanitizedSettlement(result, operation.settlement);
      if (result?.success !== true) return recordSettlementFailure(key, operation, requestId, settlement);
      if (status === "success") return recordSettlementSuccess(key, operation, requestId, settlement, "recovered");
      if (status === "failed") return recordSettlementFailure(key, operation, requestId, settlement);
      let updated;
      try {
        updated = await operationStore.update(key, { settlement });
      } catch (cause) {
        logger.error?.(JSON.stringify({ event: "payment_settlement_state_persistence_failed", requestId, operation: key.slice(0, 12), errorType: cause?.name || "Error" }));
        return failure(500, requestId, "payment_settlement_state_persistence_failed", "Settlement reconciliation state could not be persisted; operator reconciliation is required");
      }
      if (!updated) {
        logger.error?.(JSON.stringify({ event: "payment_settlement_state_persistence_failed", requestId, operation: key.slice(0, 12) }));
        return failure(500, requestId, "payment_settlement_state_persistence_failed", "Settlement reconciliation state could not be persisted; operator reconciliation is required");
      }
      if (attempt + 1 < settlementPollAttempts && settlementPollIntervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, settlementPollIntervalMs));
      }
    }
    return pendingSettlement(requestId);
  }

  async function resolveExisting(key, existing, requestId) {
    if (existing.state === "settled") {
      logger.info?.(JSON.stringify({ event: "payment_result_recovered", requestId, operation: key.slice(0, 12), transaction: existing.receipt.transaction }));
      return {
        ok: true,
        status: "recovered",
        artifact: existing.artifact,
        payer: existing.receipt.payer,
        transaction: existing.receipt.transaction,
        responseHeaders: receiptHeaders(existing.receipt),
      };
    }
    if (existing.state === "settling") return reconcileSettlement(key, existing, requestId);
    if (existing.state === "failed") return failedSettlement(requestId);
    return failure(409, requestId, "payment_in_progress", "This payment authorization is already being processed", {}, { retryable: true });
  }

  async function verify({ headers = {}, resourceUrl, description, amountAtomic, requestId, requestFingerprint }) {
    if (!configured) {
      logger.error?.(JSON.stringify({ event: "payment_gate_not_configured", problems }));
      return failure(503, requestId, "payments_not_configured", "Paid access is not configured on this deployment");
    }
    if (typeof requestFingerprint !== "string" || !/^[0-9a-f]{64}$/.test(requestFingerprint)) {
      return failure(500, requestId, "invalid_payment_binding", "The paid request could not be bound safely");
    }

    const requirements = paymentRequirements(amountAtomic, requestFingerprint);
    const challenge = (error, invalidReason) => challengeResponse({
      resourceUrl, description, amountAtomic, requestId, requestFingerprint, error, invalidReason,
    });
    const { payload, proofDigest, error } = extractPaymentPayload(headers);
    if (!payload) return { ok: false, response: error ? challenge(undefined, error) : challenge() };
    if (!matchesRequirements(payload, requirements)) {
      return { ok: false, response: challenge("Payment does not match the required terms", "payment_requirements_mismatch") };
    }
    if (!matchesRequestBinding(payload, requestFingerprint)) {
      return { ok: false, response: challenge("Payment does not match the requested report", "payment_request_binding_mismatch") };
    }

    const key = operationKey(payload, requirements);
    const existing = await operationStore.get(key);
    if (existing) {
      // Recovery is bearer access to a paid artifact: require the exact proof
      // that the facilitator verified, not merely public payer/nonce fields.
      if (existing.proofDigest !== proofDigest) {
        return failure(409, requestId, "authorization_proof_mismatch", "This payment authorization does not match the stored operation");
      }
      if (existing.requestFingerprint !== requestFingerprint) {
        return failure(409, requestId, "authorization_request_mismatch", "This payment authorization is already bound to a different request");
      }
      return resolveExisting(key, existing, requestId);
    }

    let verification;
    try {
      verification = await callFacilitator("verify", payload, requirements);
    } catch (cause) {
      logger.error?.(JSON.stringify({ event: "payment_facilitator_unreachable", stage: "verify", requestId, errorType: cause?.name || "Error" }));
      return failure(502, requestId, "facilitator_unavailable", "Payment verification service is unavailable");
    }
    if (!verification || verification.isValid !== true) {
      const reason = typeof verification?.invalidReason === "string" ? verification.invalidReason : "verification_failed";
      return { ok: false, response: challenge("Payment verification failed", reason) };
    }

    const operation = {
      state: "verified",
      requestFingerprint,
      proofDigest,
      payload,
      requirements,
      resourceUrl,
      description,
      payer: verification.payer || payload.payload.authorization.from,
      artifact: null,
      receipt: null,
    };
    if (!await operationStore.create(key, operation)) {
      const concurrent = await operationStore.get(key);
      if (concurrent) return failure(409, requestId, "payment_in_progress", "This payment authorization is already being processed", {}, { retryable: true });
      return failure(503, requestId, "payment_state_capacity_reached", "Payment recovery storage is at capacity; no settlement was attempted");
    }
    return { ok: true, status: "verified", context: { key, requestFingerprint } };
  }

  async function recover({ headers = {}, amountAtomic, requestId, requestFingerprint }) {
    if (!configured) return null;
    const { payload, proofDigest } = extractPaymentPayload(headers);
    if (!payload) return null;
    const requirements = paymentRequirements(amountAtomic, requestFingerprint);
    if (!matchesRequirements(payload, requirements)) return null;
    const key = operationKey(payload, requirements);
    const existing = await operationStore.get(key);
    if (!existing) return null;
    if (existing.proofDigest !== proofDigest) {
      return failure(409, requestId, "authorization_proof_mismatch", "This payment authorization does not match the stored operation");
    }
    if (!matchesRequestBinding(payload, requestFingerprint) || existing.requestFingerprint !== requestFingerprint) {
      return failure(409, requestId, "authorization_request_mismatch", "This payment authorization is already bound to a different request");
    }
    return resolveExisting(key, existing, requestId);
  }

  async function abandon(context) {
    const operation = await operationStore.get(context?.key);
    if (operation?.state === "verified" && operation.requestFingerprint === context.requestFingerprint) {
      await operationStore.delete(context.key);
    }
  }

  async function settle({ context, artifact, requestId }) {
    const operation = await operationStore.get(context?.key);
    if (!operation || operation.requestFingerprint !== context?.requestFingerprint) {
      return failure(409, requestId, "payment_context_invalid", "Payment verification context is missing or expired");
    }
    if (operation.state === "settled") {
      return {
        ok: true,
        status: "recovered",
        artifact: operation.artifact,
        payer: operation.receipt.payer,
        transaction: operation.receipt.transaction,
        responseHeaders: receiptHeaders(operation.receipt),
      };
    }
    if (operation.state !== "verified") {
      return failure(409, requestId, "payment_in_progress", "This payment authorization is already being processed", {}, { retryable: true });
    }

    // Atomically acquire settlement ownership and persist the complete artifact.
    // Exactly one caller may transition verified -> settling.
    const persisted = await operationStore.transition(context.key, "verified", { state: "settling", artifact });
    if (!persisted) {
      const current = await operationStore.get(context.key);
      if (current?.state === "settled") {
        return {
          ok: true,
          status: "recovered",
          artifact: current.artifact,
          payer: current.receipt.payer,
          transaction: current.receipt.transaction,
          responseHeaders: receiptHeaders(current.receipt),
        };
      }
      if (current?.state === "settling") return pendingSettlement(requestId);
      return failure(503, requestId, "payment_state_unavailable", "Payment state could not be persisted; no settlement was attempted");
    }
    let settlement;
    try {
      settlement = await callFacilitator("settle", operation.payload, operation.requirements);
    } catch (cause) {
      // The outcome may be ambiguous; retain settling state and artifact. Never
      // blindly retry a potentially consumed EIP-3009 authorization.
      logger.error?.(JSON.stringify({ event: "payment_settlement_unknown", requestId, operation: context.key.slice(0, 12), errorType: cause?.name || "Error" }));
      return failure(502, requestId, "settlement_outcome_unknown", "Payment settlement outcome is unknown and requires reconciliation", {}, { retryable: true });
    }
    const status = typeof settlement?.status === "string" ? settlement.status.toLowerCase() : null;
    if (settlement?.success === true && (status === "success" || status === null)) {
      return recordSettlementSuccess(context.key, persisted, requestId, sanitizedSettlement(settlement), "settled");
    }

    const transaction = settlementTransaction(settlement);
    if (status === "pending" || (status === "timeout" && transaction)) {
      const sanitized = sanitizedSettlement(settlement);
      const stored = await operationStore.update(context.key, { settlement: sanitized });
      if (!stored) {
        logger.error?.(JSON.stringify({ event: "payment_settlement_state_persistence_failed", requestId, operation: context.key.slice(0, 12), facilitatorStatus: status }));
        return failure(500, requestId, "payment_settlement_state_persistence_failed", "Settlement started but its reconciliation state could not be persisted; operator reconciliation is required");
      }
      if (status === "timeout") return reconcileSettlement(context.key, stored, requestId);
      return pendingSettlement(requestId);
    }

    if (settlement?.success === false && status !== "timeout" && !transaction) {
      return recordSettlementFailure(context.key, persisted, requestId, sanitizedSettlement(settlement, { status: "failed" }));
    }

    // A thrown call or malformed timeout without a transaction hash is
    // ambiguous. Preserve the settling state and never resubmit authorization.
    logger.error?.(JSON.stringify({ event: "payment_settlement_unconfirmed", requestId, operation: context.key.slice(0, 12), facilitatorStatus: status || "unconfirmed" }));
    return failure(502, requestId, "settlement_outcome_unknown", "Payment settlement was not confirmed and requires reconciliation", {}, { retryable: true });
  }

  return {
    configured,
    network,
    assetName,
    assetDecimals,
    storeDurability: operationStore?.durability || "custom",
    facilitatorMode: activeFacilitator ? "okx_sdk" : fetchImpl ? "custom_transport" : "unavailable",
    supportConfigured,
    requirements: configured ? paymentRequirements : null,
    getSupported,
    checkSupport,
    recover,
    verify,
    settle,
    abandon,
  };
}

function integerFromEnv(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && !Number.isNaN(parsed) ? parsed : fallback;
}

export function paymentGateFromEnv(env = {}, deps = {}) {
  return createPaymentGate({
    enabled: env.X402_ENABLED === "true",
    payTo: env.X402_PAYTO_ADDRESS || null,
    network: env.X402_NETWORK || X402_DEFAULTS.network,
    asset: env.X402_ASSET_ADDRESS || null,
    assetName: env.X402_ASSET_NAME || X402_DEFAULTS.assetName,
    assetDecimals: integerFromEnv(env.X402_ASSET_DECIMALS, X402_DEFAULTS.assetDecimals),
    facilitatorUrl: env.X402_FACILITATOR_URL || X402_DEFAULTS.facilitatorUrl,
    facilitatorApiKey: env.OKX_API_KEY || null,
    facilitatorSecretKey: env.OKX_SECRET_KEY || null,
    facilitatorPassphrase: env.OKX_API_PASSPHRASE || null,
    maxTimeoutSeconds: integerFromEnv(env.X402_MAX_TIMEOUT_SECONDS, X402_DEFAULTS.maxTimeoutSeconds),
    settlementPollAttempts: integerFromEnv(env.X402_SETTLEMENT_POLL_ATTEMPTS, X402_DEFAULTS.settlementPollAttempts),
    settlementPollIntervalMs: integerFromEnv(env.X402_SETTLEMENT_POLL_INTERVAL_MS, X402_DEFAULTS.settlementPollIntervalMs),
    ...deps,
  });
}
