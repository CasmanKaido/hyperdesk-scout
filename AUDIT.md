# Product and implementation audit

Date: 2026-09-19. Scope: repository code and documentation, not a production certification.

## Goal and verdict

LiquidFlux should answer conversational Hyperliquid information requests without silently creating an investment strategy. An explicit strategy request should produce editable constraints and a separately reviewed first-party specialist workflow. Evidence must come from deterministic market-data processing, not model invention. OKX.AI distributes LiquidFlux services; external paid specialists remain deferred.

**Verdict:** The repository has a real read-only Hyperliquid adapter, deterministic specialist modules, and a browser review step. The information/strategy split is now integrated locally, with automated flow coverage. It does not demonstrate independent external-specialist coordination or server-enforced approval. Production/provider validation is separate from local tests.

## Evidence scope

- Inspected `src/ai-planner.js`, `src/handler.js`, `src/orchestrator.js`, `src/market-overview.js`, `src/hyperliquid.js`, `src/market-data.js`, `src/scoring.js`, specialist registry/risk code, `src/server.js`, `public/app.js`, relevant HTML, planner tests, and product/integration docs.
- At initial inspection, planner/handler code and tests were modified and market-overview code/tests were untracked. Other contributors own these changes. Findings refer to the inspected snapshot; symbol names are more durable references than line numbers.
- Integration follow-up: `market_information`, `POST /api/v1/market-overview`, suggested-default disclosure, short replies, explicit information confirmation, and shared busy guards are wired in the browser. Automated VM tests cover pending-query confirmation, stale action invalidation, defaults, and overlapping requests; these do not establish visual quality or live-model understanding.
- `OKX_AI.md` records historical free A2MCP invocations: funding request `3dc87444-ee1a-475d-a9ac-c450ebbe798b` and orchestrator request `b1eb7e58-9107-4b5d-bd14-83325c7fff9e`, dated 2026-09-18. These are repository records, not independently replayed evidence from this audit.
- Current local validation: 106/106 automated tests passed; recursive JavaScript syntax and JSON checks passed. Direct live BTC `fundingHistory` and `l2Book` calls returned complete source metadata and bounded summaries. Desktop/mobile Chrome journeys passed with fixture AI responses. No v0.7 production, marketplace, real AI-provider, or payment verification is implied; no formal accessibility/performance score is assigned.

## Production API verification — 2026-09-19

Render reported version `0.5.0` after implementation commit `94384f6` was pushed. Direct HTTPS checks (not a browser or official marketplace invocation) passed:

- “Tell me about BTC” → `market_information`, BTC only, all four topics, no financial constraints; request `1b61b7bf-622d-4d86-a9f4-c84ce80d5831`.
- BTC overview → HTTP 200 with live Hyperliquid facts, calculations, freshness and limitation notices; request `c976249e-cf26-4d64-8f44-1a70aac9811e`.
- “Funding rates and other info” with preceding conversation → BTC information retained; request `46a18df3-a9b0-40c2-b4ac-a533d57a3671`.
- Explicit BTC/ETH strategy → preserved $5,000 and 2×; moderate risk and 5% minimum APR explicitly disclosed as defaults; request `467284ee-67dc-4cf7-a56f-9fde08c7ff78`.

All three planner calls selected Groq `openai/gpt-oss-20b`. Gemini remains unverified. These samples do not guarantee general model accuracy. Information replies used premature “here’s an overview” wording despite returning only an information proposal; the browser correctly presents the free fetch confirmation. Improve that wording without treating model text as fetch authorization. Visual desktop/mobile validation remains outstanding; exact-query “yes” confirmation is covered by automated frontend tests.

## Production API verification — 2026-09-22 (v0.7.6)

Render reported version `0.7.6` after commit `c1b109e`. A live `/api/v1/market-overview` check (not a browser or marketplace invocation) asked whether BTC funding had been persistently positive over 72 hours and how visible book liquidity looked, across BTC and ETH with funding/liquidity topics:

