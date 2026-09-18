const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 15_000;
const PROVIDERS = new Set(["gemini", "groq"]);
const RISK_TOLERANCES = new Set(["conservative", "moderate", "aggressive"]);
const SYMBOL_PATTERN = /^[A-Za-z0-9:_-]{1,30}$/;

const OUTPUT_FIELDS = [
  "summary",
  "objective",
  "symbols",
  "risk_tolerance",
  "max_leverage",
  "max_notional_usd",
  "min_funding_apr",
  "assumptions",
  "missing_information",
];

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: OUTPUT_FIELDS,
  properties: {
    summary: { type: "string", minLength: 1 },
    objective: { type: "string", const: "market_neutral_income" },
    symbols: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      uniqueItems: true,
      items: { type: "string", pattern: "^[A-Za-z0-9:_-]{1,30}$" },
    },
    risk_tolerance: { type: "string", enum: ["conservative", "moderate", "aggressive"] },
    max_leverage: { type: "number", minimum: 1, maximum: 10 },
    max_notional_usd: { type: "number", exclusiveMinimum: 0, maximum: 1_000_000 },
    min_funding_apr: { type: "number", minimum: 0, maximum: 10_000 },
    assumptions: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 1 },
    },
    missing_information: {
      type: "array",
      maxItems: 5,
      items: { type: "string", minLength: 1 },
    },
  },
};

const SPECIALIST_PLAN = Object.freeze([
  Object.freeze({ stage: 1, specialists: Object.freeze(["funding", "liquidity"]), mode: "parallel" }),
  Object.freeze({ stage: 2, specialists: Object.freeze(["risk"]), mode: "depends_on_stage_1" }),
  Object.freeze({ stage: 3, specialists: Object.freeze(["synthesis"]), mode: "deterministic" }),
]);

const SYSTEM_PROMPT = `You are the provider-neutral natural-language planner for LiquidFlux.
Return JSON only and exactly match the supplied schema. The only supported objective is market_neutral_income.
Extract planning constraints from the user's message. For omitted constraints use symbols BTC, ETH, SOL; risk_tolerance moderate; max_leverage 2; max_notional_usd 1000; min_funding_apr 5.
Do not calculate or invent market data, prices, returns, yields, opportunities, or other financial claims. This is planning only and never execution.
Put reasonable interpretation choices in assumptions. Put information that is genuinely needed but unavailable in missing_information; do not omit required JSON fields. Keep both arrays concise.`;

export class PlannerError extends Error {
  constructor(message, { status = 500, code = "ai_planner_error" } = {}) {
    super(message);
    this.name = "PlannerError";
    this.status = status;
    this.code = code;
  }
}

function invalid(message) {
  throw new PlannerError(message, { status: 400, code: "invalid_request" });
}

export function validatePlannerRequest(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    invalid("Request body must be a JSON object");
  }
  const fields = Object.keys(input);
  if (fields.length !== 1 || fields[0] !== "message") {
    invalid("Request body must contain only message");
  }
  if (typeof input.message !== "string") invalid("message must be a string");
  const message = input.message.trim();
  if (message.length < 10 || message.length > 1000) {
    invalid("message must be between 10 and 1000 characters after trimming");
  }
  return { message };
}

function outputInvalid(message) {
  throw new PlannerError(`Invalid AI planner output: ${message}`, {
    status: 502,
    code: "invalid_ai_output",
  });
}

function normalizeText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    outputInvalid(`${field} must contain a non-empty string`);
  }
  return value.trim();
}

function normalizeTextArray(value, field, maxItems) {
  if (!Array.isArray(value) || value.length > maxItems) {
    outputInvalid(`${field} must be an array with no more than ${maxItems} items`);
  }
  return value.map((item) => normalizeText(item, field));
}

function boundedNumber(value, field, minimum, maximum, exclusiveMinimum = false) {
  const belowMinimum = exclusiveMinimum ? value <= minimum : value < minimum;
  if (typeof value !== "number" || !Number.isFinite(value) || belowMinimum || value > maximum) {
    outputInvalid(`${field} is outside its allowed range`);
  }
  return value;
}

