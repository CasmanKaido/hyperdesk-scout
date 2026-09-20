const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_EVIDENCE_BYTES = 24_000;

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["answer", "findings", "caveats", "next_questions"],
  properties: {
    answer: { type: "string" },
    findings: {
      type: "array", maxItems: 8,
      items: {
        type: "object", additionalProperties: false,
        required: ["text", "evidence_ids"],
        properties: {
          text: { type: "string" },
          evidence_ids: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
        },
      },
    },
    caveats: { type: "array", maxItems: 8, items: { type: "string" } },
    next_questions: { type: "array", maxItems: 4, items: { type: "string" } },
  },
};
const PROMPT = `You are LiquidFlux's evidence analyst. Answer the user's market research question from the supplied server-built evidence ledger only.
Lead with a qualitative conclusion, then explain the strongest supporting evidence, contradictions, what could invalidate the conclusion, and what remains unknown. Do not put numeric values or perform unit conversions in the answer; LiquidFlux renders numeric findings deterministically. Compare markets when more than one is supplied. Distinguish a current snapshot from 72-hour history. Historical APR is retrospective simple annualization, never a forecast. Visible order-book notional is one bounded snapshot, not an executable quote, fill guarantee, durable liquidity measure, recommendation, or basis for saying what is decisive for traders. Describe asymmetry without calling either market superior. Mark/oracle deviation is not spot/perp basis. Venue leverage limits are not recommendations. Rate field names in the ledger include their units; never rename decimal fractions as ppm. Describe historical funding as observed persistence, not stable future carry.
Every finding must cite one or more exact evidence IDs. Use exact numbers only when present in those records. Never use the words trader, trade, position, best, superior, decisive, recommendation, execution cost, or say visible notional supports an order size. Do not invent correlations, costs, borrow availability, hedge availability, probabilities, confidence scores, forecasts, trades, execution advice, or unsupported units. Suggested next questions must be answerable using LiquidFlux's available snapshot, funding-history, order-book, or comparison evidence; do not suggest unavailable full-depth or future data. If evidence is missing, limited, stale, conflicting, or unavailable, say so prominently. Do not merely restate every metric; explain why the available evidence matters. Return JSON only matching the schema.`;

function cleanText(value, field, max = 2500) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`invalid_${field}`);
  return value.trim();
}
function canonicalFindings(evidence) {
  const findings = [];
  const number = (value, digits = 2) => Number.isFinite(value) ? String(Number(value.toFixed(digits))) : "unavailable";
  const money = (value) => Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "unavailable";
  for (const item of evidence) {
    const data = item.data || {};
    if (item.kind === "funding_history" && ["available", "limited"].includes(data.status)) {
      findings.push({ text: `${item.symbol}: ${data.observed_samples ?? "unknown"}/${data.expected_samples ?? "unknown"} hourly funding settlements observed; ${number(Number.isFinite(data.positive_share_fraction) ? data.positive_share_fraction * 100 : null, 1)}% positive; ${data.sign_reversals ?? "unknown"} adjacent sign reversals; ${number(data.retrospective_simple_apr_percent)}% retrospective simple APR.`, evidence_ids: [item.id] });
    }
    if (item.kind === "order_book" && ["available", "limited"].includes(data.status)) {
      findings.push({ text: `${item.symbol}: ${number(data.spread_bps, 3)} bps visible spread; ${money(data.bid_visible_notional_within_10bps)} bid and ${money(data.ask_visible_notional_within_10bps)} ask quote-currency notional visible within 10 bps of midpoint in this bounded snapshot.`, evidence_ids: [item.id] });
    }
  }
  return findings.slice(0, 8);
}