- `analysis.status: "completed"`, `answer_source: "ai_filtered"`, provider Groq `openai/gpt-oss-20b`.
- All displayed numeric findings were canonical deterministic strings from the server-built ledger (settlement coverage, positive share, sign reversals, retrospective simple APR, visible spread bps, visible notional within 10 bps), each citing stable evidence IDs.
- Caveats stated the retrospective/snapshot limits without forecasting; `next_questions` was empty as designed.
- The one-sentence AI answer was grounded but thin; substantive detail lives in the deterministic findings. Deepening prose quality without reintroducing invented claims remains open work.

This verification exercised the grounded-analysis mitigations added after earlier live failures: deterministic numeric rendering (a model had mislabeled `0.001219%` as `1.219 bps`, a 10× error), a semantic gate rejecting prescriptive/unsupported prose (a model had called a bounded book snapshot "decisive for traders"), removal of model-invented follow-up questions, and a deterministic fallback conclusion when all model prose is rejected. These mitigate displayed-output risk; they do not prove general model accuracy, and Gemini live behavior remains unverified.

Follow-up the same day (v0.7.7–v0.7.8, commits `1fc3793`–`7e135d0`): the blanket no-digits prose filter was replaced with a number-grounding gate so answers can quote ledger figures. Every numeric token in the answer and caveats must match a trusted code-extracted ledger value at the token's own precision; % signs require a `_percent`/`_fraction`-derived value; sentences mentioning one symbol may only use that symbol's numbers. Live result: a detailed evidence question produced a five-sentence answer quoting snapshot rates, 72-hour means, retrospective APR, and visible-level limits, all gate-passed. Answer richness still varies with question phrasing; the deterministic findings carry canonical numbers regardless. Two operational gaps were also fixed: model caveats were previously displayed without number/prescriptive gating, and the service version was hardcoded in four source files (health checks could not distinguish deployments); the version is now single-sourced from `package.json` via `src/version.js`. A transient live provider failure returned the safe `providers_failed` state; one retry on rate-limit/server errors was added.

## Production verification — 2026-09-23 (v0.8.0)

Render reported `0.8.0` for runtime feature commit `1f9780d`. Direct HTTPS and deployed-browser checks produced the following evidence:

- `GET /health` returned `status: ok`, service `hyperdesk-scout`, version `0.8.0`.
- The paid `POST /api/v1/research-report` route failed closed with HTTP 503 `payments_not_configured` while `X402_ENABLED=false`; request `588bb8ea-fc98-4585-914c-7b0bf3f77a59`. No market-data report was released.
- Information planning returned `market_information` for BTC funding using Groq `openai/gpt-oss-20b`; request `61c6dba1-b19e-40de-8c22-9bffe623c3aa`.
- A live BTC funding overview returned fresh Hyperliquid snapshot and complete 72/72-hour funding evidence. The first broader funding/liquidity analysis returned the safe `providers_failed` state (`394d7d30-1c92-499e-9ed4-a3b941928092`); a focused retry completed through Groq with `answer_source: ai_filtered`, a canonical deterministic finding, and no generated follow-up questions (`3fc78f99-d8f3-4158-920d-3de8e8aca590`). This demonstrates safe transient failure handling, not continuous provider availability. Gemini was not selected in these checks.
- Explicit BTC strategy planning preserved moderate risk, 2× maximum leverage, and $1,000 maximum notional; Groq marked only the omitted 5% funding threshold as suggested in the direct API sample; request `3428ee2c-23f9-41ce-b94d-c8fc2f658fb4`.
- Deterministic orchestration returned HTTP 200 with fresh Hyperliquid evidence, Funding/Liquidity → Risk → Synthesis trace, one review candidate, `approval_required: true`, and `execution_included: false`; request/workflow `a1f6bd81-c007-4966-b137-de3fb98e49bb`.
- `node scripts/live-browser-smoke.js https://hyperdesk-scout.onrender.com/` passed against the deployed site: desktop and emulated 390×844 mobile loaded online with no horizontal overflow and a fully visible composer; the desktop journey completed information confirmation → evidence → strategy review → approval → result without runtime exceptions. The existing fixture browser smoke also passed both complete desktop/mobile journeys.

One deployed browser run exposed a known provenance defect: after an explicit strategy message, model-reported `suggested_defaults` labeled objective, market, risk, leverage, notional, and funding threshold as defaults, although the message explicitly supplied all except the threshold. A direct isolated planner call classified only the threshold as defaulted. The UI accurately displayed the API field, so this is not a rendering bug; it confirms that `suggested_defaults` is nondeterministic model output rather than field-origin proof. Deterministic explicit/inherited/interpreted/defaulted provenance remains a P1 requirement and must be fixed before representing defaults as established facts.

