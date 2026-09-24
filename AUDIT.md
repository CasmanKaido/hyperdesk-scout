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

## OKX buyer compatibility verification — 2026-09-23 (v0.8.2, local)

The official `okx/onchainos-skills` CLI source shows that `payment quote` stores the original `accepts[]` entries and `payment pay` echoes the selected entry verbatim as `PAYMENT-SIGNATURE.accepted`. Its assembled v2 header contains `x402Version`, `resource`, `accepted`, and `payload`; unknown top-level challenge extensions are not retained. LiquidFlux previously put `liquidfluxRequest` at the challenge's top level, so the official buyer would have dropped it and the server would have rejected a legitimate payment as `payment_request_binding_mismatch`.

The binding now lives at `accepts[].extra.liquidfluxRequest` and is checked at `PAYMENT-SIGNATURE.accepted.extra.liquidfluxRequest`, preserving the EIP-712 token-domain `extra.name` and `extra.version` fields. Tests assert the challenge shape, facilitator requirement body, and rejection of a legacy top-level-only extension. This resolves buyer/header interoperability only; no facilitator, funded wallet, signature, or settlement has yet been verified.

The official OKX CLI `token_alias.rs` registry identifies X Layer testnet USDT as `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c`. Read-only calls through the two X Layer testnet RPCs listed by the public chain registry returned chain ID `1952`, non-empty proxy bytecode, token name/symbol `USD₮0`, 6 decimals, and a domain separator. The EIP-1967 implementation slot resolves to deployed implementation bytecode containing selectors for `transferWithAuthorization`, `receiveWithAuthorization`, `cancelAuthorization`, and `authorizationState`. This establishes the candidate asset and EIP-3009 compatibility without sending a transaction.

Facilitator discovery remains blocked. The official `@okxweb3/x402-core` package defaults its generic HTTP client to `https://web3.okx.com/facilitator`, but that path is not a live public facilitator. Its `OKXFacilitatorClient` instead signs requests to `/api/v6/pay/x402/supported`, `/verify`, `/settle`, and `/settle/status` using an API key, secret, and passphrase. The published `@okxweb3/x402-evm` README documents X Layer mainnet (`eip155:196`) only. Without credentials, an authoritative `/supported` response proving `exact` on `eip155:1952` is still unavailable, so production payments remain disabled.

The operator explicitly selected the current agent wallet as LiquidFlux's receiver on 2026-09-23. A fresh read-only `onchainos wallet addresses` call confirmed `0x49d948895262dbaa485dde3d5785d7d3d3165508` for `xlayer_test` (chain `1952`). This records the intended public `X402_PAYTO_ADDRESS`; it does not configure Render, enable payments, fund a wallet, authorize a payment, or prove facilitator support.

After commits `ae0d1be` and `758264a` were pushed, Render reported version `0.8.2`. A deployed `POST /api/v1/research-report` request still failed closed with HTTP 503 `payments_not_configured`; request `c28e14fa-2157-4b68-b4ad-327fd88ddcfa`. No live challenge, signature, or settlement is claimed.

## Official facilitator client integration — 2026-09-23 (v0.8.3, local)

LiquidFlux now pins and imports the official `@okxweb3/x402-core@0.1.0` `OKXFacilitatorClient` instead of using unauthenticated direct production fetches. When payments are enabled, configuration requires `OKX_API_KEY`, `OKX_SECRET_KEY`, and `OKX_API_PASSPHRASE`; the SDK applies OKX HMAC authentication to `/api/v6/pay/x402/supported`, `/verify`, and `/settle`. Settlement uses `syncSettle: true`, and LiquidFlux still rejects any pending or otherwise unconfirmed result rather than releasing the report.

The existing request binding, exact-proof recovery, artifact-before-settlement sequence, atomic settlement ownership, and secret-safe logging remain in LiquidFlux's gate rather than being delegated to default middleware. A sanitized `npm run check:x402-support` command now checks only for x402 v2 `exact` on the configured network and never prints credentials. Focused payment tests passed 29/29, the full suite passed 148/148, syntax/JSON checks passed, and changed-file diagnostics were clean. A credential-free support-check invocation failed closed with only the required environment-variable names and no values.

