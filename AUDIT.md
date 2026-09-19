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
- Integration validation: 62/62 automated tests passed; recursive JavaScript syntax and JSON checks passed. A direct live Hyperliquid BTC overview returned source/fetch metadata and calculated facts on 2026-09-19. Frontend tests use a simulated DOM and mocked responses. No production, marketplace, real AI-provider, payment, or visual-browser validation is implied; no visual/accessibility/performance scores are assigned.

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

### P1 — Gemini adapter compatibility and failure cause are unknown

**Evidence:** `providerRequest` posts to Gemini `/v1beta/interactions` with `input` and `response_format`; `callProvider` expects `body.output_text`. Default model is `gemini-3.8-flash`. Planner tests inject a response shaped to that expectation. Groq has a separate chat-completions adapter and ordered fallback; logs contain sanitized failure categories.

**Impact:** Mocks cannot establish the real model's availability or the endpoint's request/response contract. Successful fallback would not prove Gemini works, nor identify whether failures arise from schema, model, authentication, quota, or transport.

**Acceptance:** Check official provider contracts and configured model availability, then run isolated provider smoke tests with redacted response-shape evidence. Record selected provider/model, date, failure category, and deployment revision. Until then say “Gemini preferred when configured; Groq fallback,” not “Gemini verified” or “Gemini is broken because …”.

### P1 — Evidence is useful but narrower than executable strategy intelligence

**Evidence:** `fetchPerpMarkets` uses `metaAndAssetCtxs`; `createMarketDataProvider` timestamps completion of the local fetch and caches the result. Specialists share that snapshot. `calculateMetrics` annualizes hourly funding, computes mark/oracle deviation, and applies heuristic scores. It coerces non-finite numeric inputs to zero and uses zero basis when oracle price is not positive. Risk rejects stale data but has no comprehensive missing-field validation. Orchestrator provenance hardcodes “Hyperliquid mainnet” although `HYPERLIQUID_API_URL` is configurable.

**Impact:** Fetch freshness is not an exchange event timestamp. Mark/oracle deviation is not executable cross-venue basis. Volume/open interest/impact prices are not order-book depth or a size-specific fill quote. Scores are policies, not calibrated loss probabilities. Zero substitution can make missing evidence look benign. No hedge availability, borrow cost, funding history, fees, net return, liquidation simulation, or executable slippage evidence is established by these paths.

**Local improvement:** `buildMarketOverview` separates facts/calculations/notices and uses null for missing inputs. It does not repair existing scanner/orchestrator scoring. The shared adapter also filters delisted/missing-mark markets and normalizes `isDelisted`; downstream null handling cannot recover discarded source distinctions.

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