## Payment correctness hardening — 2026-09-23 (v0.8.1, local)

The x402 paid-report flow was refactored from `verify → settle → generate` to `verify → generate and persist artifact → settle → release`:

- A valid authorization is identified without storing/logging its raw signature as an idempotency key; a SHA-256 operation identity covers scheme, network, asset, payer, and nonce.
- The operation is bound to a canonical fingerprint of the normalized report request (version, method, route, sorted symbols/topics, trimmed/defaulted question). The same authorization with different input returns HTTP 409 `authorization_request_mismatch` before generation or facilitator calls.
- Duplicate in-flight use returns HTTP 409 `payment_in_progress`. An exact retry after settlement returns the original stored artifact and receipt with `report.payment.recovered: true`, without regenerating research or calling `/verify`/`/settle` again.
- Report-generation failure abandons the verified operation and never calls `/settle`; pre-settlement storage failure also fails closed without settlement. Any unconfirmed response after a settlement attempt is retained as `settlement_outcome_unknown`/`settlement_pending` and is never blindly retried or deleted without reconciliation evidence.
- Raw payment header, signature, authorization, and nonce values are not logged. The signed payload is removed from stored state after settlement.

Focused payment/handler/OpenAPI validation passed 42/42 tests. Coverage includes malformed/mismatched terms and request binding, exact-proof recovery, verification failure, report-generation failure, pre/post-settlement storage failure, settlement ambiguity, atomic duplicate settlement, changed-request replay, rate-limit-independent lost-client-response recovery, deterministic request normalization, receipt headers, and log redaction.

The default store is bounded process-local memory: unused verified operations expire after 24 hours; settling/settled bindings are retained; capacity rejects new work at 1,000 operations rather than evicting replay evidence. This proves small-scale same-process testnet behavior but not restart-safe, multi-instance, or production-scalable recovery. Production/mainnet still requires a durable shared transactional store and facilitator/on-chain reconciliation for a crash after chain settlement but before receipt persistence. After commit `43dfdfd` was pushed, Render reported version `0.8.1`. The deployed paid route remained disabled and returned HTTP 503 `payments_not_configured` for request `18c8d916-6561-4f25-8d06-f6fc87afed99`; no live settlement is claimed by this record.

## Findings and priorities

### P0 — Complete and validate the information/strategy split

**Evidence:** `validatePlannerOutput` returns intent-specific information fields; `buildMarketOverview` accepts symbols/topics without risk, leverage, budget, rankings, or strategy filters. The integrated browser accepts short replies and confirms the exact pending information query without another AI call. Only plan updates carry a specialist plan. `approval_required: true` remains compatibility metadata, not server authorization.

**Impact:** A backend change alone does not deliver the conversational goal. “BTC”, “yes”, or “funding” must not create default strategy constraints or imply strategy approval.

**Acceptance:** Validate browser → planner → overview → evidence explanation for “I want to know about BTC”, “BTC”, “yes”, “funding”, and unresolved references. Verify no `/orchestrate` call, strategy plan, or financial constraints on information turns. Explicit strategy creation/revision must retain the separate review action. Synchronize OpenAPI, tests, UI, and examples; then record local and deployed validation separately.

### P1 — Defaults are suggestions, not established user preferences

**Evidence:** `validateOrchestrationInput` supplies BTC/ETH/SOL, moderate risk, 2× leverage, $1,000 notional, and 5% funding threshold when omitted. The HTML prepopulates equivalent controls. Local planner work adds `suggested_defaults`, validates allowed field names, and prompts disclosure, but does not independently prove which values originated with the user. `current_plan` carries values without field-level origin metadata.

**Impact:** A schema-valid plan can still silently substitute an inferred/default value or lose its origin over revisions. Model-reported provenance is not deterministic provenance.

**Acceptance:** Distinguish explicit user values, interpretation choices, inherited values, and service defaults in review. Preserve origins through manual edits and follow-ups; test that explicit values survive and defaults never leak into information requests. Treat suggestions as unconfirmed until review, not as the user's stated risk appetite.