This integration does not prove hosted facilitator support for `eip155:1952`: that requires operator credentials configured outside Git and a real read-only `/supported` response. Payments remain disabled until that evidence exists.

## Container dependency fix — 2026-09-23 (v0.8.4, local)

The first v0.8.3 Render deployment built an image but failed at process startup with `ERR_MODULE_NOT_FOUND` for `@okxweb3/x402-core`. Root cause: the repository Dockerfile copied application sources and `package.json` but never copied `package-lock.json` or installed production dependencies. The Dockerfile now copies both manifests and runs `npm ci --omit=dev --ignore-scripts` before switching to the unprivileged `node` user. The deployment-config test now requires both the lockfile copy and production install command so a dependency-free runtime image cannot pass CI again.

Full tests passed 148/148 and syntax/JSON checks passed. Docker is unavailable in the local agent environment, so an image build could not be run there; instead, a clean staged directory ran the exact production-only `npm ci` command from the lockfile and successfully imported `src/payments.js`, directly reproducing the dependency-resolution boundary that failed on Render.

After commit `bbe6c96` was pushed, Render completed the rebuilt container and `GET /health` reported version `0.8.4`. A production `POST /api/v1/research-report` remained safely disabled with HTTP 503 `payments_not_configured`; request `247bf6f6-e0db-4c17-923e-918c3bb884ec`. This confirms the dependency fix and fail-closed deployment state, not facilitator testnet support or a live payment.

## Sanitized facilitator support probe — 2026-09-23 (v0.8.5, local)

Because the Render plan has no shell access, LiquidFlux now exposes `GET /health/payments` as a temporary operational fallback. It can initialize the authenticated official facilitator client while `X402_ENABLED=false`, caches successful `/supported` responses for five minutes, and applies a one-minute cooldown after failed checks so a public caller cannot repeatedly hammer the authenticated OKX route. It returns only the expected x402 version/scheme/network, support boolean, aggregate match counts, and whether payments are enabled. It never returns credential presence details, API values, authentication headers, signers, raw facilitator data, or upstream error text. A failed authenticated request returns a generic sanitized 502 and logs only the error type.

Focused payment/handler/OpenAPI validation passed 47/47 tests, the full suite passed 150/150, recursive JavaScript syntax and JSON checks passed, project diagnostics were clean, and the changed diff contained no production credentials.

After commit `78d2f53` was pushed, Render reported version `0.8.5`. The first deployed probe returned HTTP 503 `facilitator_support_not_configured`; after the operator corrected the Render credential configuration, `GET /health/payments` returned `status: supported`, `payments_enabled: false`, and confirmed x402 v2 `exact` on `eip155:1952`, with 2 matching kinds among 9 advertised kinds. Request ID: `3e6d2114-e8de-465a-80f9-ebaa454b88f0`.

After the operator configured the public payment values and enabled the gate, the probe returned `payments_enabled: true` (request `919fe357-0876-4f3c-b363-97b79292bc2e`). An unsigned production report request then returned HTTP 402 with a `PAYMENT-REQUIRED` challenge for x402 v2 `exact` on `eip155:1952`, 10,000 atomic units (0.01 USD₮0), asset `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c`, receiver `0x49d948895262dbaa485dde3d5785d7d3d3165508`, 300-second timeout, and a `research-report:v1` request fingerprint binding. Request ID: `c964e0b5-ce4b-4bce-b629-1608f4688855`. This proves the live challenge contract and intended terms; it does not prove buyer funding, authorization, facilitator verification, settlement, or report delivery.

## Buyer compatibility, funding, and settlement reconciliation — 2026-09-24 (v0.8.6–v0.8.7)

Production v0.8.6 normalized the official buyer CLI's scalar `symbols=BTC` request to the same canonical request and payment fingerprint as `symbols: ["BTC"]`. This removes a quote/replay incompatibility without weakening the one-to-five-symbol validation or exact request binding.

