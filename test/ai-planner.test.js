import test from "node:test";
import assert from "node:assert/strict";
import {
  PlannerError,
  createAIPlanner,
  validatePlannerOutput,
  validatePlannerRequest,
} from "../src/ai-planner.js";

const providerOutput = {
  summary: "Plan a market-neutral funding income review.",
  objective: "market_neutral_income",
  symbols: ["btc", "ETH", "BTC"],
  risk_tolerance: "moderate",
  max_leverage: 2,
  max_notional_usd: 1000,
  min_funding_apr: 5,
  assumptions: ["  Hedge availability will be checked later.  "],
  missing_information: [],
};

function jsonResponse(body, { ok = true } = {}) {
  return { ok, json: async () => body };
}

function assertPlannerError(error, { status, code }) {
  assert.ok(error instanceof PlannerError);
  assert.equal(error.status, status);
  assert.equal(error.code, code);
  return true;
}

test("validates and trims planner requests", () => {
  assert.deepEqual(validatePlannerRequest({ message: "  Build a BTC funding plan  " }), {
    message: "Build a BTC funding plan",
  });

  for (const input of [null, {}, { message: "too short" }, { message: 42 }, {
    message: "Build a BTC funding plan",
    extra: true,
  }]) {
    assert.throws(
      () => validatePlannerRequest(input),
      (error) => assertPlannerError(error, { status: 400, code: "invalid_request" }),
    );
  }
});

test("normalizes valid planner output and rejects schema violations", () => {
  assert.deepEqual(validatePlannerOutput(providerOutput), {
    ...providerOutput,
    summary: providerOutput.summary,
    symbols: ["BTC", "ETH"],
    assumptions: ["Hedge availability will be checked later."],
  });

  assert.throws(
    () => validatePlannerOutput({ ...providerOutput, objective: "directional_trading" }),
    (error) => assertPlannerError(error, { status: 502, code: "invalid_ai_output" }),
  );
  assert.throws(
    () => validatePlannerOutput({ ...providerOutput, surprise: true }),
    /unknown field surprise/,
  );
  assert.throws(
    () => validatePlannerOutput({ ...providerOutput, assumptions: Array(9).fill("item") }),
    /assumptions/,
  );
});

test("uses Gemini and appends deterministic planner metadata", async () => {
  let captured;
  const planner = createAIPlanner({
    env: { GEMINI_API_KEY: "gemini-secret" },
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return jsonResponse({ output_text: JSON.stringify(providerOutput) });
    },
  });

  const result = await planner({ message: "Create a cautious BTC funding plan" });

  assert.equal(captured.url, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.equal(captured.options.headers["x-goog-api-key"], "gemini-secret");
  const requestBody = JSON.parse(captured.options.body);
  assert.equal(requestBody.model, "gemini-3.8-flash");
  assert.equal(requestBody.response_format.type, "text");
  assert.equal(requestBody.response_format.mime_type, "application/json");
  assert.equal(requestBody.response_format.schema.additionalProperties, false);
  assert.deepEqual(requestBody.response_format.schema.properties.objective.enum, ["market_neutral_income"]);
  assert.doesNotMatch(
    JSON.stringify(requestBody.response_format.schema),
    /"const"|"pattern"|"uniqueItems"|"exclusiveMinimum"|"minLength"/,
  );
  assert.match(requestBody.input, /JSON only/);
  assert.match(requestBody.input, /BTC, ETH, SOL/);
  assert.match(requestBody.input, /Do not calculate or invent market data/);

  assert.equal(result.provider, "gemini");
  assert.equal(result.model, "gemini-3.8-flash");
  assert.deepEqual(result.symbols, ["BTC", "ETH"]);
  assert.equal(result.approval_required, true);
  assert.equal(result.execution_included, false);
  assert.deepEqual(result.specialist_plan.map((step) => step.specialists), [
    ["funding", "liquidity"],
    ["risk"],
    ["synthesis"],
  ]);
});

test("falls back from a failed Gemini request to Groq", async () => {
  const calls = [];
  const planner = createAIPlanner({
    env: {
      AI_PROVIDER_ORDER: "gemini,groq",
      GEMINI_API_KEY: "gemini-secret",
      GROQ_API_KEY: "groq-secret",
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) return jsonResponse({ error: "unavailable" }, { ok: false });
      return jsonResponse({ choices: [{ message: { content: JSON.stringify(providerOutput) } }] });
    },
  });

  const result = await planner({ message: "Plan market-neutral income for ETH" });

  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(calls[1].options.headers.authorization, "Bearer groq-secret");
  const groqBody = JSON.parse(calls[1].options.body);
  assert.equal(groqBody.model, "openai/gpt-oss-20b");
  assert.equal(groqBody.response_format.type, "json_schema");
  assert.equal(groqBody.response_format.json_schema.strict, true);
  assert.equal(result.provider, "groq");
});

test("returns 503 without keys and does not call fetch", async () => {
  let called = false;
  const planner = createAIPlanner({
    env: {},
    fetchImpl: async () => { called = true; },
  });

  await assert.rejects(
    planner({ message: "Create a market-neutral plan" }),
    (error) => assertPlannerError(error, { status: 503, code: "ai_unavailable" }),
  );
  assert.equal(called, false);
});

test("returns one opaque 502 only after all configured providers fail", async () => {
  let calls = 0;
  const warnings = [];
  const planner = createAIPlanner({
    env: { GEMINI_API_KEY: "do-not-leak", GROQ_API_KEY: "also-secret" },
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ output_text: "not json: do-not-leak" });
      throw new Error("network included also-secret and raw response");
    },
    logger: { warn(message) { warnings.push(message); } },
  });

  await assert.rejects(
    planner({ message: "Create a market-neutral plan" }),
    (error) => {
      assertPlannerError(error, { status: 502, code: "ai_provider_unavailable" });
      assert.doesNotMatch(error.message, /do-not-leak|also-secret|raw response/);
      return true;
    },
  );
  assert.equal(calls, 2);
  assert.equal(warnings.length, 2);
  assert.doesNotMatch(warnings.join("\n"), /do-not-leak|also-secret|raw response/);
  assert.match(warnings[0], /invalid_json/);
});

test("times out a provider request and falls back", async () => {
  const planner = createAIPlanner({
    env: { GEMINI_API_KEY: "gemini-secret", GROQ_API_KEY: "groq-secret" },
    timeoutMs: 10,
    fetchImpl: async (url, { signal }) => {
      if (url.includes("generativelanguage")) {
        return new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
            once: true,
          });
        });
      }
      return jsonResponse({ choices: [{ message: { content: JSON.stringify(providerOutput) } }] });
    },
  });

  const result = await planner({ message: "Create a market-neutral plan" });
  assert.equal(result.provider, "groq");
});