### P1 — Approval is a UI workflow, not API enforcement

**Evidence:** `reviewPlan` captures `pendingInput`; the approval button calls `executeAnalysis`. `POST /api/v1/orchestrate` validates constraints and immediately fetches market data. Its accepted fields contain no approval receipt, identity, plan version, expiry, or budget authorization. Response flags `approval_required: true` and `execution_included: false` are metadata, not authorization checks.

**Impact:** Direct API callers can run the free read-only analysis without browser review. This is not a demonstrated trading/spending vulnerability: no execution/payment path exists. It is a material limit on the phrase “approval-gated.”

**Acceptance:** Describe today's boundary as browser review plus a read-only API. If analysis authorization becomes a requirement, bind approval server-side to the exact plan/provider/fee/version and invalidate on edits. Before any future spend or execution, require authenticated, expiring, replay-safe authorization and server-side limits; never reuse the current flag as permission.

### P1 — Gemini live availability and prior failure cause — RESOLVED 2026-09-22

**Resolved evidence:** The v0.7 adapter correction (`models/{model}:generateContent`, structured `generationConfig`, candidate-part parsing) was verified live with a real key. A direct `gemini-3.8-flash` call returned HTTP 200 with the expected `candidates[0].content.parts[].text` shape, but the key's free-tier quota for that model (20 requests) was exhausted, returning documented `RESOURCE_EXHAUSTED` 429s; `gemini-2.5-flash`/`gemini-2.0-flash` are deprecated (404, Google recommends `gemini-3.6-flash`). A full structured analyst call against `gemini-3.6-flash` completed with `answer_source: "ai_filtered"` — a five-sentence grounded answer whose quoted figures all passed the number gate. The default model is now `gemini-3.6-flash` in planner and analyst. The prior failure cause was the incorrect `/v1beta/interactions` adapter; no further contract issues were observed. Gemini free-tier quota is per-model and small, so Groq fallback remains load-bearing for demos.

### P1 — Evidence is useful but narrower than executable strategy intelligence

**Evidence:** `fetchPerpMarkets` uses `metaAndAssetCtxs`; `createMarketDataProvider` timestamps completion of the local fetch and caches the result. Specialists share that snapshot. `calculateMetrics` annualizes hourly funding, computes mark/oracle deviation, and applies heuristic scores. Before v0.7 it coerced non-finite numeric inputs to zero and used zero basis when oracle price was not positive. v0.7 preserves unknowns as null and specialists fail closed on required missing evidence. Risk rejects stale data but has no comprehensive missing-field validation. Orchestrator provenance hardcodes “Hyperliquid mainnet” although `HYPERLIQUID_API_URL` is configurable.

**Impact:** Fetch freshness is not an exchange event timestamp. Mark/oracle deviation is not executable cross-venue basis. Volume/open interest/impact prices are not order-book depth or a size-specific fill quote. Scores are policies, not calibrated loss probabilities. Zero substitution can make missing evidence look benign. No hedge availability, borrow cost, funding history, fees, net return, liquidation simulation, or executable slippage evidence is established by these paths.

**Local improvement:** `buildMarketOverview` separates facts/calculations/notices and uses null for missing inputs. v0.7 also adds 72-hour funding and visible L2-book evidence, hardens scanner/orchestrator scoring, and propagates missing-evidence qualifications. The shared adapter also filters delisted/missing-mark markets and normalizes `isDelisted`; downstream null handling cannot recover discarded source distinctions.

**Acceptance:** Fail closed or return explicit unknowns for required strategy evidence; test missing/invalid oracle, funding, leverage, and impact prices. Derive source/network labels from verified configuration. Show fetch time, age, cache/stale status, units, formula, limitations, and unavailable symbols beside claims. Label `approve` as “policy pass,” never execution permission or a guarantee of safety.

### P1 — Client context is bounded but unauthenticated; grounding is not verified

**Evidence:** Planner validation limits conversation to 12 user/assistant turns, each at most 1,000 characters, and bounds JSON context size/depth/keys. The prompt marks history/current plan/context as untrusted. However, clients supply all three, and context accepts bounded JSON rather than a server-issued evidence record. Output validation checks shape/ranges, not the truth or evidence citations of free text. `public/app.js` renders text with DOM text content rather than interpreting model HTML.