The first authorized live test occurred before the buyer wallet was funded. An initial replay omitted the required `symbols=BTC` parameter and was rejected with HTTP 400. A fresh correctly parameterized request reached settlement but returned HTTP 502 `settlement_outcome_unknown` for request `40110eb7-79fe-4d92-bd5e-1866e89fc025`, with no transaction hash. No transaction was found, and the wallet had zero USD₮0 at the time. That authorization will not be retried or reused. This is evidence of fail-closed behavior, not successful payment or report delivery.

A later read-only official CLI funding check confirmed 10 USD₮0 on X Layer testnet in buyer wallet `0x49d948895262dbaa485dde3d5785d7d3d3165508`, against a 0.01 USD₮0 requirement: shortfall 0 and `sufficient: true`. The configured recipient is the same address, so the forthcoming test can prove authorization, facilitator settlement, receipt, and delivery mechanics but not economically meaningful transfer to an independent merchant.

v0.8.7 adds bounded facilitator settlement reconciliation. Immediate confirmed success still releases the stored artifact. `pending` and `timeout` with a transaction hash persist only sanitized status/hash/network/payer data; timeout is polled through the official SDK's `getSettleStatus`, and exact retries reconcile the stored hash without another settlement call. Confirmed status success releases the original artifact, confirmed failure becomes terminal `settlement_failed`, and polling errors or continued pending return HTTP 202 while withholding the report. Thrown settlement calls and malformed timeout responses without a hash remain ambiguous and fail closed; they are never blindly resubmitted. Raw signatures, nonces, authorization payloads, credentials, and upstream error bodies remain absent from logs.

Focused payment/handler/OpenAPI validation passed 56/56 tests, the full local suite passed 159/159 tests, syntax/JSON checks passed, and project diagnostics were clean. The default operation store remains bounded process-local memory: reconciliation cannot survive a restart and is not safe across multiple instances. A durable shared transactional store remains required before production/mainnet claims.

After commit `6264f5c` was pushed, Render reported v0.8.7 and `GET /health/payments` remained `supported` with payments enabled and 2 matching x402 v2 `exact` kinds among 9 advertised kinds (probe request `b3c55682-fec6-48f7-ac11-168d7f51dca1`). A completely fresh official CLI quote for `symbols=BTC` presented 0.01 USD₮0 (10,000 atomic units) on `eip155:1952`, token `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c`, and recipient `0x49d948895262dbaa485dde3d5785d7d3d3165508`. The operator explicitly confirmed those terms before signing.

The official payment flow then completed successfully. Transaction: `0x07f6fc456ac7f05e62eecb1c7330aa028229133d25efcfce2658a0cf7b840715`; delivered report request: `545b7b70-bbb7-4d19-bc47-bdd9df17e48c`; generated at `2026-09-24T07:02:11.431Z`. The decoded receipt reported `status: success`, payer `0x49d948895262dbaa485dde3d5785d7d3d3165508`, and X Layer testnet, while the report payment metadata recorded 10,000 atomic USD₮0 and the same transaction. The delivered report had `report.payment.recovered: true`, demonstrating that the persisted report was released through the exact-retry reconciliation path rather than regenerated or resettled. It included fresh Hyperliquid evidence, complete 72/72 hourly funding coverage, bounded 20-level-per-side L2 evidence, and a citation-filtered Groq analysis. The CLI's decoded receipt amount field was empty even though the server's bound payment metadata and challenge recorded 10,000 atomic units; this display limitation does not change the confirmed transaction/status evidence.

A post-payment read-only funding check still reported 10 USD₮0, as expected for this self-payment test where payer and recipient are the same address. This proves the live `402 → confirmation → authorization → settlement/reconciliation → 200 report` mechanics, but it does not prove independent merchant revenue transfer, mainnet durability, or multi-instance safety.

