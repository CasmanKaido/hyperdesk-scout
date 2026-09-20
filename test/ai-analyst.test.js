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

test("renders numeric funding and book findings deterministically", async () => {
  const ledger = [
    { id: "BTC:funding_history_72h", kind: "funding_history", symbol: "BTC", data: { status: "available", observed_samples: 72, expected_samples: 72, positive_share_fraction: 1, sign_reversals: 0, retrospective_simple_apr_percent: 10.124954 } },
    { id: "BTC:order_book", kind: "order_book", symbol: "BTC", data: { status: "available", spread_bps: 0.123077, bid_visible_notional_within_10bps: 8019856.7, ask_visible_notional_within_10bps: 2462143.2 } },
  ];
  const model = { ...output, answer: "Funding persisted across the 72-hour window, while visible liquidity remains only a snapshot.", findings: [{ text: "Model arithmetic 1.219 bps should not be displayed.", evidence_ids: ["BTC:funding_history_72h"] }] };
  const analyst = createAIAnalyst({ env: { GROQ_API_KEY: "secret" }, fetchImpl: async () => response({ choices: [{ message: { content: JSON.stringify(model) } }] }) });
  const result = await analyst({ question: "What matters?", evidence: ledger });
  assert.equal(result.status, "completed");
  assert.match(result.findings[0].text, /72\/72/);
  assert.match(result.findings[0].text, /10.12% retrospective/);
  assert.match(result.findings[1].text, /0.123 bps/);
  assert.doesNotMatch(JSON.stringify(result.findings), /1\.219/);
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

test("rejects prescriptive claims derived from visible-book snapshots", async () => {
  const unsafe = { ...output, answer: "This is best for traders because it lowers execution cost." };
  const analyst = createAIAnalyst({ env: { GROQ_API_KEY: "secret" }, logger: { warn() {} }, fetchImpl: async () => response({ choices: [{ message: { content: JSON.stringify(unsafe) } }] }) });
  assert.deepEqual(await analyst({ question: "What matters?", evidence }), { status: "unavailable", reason: "providers_failed" });
});

test("removes unsafe inference sentences and unavailable follow-up suggestions", async () => {
  const mixed = { ...output, answer: "Funding persisted in the supplied history. The spread lowers cost for traders.", findings: [...output.findings, { text: "This is best for traders.", evidence_ids: ["BTC:snapshot"] }], next_questions: ["What is the full depth?", "Compare funding with ETH?"] };
  const analyst = createAIAnalyst({ env: { GROQ_API_KEY: "secret" }, fetchImpl: async () => response({ choices: [{ message: { content: JSON.stringify(mixed) } }] }) });
  const result = await analyst({ question: "What matters?", evidence });
  assert.equal(result.status, "completed");
  assert.equal(result.answer, "Funding persisted in the supplied history.");
  assert.equal(result.findings.length, 1);
  assert.deepEqual(result.next_questions, []);
});

test("returns safe unavailable states for absent keys and failed providers", async () => {
  assert.deepEqual(await createAIAnalyst({ env: {} })({ question: "What?", evidence }), { status: "unavailable", reason: "not_configured" });
  const logs = [];
  const result = await createAIAnalyst({ env: { GROQ_API_KEY: "secret" }, logger: { warn: (line) => logs.push(line) }, fetchImpl: async () => response({}, false, 429) })({ question: "What?", evidence });
  assert.deepEqual(result, { status: "unavailable", reason: "providers_failed" });
  assert.doesNotMatch(logs.join(""), /secret/);
});

test("builds stable server evidence IDs", () => {
  const ledger = buildEvidenceLedger({ evidence: { source: "Hyperliquid" }, markets: [{ symbol: "BTC", status: "available", facts: { funding: { hourly_rate: 0.00002 } }, calculations: { funding: { annualized_simple_percent: 17.52 } }, notices: [], research: { funding_history: { status: "available", hourly_mean_rate: 0.00001, latest_rate: 0.00002 }, order_book: { status: "available" } } }] });
  assert.deepEqual(ledger.map((item) => item.id), ["source:overview", "BTC:snapshot", "BTC:funding_history_72h", "BTC:order_book"]);
    assert.equal(ledger[1].data.funding.hourly_rate_decimal, 0.00002);
      assert.equal("hourly_rate" in ledger[1].data.funding, false);
      assert.equal(ledger[2].data.hourly_mean_rate_percent, 0.001);
    assert.equal(ledger[2].data.latest_rate_percent, 0.002);
    assert.equal("hourly_mean_rate" in ledger[2].data, false);
    assert.match(ledger[3].data.measurement_scope, /single visible snapshot/);
});