**Impact:** A caller can forge assistant history or market facts. Prompt instructions reduce risk but do not prove injection resistance or grounded explanations. Context is sent to configured AI providers, including fallback; “read-only” does not mean no data sharing or infrastructure cost.

**Acceptance:** Prefer server-retrieved evidence bound to a result ID, or a verified signed evidence envelope, with age and scope checks. Separate user assertions from trusted facts and require references for numerical claims. Test forged roles/facts, instruction-bearing evidence, stale results, and cross-result contamination. Document provider data sharing; keep prompts/secrets out of logs. Public provider-backed routes also need cost/concurrency controls: IP rate limiting and CORS are not authentication. Review proxy-aware client identity before relying on per-client quotas (`src/server.js` uses socket address).

### P2 — Conversation memory and asynchronous state need explicit semantics

**Evidence:** Browser history lives in memory, retains only the last 12 turns, and records user/assistant turns after successful planner responses. Visible error turns are not equivalent to model history. `analysisContext` reduces strategy results, omitting full specialist outputs and some freshness metadata. Manual edits clear current analysis, but historical messages remain. The integrated browser uses a shared busy guard and disables editing during requests, preventing overlapping UI actions; stale pending actions are cleared on new messages and edits.

**Impact:** Reload is not durable memory; long conversations can lose the referent of “yes.” Failed messages may look remembered but are not sent next time. An old reply/result can conflict with newer constraints. Reduced evidence may not support the requested explanation.

**Acceptance:** Define reset/retention/privacy behavior, preserve the resolved information scope independently of transcript truncation, and ask only when a reference is genuinely unresolved. Bind responses/evidence to active request/plan versions and ignore obsolete completions. Test retries, reload, history truncation, manual edits during requests, concurrent runs, and switching between information and strategy. Say when evidence is insufficient rather than inventing missing details.

### P2 — Marketplace distribution is not external-agent hiring

**Evidence:** `src/specialists/registry.js` imports local Funding/Liquidity/Risk modules; `orchestrateMarketNeutral` invokes them directly and synthesizes locally. No runtime marketplace discovery, third-party specialist call, payment, or settlement is present in that path. HTML shows an external slot as disconnected/skipped. `OKX_AI.md` records two free first-party A2MCP listings; inspected HTML says only Funding is listed. `STRATEGY.md` describes an eventual A2A orchestrator and x402 role, which must not be mistaken for implemented capabilities.

**Impact:** “Distributed through OKX.AI” describes service distribution, not distributed execution among independent specialists. Static listing labels can drift; free marketplace fees do not mean free model infrastructure.

**Acceptance:** Keep local/first-party execution and historical listing evidence explicit. Align listing copy with dated evidence without claiming a fresh marketplace check. Defer external paid integration until an independent service adds distinct evidence and has a compatible official invocation, pinned identity, validated contract, explicit budget/confirmation, timeout/failure policy, and recorded call/payment evidence where applicable. No artificial external integration is needed for this MVP.

## What is already worth preserving

- Actual Hyperliquid HTTP adapter rather than fabricated market numbers.
- Fixed, understandable specialist dependencies and deterministic risk blockers/conflict synthesis.
- Bounded cache fallback and stale-data rejection in strategy risk policy.
- Server-side provider keys, output validation, timeouts, fallback, and opaque provider failure responses.
- Manual controls, review-before-run browser flow, raw structured outputs, and no wallet/signing/trading path in the reviewed implementation.

## Validation plan before stronger claims

1. Complete the concurrent local information route, planner, short-reply UI, and contract work; run focused and full tests plus syntax checks on an identified revision.
2. Exercise both browser journeys and adversarial/default/history cases above; verify actual network calls and approval invalidation.
3. Test providers separately against real documented contracts without exposing secrets or raw user context.
4. Verify deployed revision and repeat the two journeys against that deployment. Preserve sanitized responses, timestamps, request IDs, selected provider, and limitations.
5. Repeat the official free OKX.AI invocation from a clean session only when authorized; distinguish it from direct HTTP testing. External paid specialists remain deferred.

The audit distinguishes implemented local behavior from production verification and deferred capabilities. Remaining acceptance criteria are follow-up work, not claims of completed validation.
