import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidenceLedger, createAIAnalyst } from "../src/ai-analyst.js";

const evidence = [{ id: "BTC:snapshot", kind: "market_snapshot", symbol: "BTC", data: { funding: 1 } }];
const output = { answer: "BTC funding is positive in the supplied snapshot, but persistence is unknown.", findings: [{ text: "The snapshot reports positive funding.", evidence_ids: ["BTC:snapshot"] }], caveats: ["No history was supplied."], next_questions: ["Fetch funding history?"] };
const response = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

test("returns a citation-validated Groq analysis", async () => {
  let body;
  const analyst = createAIAnalyst({ env: { GROQ_API_KEY: "secret" }, fetchImpl: async (_url, options) => { body = JSON.parse(options.body); return response({ choices: [{ message: { content: JSON.stringify(output) } }] }); } });
  const result = await analyst({ question: "What matters?", evidence });
  assert.equal(result.status, "completed");
  assert.equal(result.grounding, "references_validated_not_fact_verified");
  assert.deepEqual(result.findings[0].evidence_ids, ["BTC:snapshot"]);
  assert.match(body.messages[0].content, /what could invalidate/);
});

test("uses the official Gemini generateContent JSON contract", async () => {
  let call;
  const analyst = createAIAnalyst({ env: { GEMINI_API_KEY: "secret" }, fetchImpl: async (url, options) => { call = { url, body: JSON.parse(options.body) }; return response({ candidates: [{ content: { parts: [{ thought: true, text: "hidden" }, { text: JSON.stringify(output) }] } }] }); } });
  const result = await analyst({ question: "What matters?", evidence });
  assert.equal(result.status, "completed");
  assert.match(call.url, /models\/gemini-3\.8-flash:generateContent$/);
  assert.equal(call.body.generationConfig.responseMimeType, "application/json");
  assert.equal(call.body.contents[0].role, "user");
});

test("rejects invented citation IDs and falls back", async () => {
  let calls = 0;
  const bad = { ...output, findings: [{ text: "Invented", evidence_ids: ["ETH:missing"] }] };
  const analyst = createAIAnalyst({ env: { GEMINI_API_KEY: "a", GROQ_API_KEY: "b" }, logger: { warn() {} }, fetchImpl: async (_url, options) => { calls++; return options.headers.authorization ? response({ choices: [{ message: { content: JSON.stringify(output) } }] }) : response({ candidates: [{ content: { parts: [{ text: JSON.stringify(bad) }] } }] }); } });
  const result = await analyst({ question: "What matters?", evidence });
  assert.equal(calls, 2);
  assert.equal(result.provider, "groq");
});

test("returns safe unavailable states for absent keys and failed providers", async () => {
  assert.deepEqual(await createAIAnalyst({ env: {} })({ question: "What?", evidence }), { status: "unavailable", reason: "not_configured" });
  const logs = [];
  const result = await createAIAnalyst({ env: { GROQ_API_KEY: "secret" }, logger: { warn: (line) => logs.push(line) }, fetchImpl: async () => response({}, false, 429) })({ question: "What?", evidence });
  assert.deepEqual(result, { status: "unavailable", reason: "providers_failed" });
  assert.doesNotMatch(logs.join(""), /secret/);
});

test("builds stable server evidence IDs", () => {
  const ledger = buildEvidenceLedger({ evidence: { source: "Hyperliquid" }, markets: [{ symbol: "BTC", status: "available", facts: {}, calculations: {}, notices: [], research: { funding_history: { status: "available" }, order_book: { status: "available" } } }] });
  assert.deepEqual(ledger.map((item) => item.id), ["source:overview", "BTC:snapshot", "BTC:funding_history_72h", "BTC:order_book"]);
});