function validate(output, ids, evidence) {
  if (!output || typeof output !== "object" || Array.isArray(output)) throw new Error("invalid_output");
  const allowed = new Set(["answer", "findings", "caveats", "next_questions"]);
  if (Object.keys(output).some((key) => !allowed.has(key))) throw new Error("unknown_output_field");
  if (!Array.isArray(output.findings) || output.findings.length < 1 || output.findings.length > 8) throw new Error("invalid_findings");
  const findings = output.findings.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).some((key) => !["text", "evidence_ids"].includes(key))) throw new Error("invalid_finding");
    if (!Array.isArray(item.evidence_ids) || item.evidence_ids.length < 1 || item.evidence_ids.length > 8 || item.evidence_ids.some((id) => !ids.has(id))) throw new Error("invalid_citation");
    return { text: cleanText(item.text, "finding", 700), evidence_ids: [...new Set(item.evidence_ids)] };
  });
  const strings = (value, field, max) => {
    if (!Array.isArray(value) || value.length > max) throw new Error(`invalid_${field}`);
    return value.map((item) => cleanText(item, field, 500));
  };
  const rawAnswer = cleanText(output.answer, "answer");
  const caveats = strings(output.caveats, "caveats", 8);
  const prohibited = /\b(?:traders?|trades?|positions?|best|superior|decisive|recommend(?:ation|ed)?|costs?|supports? (?:a |an )?(?:larger|bigger) order)\b/i;
  const answer = rawAnswer.split(/(?<=[.!?])\s+/).filter((sentence) =>
    !prohibited.test(sentence) && !/(?:^|\s)(?!72(?:\s|-|‑|–|—)?(?:hours?|h)\b)\d+(?:[.,]\d+)?/i.test(sentence)).join(" ").trim();
  const deterministicFindings = canonicalFindings(evidence);
  const safeFindings = deterministicFindings.length ? deterministicFindings : findings.filter((item) => !prohibited.test(item.text) && !/\d/.test(item.text));
  if (!answer || safeFindings.length < 1) throw new Error("invalid_claim_scope");
  strings(output.next_questions, "next_questions", 4);
  // Follow-up prompts must come from an actual tool-capability registry, not model imagination.
  return { answer, findings: safeFindings, caveats, next_questions: [] };
}
function providers(env) {
  return (env.AI_PROVIDER_ORDER || "gemini,groq").split(",").map((x) => x.trim()).flatMap((provider) => {
    const key = provider === "gemini" ? env.GEMINI_API_KEY : provider === "groq" ? env.GROQ_API_KEY : null;
    if (!key) return [];
    return [{ provider, key, model: provider === "gemini" ? (env.GEMINI_MODEL || "gemini-3.8-flash") : (env.GROQ_MODEL || "openai/gpt-oss-20b") }];
  });
}
function request(config, input, signal) {
  const user = `QUESTION_JSON:\n${JSON.stringify(input.question)}\n\nSERVER_EVIDENCE_LEDGER_JSON:\n${JSON.stringify(input.evidence)}`;
  if (config.provider === "gemini") return { url: `${GEMINI_BASE_URL}/${encodeURIComponent(config.model)}:generateContent`, options: { method: "POST", signal, headers: { "content-type": "application/json", "x-goog-api-key": config.key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: PROMPT }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json", responseJsonSchema: SCHEMA, temperature: 0.2 } }) } };
  return { url: GROQ_URL, options: { method: "POST", signal, headers: { "content-type": "application/json", authorization: `Bearer ${config.key}` }, body: JSON.stringify({ model: config.model, messages: [{ role: "system", content: PROMPT }, { role: "user", content: user }], temperature: 0.2, response_format: { type: "json_schema", json_schema: { name: "liquidflux_analysis", strict: true, schema: SCHEMA } } }) } };
}
function reason(error) {
  if (error?.name === "AbortError") return "timeout";
  if (/^http_\d+$/.test(error?.message)) return error.message;
  if (error instanceof SyntaxError) return "invalid_json";
  return /^invalid_|^unknown_/.test(error?.message) ? error.message : "request_failed";
}
export function createAIAnalyst({ env = process.env, fetchImpl = globalThis.fetch, timeoutMs = Number(env.AI_ANALYST_TIMEOUT_MS || 15_000), logger = console } = {}) {
  return async function analyze({ question, evidence }) {
    if (typeof question !== "string" || !question.trim() || question.trim().length > 1000) return { status: "unavailable", reason: "invalid_question" };
    if (!Array.isArray(evidence) || evidence.length < 1 || evidence.length > 100) return { status: "unavailable", reason: "invalid_evidence" };
    let serialized;
    try { serialized = JSON.stringify(evidence); } catch { return { status: "unavailable", reason: "invalid_evidence" }; }
    if (Buffer.byteLength(serialized) > MAX_EVIDENCE_BYTES) return { status: "unavailable", reason: "evidence_too_large" };
    const ids = new Set();
    for (const item of evidence) {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !/^[a-z0-9:_-]{1,100}$/i.test(item.id) || ids.has(item.id)) return { status: "unavailable", reason: "invalid_evidence" };
      ids.add(item.id);
    }
    const configured = providers(env);
    if (!configured.length) return { status: "unavailable", reason: "not_configured" };
    for (const config of configured) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const call = request(config, { question: question.trim(), evidence }, controller.signal);
        const response = await fetchImpl(call.url, call.options);
        if (!response?.ok) throw new Error(`http_${response?.status || 0}`);
        const body = await response.json();
        const text = config.provider === "gemini" ? body?.candidates?.[0]?.content?.parts?.filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("") : body?.choices?.[0]?.message?.content;
        if (typeof text !== "string") throw new Error("invalid_response");
        return { status: "completed", ...validate(JSON.parse(text), ids, evidence), provider: config.provider, model: config.model, grounding: "references_validated_not_fact_verified" };
      } catch (error) {
        logger?.warn?.(JSON.stringify({ event: "ai_analyst_failed", provider: config.provider, model: config.model, reason: reason(error) }));
      } finally { clearTimeout(timer); }
    }
    return { status: "unavailable", reason: "providers_failed" };
  };
}