export function validatePlannerOutput(output) {
  if (output === null || typeof output !== "object" || Array.isArray(output)) {
    outputInvalid("response must be a JSON object");
  }
  const keys = Object.keys(output);
  const unknown = keys.find((key) => !OUTPUT_FIELDS.includes(key));
  const missing = OUTPUT_FIELDS.find((key) => !Object.hasOwn(output, key));
  if (unknown) outputInvalid(`unknown field ${unknown}`);
  if (missing) outputInvalid(`missing field ${missing}`);

  if (output.objective !== "market_neutral_income") {
    outputInvalid("objective must be market_neutral_income");
  }
  if (!Array.isArray(output.symbols) || output.symbols.length < 1 || output.symbols.length > 20) {
    outputInvalid("symbols must contain between 1 and 20 items");
  }
  const symbols = [];
  const seen = new Set();
  for (const symbol of output.symbols) {
    if (typeof symbol !== "string" || !SYMBOL_PATTERN.test(symbol)) {
      outputInvalid("symbols contains an invalid market name");
    }
    const normalized = symbol.toUpperCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      symbols.push(normalized);
    }
  }
  if (!RISK_TOLERANCES.has(output.risk_tolerance)) {
    outputInvalid("risk_tolerance is invalid");
  }

  return {
    summary: normalizeText(output.summary, "summary"),
    objective: output.objective,
    symbols,
    risk_tolerance: output.risk_tolerance,
    max_leverage: boundedNumber(output.max_leverage, "max_leverage", 1, 10),
    max_notional_usd: boundedNumber(output.max_notional_usd, "max_notional_usd", 0, 1_000_000, true),
    min_funding_apr: boundedNumber(output.min_funding_apr, "min_funding_apr", 0, 10_000),
    assumptions: normalizeTextArray(output.assumptions, "assumptions", 8),
    missing_information: normalizeTextArray(output.missing_information, "missing_information", 5),
  };
}

function configuredProviders(env) {
  const order = (env.AI_PROVIDER_ORDER || "gemini,groq")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider, index, values) => PROVIDERS.has(provider) && values.indexOf(provider) === index);

  return order.flatMap((provider) => {
    const apiKey = provider === "gemini" ? env.GEMINI_API_KEY : env.GROQ_API_KEY;
    if (typeof apiKey !== "string" || apiKey.trim() === "") return [];
    return [{
      provider,
      apiKey: apiKey.trim(),
      model: provider === "gemini"
        ? (env.GEMINI_MODEL || "gemini-3.8-flash")
        : (env.GROQ_MODEL || "openai/gpt-oss-20b"),
    }];
  });
}

function providerRequest(config, message, signal) {
  if (config.provider === "gemini") {
    return {
      url: GEMINI_URL,
      options: {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
        body: JSON.stringify({
          model: config.model,
          input: `${SYSTEM_PROMPT}\n\nUser message:\n${message}`,
          response_format: { type: "text", mime_type: "application/json", schema: OUTPUT_SCHEMA },
        }),
      },
    };
  }

  return {
    url: GROQ_URL,
    options: {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "liquidflux_plan", strict: true, schema: OUTPUT_SCHEMA },
        },
      }),
    },
  };
}

async function callProvider(config, message, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const request = providerRequest(config, message, controller.signal);
    const response = await fetchImpl(request.url, request.options);
    if (!response || response.ok !== true) throw new Error("Provider request failed");
    const body = await response.json();
    const content = config.provider === "gemini"
      ? body?.output_text
      : body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Provider response was incomplete");
    return validatePlannerOutput(JSON.parse(content));
  } finally {
    clearTimeout(timer);
  }
}

function cloneSpecialistPlan() {
  return SPECIALIST_PLAN.map((step) => ({ ...step, specialists: [...step.specialists] }));
}

export function createAIPlanner({
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = Number(env.AI_PLANNER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError("timeoutMs must be positive");

  return async function plan(input) {
    const { message } = validatePlannerRequest(input);
    const providers = configuredProviders(env);
    if (providers.length === 0) {
      throw new PlannerError("AI planning is not configured", { status: 503, code: "ai_unavailable" });
    }

    for (const config of providers) {
      try {
        const planOutput = await callProvider(config, message, fetchImpl, timeoutMs);
        return {
          ...planOutput,
          provider: config.provider,
          model: config.model,
          specialist_plan: cloneSpecialistPlan(),
          approval_required: true,
          execution_included: false,
        };
      } catch {
        // Provider details are deliberately suppressed; the next configured provider may recover.
      }
    }

    throw new PlannerError("All configured AI planning providers failed", {
      status: 502,
      code: "ai_provider_unavailable",
    });
  };
}