A second fresh quote and explicit confirmation produced a distinct successful transaction, `0xac3d8a1cae087dd398b62a4bac34930eb1c352501543e5979529429a5cd45996`, and report request `b786396c-5eae-459a-b51d-72f7924d1871`, generated at `2026-09-24T07:08:32.318Z`. The result again carried `recovered: true`, demonstrating repeat authorization/settlement/reconciliation with a distinct nonce-backed transaction rather than reuse of the first payment. However, both AI providers failed and the paid route still settled before returning `analysis.status: unavailable` with deterministic market evidence. This proves payment reliability but exposed a product-contract defect: the advertised paid artifact includes grounded AI synthesis, so a degraded evidence-only response should not be charged as complete.

v0.8.8 fixes that defect at the pre-settlement boundary. The paid route now requires `analysis.status: completed`; otherwise it abandons the verified operation, returns retryable HTTP 503 `report_generation_unavailable`, and never calls facilitator settlement. The same unconsumed authorization may retry while valid because the abandoned verified state is removed. Free market overview behavior remains unchanged and may still return explicit safe AI-unavailable states. Automated coverage proves the outage path calls verification but not settlement, then succeeds on a later completed-analysis retry. Focused payment/handler/OpenAPI tests passed 57/57, the full suite passed 160/160, syntax/JSON checks passed, and project diagnostics were clean.

After commit `79c6ae4` was pushed, Render reported v0.8.8. The sanitized production payment probe remained enabled and supported with 2 matching kinds among 9 advertised kinds (request `3d4532d4-e084-47ce-87c8-cf5d08c6414c`), and the deployed OpenAPI contract described the complete-analysis precondition and no-settlement 503 outcome. No third payment was authorized for this deployment verification.

A separate explicitly confirmed negative-path test created a fresh authorization bound to `symbols=BTC` and intentionally replayed it with `symbols=ETH`. Production rejected the request locally with HTTP 402, `invalid_reason: payment_request_binding_mismatch`, and request `157e1394-3319-4358-b06f-09f35fe6c351`. The official CLI returned no decoded receipt and `txHash: null`; no report was released. The CLI labeled the non-terminal HTTP 402 wrapper as `status: pending`, but the server result was a definitive fresh payment challenge, not a settlement-pending operation. That authorization will not be retried or reused. This live check proves changed-request binding rejection before settlement.

## OKX.AI paid-service publication — 2026-09-24

The official listing validator passed a new A2MCP service definition with no findings, and the deployed endpoint returned its expected HTTP 402 challenge before publication. Updating LiquidFlux Agent `13784` initially failed before execution because the selected `okx-a2a` CLI was outdated. The official doctor upgraded the runtime from `0.2.15` to `0.2.16`; running the new binary directly produced `ready: true` with all eight checks passing. A fresh explicit confirmation was obtained before retrying the marketplace update.

The update succeeded in transaction `0x58ba919edabb37737b3d185ba0a5f54bb4f7e251e350ac7a129de38c427099ac`. Read-only verification returned a third catalog entry, Hyperliquid Research Report, service ID `e10c7cee-41fd-4c6c-a11a-37b0e780b43b`, A2MCP endpoint `https://hyperdesk-scout.onrender.com/api/v1/research-report`, and 0.01 USDT marketplace fee. An exact marketplace search by Agent ID and service name returned the service publicly; the two pre-existing free services remained unchanged.

Publication and discovery are proven, but marketplace-native purchase is not. The marketplace record identifies a 0.01 USDT fee token at `0x779ded0c9e1022225f8e0630b35a9b54be713736`, while the endpoint challenge requests 0.01 USD₮0 on X Layer testnet at `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c`. A buyer-side marketplace invocation is required to determine whether this is one payment handoff or two distinct charges; no seamless-payment or no-double-charge claim is made yet.

The first buyer-side A2MCP probe reached the endpoint but stopped safely on HTTP 400 because an empty request produced the generic array-bound message `symbols must contain between 1 and 5 items`; no payment was prepared. The installed OKX invoker recognizes a standard missing-parameter response and can then use the validated service description to collect typed input. v0.8.9 therefore distinguishes an absent `symbols` field as `missing required parameter: symbols` while preserving the existing 1–5 bound for present arrays. Focused tests passed 57/57, the full suite passed 160/160, syntax/JSON checks passed, and project diagnostics were clean.

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