export function buildEvidenceLedger(overview) {
  const ledger = [{ id: "source:overview", kind: "provenance", data: overview.evidence }];
  for (const market of overview.markets || []) {
    const symbol = market.symbol;
    const facts = market.facts || {};
    ledger.push({ id: `${symbol}:snapshot`, kind: "market_snapshot", symbol, data: {
      status: market.status,
      funding: facts.funding ? { hourly_rate_decimal: facts.funding.hourly_rate, annualized_simple_percent: market.calculations?.funding?.annualized_simple_percent } : null,
      basis: facts.basis ? { ...facts.basis, mark_oracle_deviation_percent: market.calculations?.basis?.mark_oracle_deviation_percent, interpretation: "not executable spot/perp basis" } : null,
      liquidity: facts.liquidity ? { ...facts.liquidity, ...market.calculations?.liquidity, interpretation: "snapshot metrics; not an executable quote or fill guarantee" } : null,
      risk: facts.risk || null, notices: market.notices,
    } });
    if (market.research?.funding_history) {
      const history = market.research.funding_history;
      ledger.push({ id: `${symbol}:funding_history_72h`, kind: "funding_history", symbol, data: {
        status: history.status, observed_samples: history.observed_samples, expected_samples: history.expected_samples,
        coverage_fraction: history.coverage, missing_samples: history.missing_samples, gap_hours: history.gap_hours,
        stale: history.stale, sum_realized_rates_percent: history.sum_realized_rates_pct,
        hourly_mean_rate_percent: Number.isFinite(history.hourly_mean_rate) ? history.hourly_mean_rate * 100 : null,
        retrospective_simple_apr_percent: history.retrospective_simple_apr_pct,
        positive_share_fraction: history.positive_share, sign_reversals: history.sign_reversals,
        latest_rate_percent: Number.isFinite(history.latest_rate) ? history.latest_rate * 100 : null,
        latest_time: history.latest_time, notices: history.notices, source: history.source,
      } });
    }
    if (market.research?.order_book) {
      const book = market.research.order_book;
      ledger.push({ id: `${symbol}:order_book`, kind: "order_book", symbol, data: {
        ...book,
        measurement_scope: "single visible snapshot; at most 20 levels per side; not durable liquidity or executable size",
      } });
    }
  }
  return ledger;
}
