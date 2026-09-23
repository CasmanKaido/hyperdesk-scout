import { ValidationError } from "./service.js";

/**
 * x402 v2 seller gate (OKX Agent Payments Protocol compatible).
 *
 * Unpaid requests receive HTTP 402 with a base64 PAYMENT-REQUIRED header whose
 * decoded JSON matches the x402 v2 PaymentRequired schema. Paid requests carry
 * a base64 PAYMENT-SIGNATURE header (PaymentPayload) which is verified and
 * settled through the configured facilitator before the resource is released.
 * Successful responses carry a base64 PAYMENT-RESPONSE settlement receipt.
 *
 * The gate fails closed: when disabled or misconfigured the paid route is
 * unavailable (503) rather than free, and facilitator outages never grant
 * access. No payment credentials exist server-side; settlement is delegated
 * to the facilitator and replay protection comes from EIP-3009 nonces.
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

export const X402_DEFAULTS = {
  network: "eip155:1952", // X Layer testnet
  assetName: "USD₮0",
  assetDecimals: 6,
  maxTimeoutSeconds: 300,
  timeoutMs: 10000,
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

function validAmount(value) {
  return typeof value === "string" && ATOMIC_AMOUNT_PATTERN.test(value) && value !== "0";
}

export function createPaymentGate({
  enabled = false,
  payTo = null,
  network = X402_DEFAULTS.network,
  asset = null,
  assetName = X402_DEFAULTS.assetName,
  assetDecimals = X402_DEFAULTS.assetDecimals,
  facilitatorUrl = null,
  maxTimeoutSeconds = X402_DEFAULTS.maxTimeoutSeconds,
  fetchImpl = globalThis.fetch,
  logger = console,
  timeoutMs = X402_DEFAULTS.timeoutMs,
} = {}) {
  const problems = [];
  if (!enabled) problems.push("disabled");
  if (enabled && (typeof payTo !== "string" || !ADDRESS_PATTERN.test(payTo))) problems.push("invalid_payto_address");
  if (enabled && (typeof asset !== "string" || !ADDRESS_PATTERN.test(asset))) problems.push("invalid_asset_address");
  if (enabled && (typeof facilitatorUrl !== "string" || !/^https:\/\//.test(facilitatorUrl))) problems.push("invalid_facilitator_url");
  if (enabled && (!Number.isInteger(assetDecimals) || assetDecimals < 0 || assetDecimals > 36)) problems.push("invalid_asset_decimals");
  if (enabled && (!Number.isInteger(maxTimeoutSeconds) || maxTimeoutSeconds < 1)) problems.push("invalid_max_timeout");
  const configured = problems.length === 0;
  const facilitatorBase = configured ? facilitatorUrl.replace(/\/+$/, "") : null;

  function paymentRequirements(amountAtomic) {
    if (!validAmount(amountAtomic)) throw new PaymentError("Invalid price configuration", "invalid_price", 500);
    return {
      scheme: "exact",
      network,
      amount: amountAtomic,
      asset,
      payTo,
      maxTimeoutSeconds,
      extra: { name: assetName, version: "2" },
    };
  }

  function paymentRequiredPayload({ resourceUrl, description, amountAtomic, error }) {
    return {
      x402Version: 2,
      ...(error ? { error } : {}),
      resource: {
        url: resourceUrl,
        description,
        mimeType: "application/json",
      },
      accepts: [paymentRequirements(amountAtomic)],
      extensions: {},
    };
  }

  function challengeResponse({ resourceUrl, description, amountAtomic, requestId, error, invalidReason }) {
    const payload = paymentRequiredPayload({
      resourceUrl,
      description,
      amountAtomic,
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
    if (decoded.x402Version !== 2 || typeof decoded.accepted !== "object" || decoded.accepted === null
      || typeof decoded.payload !== "object" || decoded.payload === null) {
      return { payload: null, error: "payment_signature_invalid" };
    }
    return { payload: decoded, error: null };
  }

  function matchesRequirements(payload, requirements) {
    const accepted = payload.accepted;
    return accepted.scheme === requirements.scheme
      && accepted.network === requirements.network
      && typeof accepted.asset === "string" && accepted.asset.toLowerCase() === requirements.asset.toLowerCase()
      && typeof accepted.payTo === "string" && accepted.payTo.toLowerCase() === requirements.payTo.toLowerCase()
      && accepted.amount === requirements.amount;
  }

  async function postFacilitator(path, body) {
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
      return { status: response.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  async function charge({ headers = {}, resourceUrl, description, amountAtomic, requestId }) {
    if (!configured) {
      logger.error?.(JSON.stringify({ event: "payment_gate_not_configured", problems }));
      return {
        ok: false,
        response: {
          status: 503,
          headers: {},
          body: {
            request_id: requestId,
            error: "payments_not_configured",
            message: "Paid access is not configured on this deployment",
          },
        },
      };
    }

    const requirements = paymentRequirements(amountAtomic);
    const challenge = (error, invalidReason) => challengeResponse({
      resourceUrl, description, amountAtomic, requestId, error, invalidReason,
    });

    const { payload, error } = extractPaymentPayload(headers);
    if (!payload) {
      return { ok: false, response: error ? challenge(undefined, error) : challenge() };
    }
    if (!matchesRequirements(payload, requirements)) {
      return { ok: false, response: challenge("Payment does not match the required terms", "payment_requirements_mismatch") };
    }

    let verify;
    try {
      verify = await postFacilitator("/verify", { x402Version: 2, paymentPayload: payload, paymentRequirements: requirements });
    } catch (cause) {
      logger.error?.(JSON.stringify({ event: "payment_facilitator_unreachable", stage: "verify", requestId, message: cause?.message }));
      return {
        ok: false,
        response: {
          status: 502,
          headers: {},
          body: { request_id: requestId, error: "facilitator_unavailable", message: "Payment verification service is unavailable" },
        },
      };
    }
    if (verify.status !== 200 || !verify.data || verify.data.isValid !== true) {
      const reason = typeof verify.data?.invalidReason === "string" ? verify.data.invalidReason : "verification_failed";
      return { ok: false, response: challenge("Payment verification failed", reason) };
    }

    let settle;
    try {
      settle = await postFacilitator("/settle", { x402Version: 2, paymentPayload: payload, paymentRequirements: requirements });
    } catch (cause) {
      logger.error?.(JSON.stringify({ event: "payment_facilitator_unreachable", stage: "settle", requestId, message: cause?.message }));
      return {
        ok: false,
        response: {
          status: 502,
          headers: {},
          body: { request_id: requestId, error: "facilitator_unavailable", message: "Payment settlement service is unavailable" },
        },
      };
    }
    if (settle.status !== 200 || !settle.data || settle.data.success !== true) {
      const reason = typeof settle.data?.errorReason === "string" ? settle.data.errorReason : "settlement_failed";
      return { ok: false, response: challenge("Payment settlement failed", reason) };
    }

    const receipt = {
      success: true,
      transaction: settle.data.transaction,
      network: settle.data.network || network,
      payer: settle.data.payer || verify.data.payer || null,
    };
    logger.info?.(JSON.stringify({ event: "payment_settled", requestId, network: receipt.network, transaction: receipt.transaction }));
    return {
      ok: true,
      payer: receipt.payer,
      transaction: receipt.transaction,
      responseHeaders: { "payment-response": base64Encode(receipt) },
    };
  }

  return {
    configured,
    network,
    assetName,
    assetDecimals,
    requirements: configured ? paymentRequirements : null,
    charge,
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
    facilitatorUrl: env.X402_FACILITATOR_URL || null,
    maxTimeoutSeconds: integerFromEnv(env.X402_MAX_TIMEOUT_SECONDS, X402_DEFAULTS.maxTimeoutSeconds),
    ...deps,
  });
}

export function validatePaidSymbols(input) {
  if (!Array.isArray(input.symbols) || input.symbols.length < 1 || input.symbols.length > 5) {
    throw new ValidationError("symbols must contain between 1 and 5 items");
  }
}
