# LiquidFlux — Ordered Execution Checklist

This is the working order from the current `0.8.9` state. Complete each numbered stage before starting the next unless it is explicitly marked parallel. Do not claim a stage is complete without its listed evidence.

## Current baseline

- [x] Chat-first workspace
- [x] Live Hyperliquid snapshot data
- [x] 72-hour funding and visible L2-book research
- [x] Grounded AI analyst with deterministic numeric findings and fallback
- [x] First-party Funding, Liquidity, Risk, and Synthesis specialists
- [x] Two free services distributed through OKX.AI
- [x] x402 v2 paid research endpoint implemented and locally tested
- [x] Paid endpoint enabled in production
- [x] Live testnet payment completed
- [x] Paid research service published on OKX.AI
- [ ] Independent external specialist invoked
- [ ] Trade execution (intentionally out of current scope)

---

## Stage 0 — Security cleanup

**Why first:** provider credentials were previously pasted into conversation. Treat them as exposed even if they were never committed.

- [ ] Revoke and rotate the exposed Groq credential.
- [ ] Revoke and rotate the exposed Gemini credential.
- [ ] Put replacements only in Render/environment secrets.
- [ ] Search Git history and source for secret-like values.
- [ ] Confirm browser bundles, logs, screenshots, and API responses contain no keys.
- [ ] Re-run live Gemini and Groq smoke tests with sanitized logs.

**Done when:** old keys no longer work, new keys work from the server, and no key appears in repository history or public artifacts.

## Stage 1 — Verify the `0.8.0` deployment

- [x] Confirm `GET /health` reports `0.8.0`.
- [x] Confirm the homepage and chat load on desktop and mobile.
- [x] Confirm free market information still works with a live provider.
- [x] Confirm strategy review → approval → orchestration still works.
- [x] Confirm `POST /api/v1/research-report` returns `503 payments_not_configured` while payments are disabled.
- [x] Record date, revision, provider/model, request IDs, and results in `AUDIT.md`.

**Completed 2026-09-23:** production behavior—not only local tests—matches the `0.8.0` route and workflow contract. The live browser journey also exposed inconsistent model-reported default provenance: one plan labeled explicit user fields as suggested defaults. This pre-existing P1 product limitation is recorded in `AUDIT.md`; deterministic field-origin tracking remains separate follow-up work.

## Stage 2 — Harden payment correctness before enabling it

**Why before a live payment:** the original implementation settled before generating the report. If Hyperliquid or the AI failed after settlement, a buyer could pay without receiving the resource.

- [x] Split payment processing into `challenge`, `verify`, and `settle` phases.
- [x] For a signed request: verify authorization → generate report → settle → release report.
- [x] Never settle when evidence generation or the promised grounded AI analysis fails/unavailable.
- [x] Add idempotency/recovery for “settled successfully but HTTP response was lost.”
- [x] Bind cached paid results to payment nonce and exact normalized request parameters.
- [x] Reject replay with different symbols/question.
- [x] Avoid logging raw payment signatures or authorization payloads.
- [x] Add tests for upstream/storage failure after verification, settlement failure/ambiguity, duplicate replay, mismatched replay, and lost-response recovery.
- [x] Reconcile facilitator `pending`/`timeout` results by stored transaction hash without resubmitting settlement; release only after confirmed success.
- [x] Distinguish definitive `settlement_failed` from ambiguous outcomes and keep polling failures fail-closed and retryable.
- [x] Update OpenAPI and `BUSINESS_MODEL.md` to match the final sequence.

**Completed locally through 2026-09-24:** automated tests prove report-generation/storage failure does not call settlement, an exact settled retry recovers the original report without another facilitator call, and a stored pending/timeout transaction can reconcile through `getSettleStatus` without another settlement call. The default bounded operation store is process-local; durable shared state remains mandatory before production/mainnet because state and reconciliation cannot survive restarts or coordinate multiple instances. Testnet proof may proceed with this limitation explicitly recorded.

## Stage 3 — Configure X Layer testnet payments

Required operator values:

- [x] Choose and verify the LiquidFlux receiving EVM address: `0x49d948895262dbaa485dde3d5785d7d3d3165508` (`xlayer_test`, chain `1952`). Reverified with `onchainos wallet addresses` and explicitly approved by the operator on 2026-09-23.
- [x] Confirm the X Layer testnet USD₮0 contract and decimals: `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c`, 6 decimals. The official OKX CLI token registry identifies it as testnet USDT; both official RPCs report `USD₮0`, and the EIP-1967 implementation exposes EIP-3009 authorization methods.
- [x] Integrate the official pinned `@okxweb3/x402-core@0.1.0` `OKXFacilitatorClient` with synchronous settlement, bounded timeouts, sanitized failures, a read-only `npm run check:x402-support` command, and a cached sanitized `GET /health/payments` fallback for deployments without shell access.
- [x] Confirm a compatible facilitator supporting x402 v2 `exact` on `eip155:1952`. The authenticated official `https://web3.okx.com/api/v6/pay/x402/supported` route advertised 2 matching kinds among 9 total kinds through the sanitized production probe on 2026-09-24 (request `3e6d2114-e8de-465a-80f9-ebaa454b88f0`). The keyless `https://web3.okx.com/facilitator` path remains invalid.
- [x] Confirm the official OKX buyer preserves LiquidFlux request binding in `PAYMENT-SIGNATURE` (binding moved into the selected `accepts[].extra` entry; unknown top-level extensions are not echoed).
- [x] Fund the buyer test wallet. An official read-only funding check on 2026-09-24 confirmed 10 USD₮0 against the 0.01 USD₮0 requirement (shortfall 0, sufficient).
- [x] Configure Render secrets:
  - [x] `X402_PAYTO_ADDRESS` = the verified receiver above
  - [x] `X402_ASSET_ADDRESS`
  - [x] `X402_FACILITATOR_URL=https://web3.okx.com`
  - [x] `OKX_API_KEY` (presence proven by authenticated support response; value remains secret)
  - [x] `OKX_SECRET_KEY` (presence proven by authenticated support response; value remains secret)
  - [x] `OKX_API_PASSPHRASE` (presence proven by authenticated support response; value remains secret)
  - [x] `X402_ENABLED=true` only after the sanitized production probe confirmed the intended kind
- [x] Keep the initial price at `10000` atomic units (0.01 USD₮0) for the proof.

**Completed 2026-09-24:** `/api/v1/research-report` returned a valid live `HTTP 402` challenge with the intended network, token, amount, recipient, timeout, and request binding (request `c964e0b5-ce4b-4bce-b629-1608f4688855`). The paid gate is enabled, the supported-kind probe passes, and the buyer now has sufficient test USD₮0. One pre-funding authorization reached an ambiguous settlement response with no transaction hash and will never be retried; no successful payment or report delivery is claimed yet.

## Stage 4 — Prove the complete paid flow

Use the official OKX buyer/payment flow; do not manually construct signatures.

- [x] Quote the v0.8.7 endpoint with a fresh valid `symbols=BTC` request.
- [x] Verify the confirmation card shows the correct network, token, amount, recipient, request parameter, and balance status.
- [x] Explicitly confirm the payment.
- [x] Complete testnet verification and settlement.
- [x] Confirm the exact retry/reconciliation path returns `HTTP 200` and the requested research report without regeneration or another settlement.
- [x] Decode and verify the `PAYMENT-RESPONSE` receipt.
- [x] Record transaction hash, request ID, timestamp, revision, and sanitized result in `AUDIT.md`.
- [x] Repeat once to demonstrate reliability and a distinct authorization/transaction.
- [x] Test an invalid/mismatched payment and confirm access remains blocked.

**Stage completed 2026-09-24:** production completed `402 → confirmation → settlement/reconciliation → 200 BTC report` twice through the official CLI with distinct transactions: `0x07f6fc456ac7f05e62eecb1c7330aa028229133d25efcfce2658a0cf7b840715` (grounded AI report) and `0xac3d8a1cae087dd398b62a4bac34930eb1c352501543e5979529429a5cd45996` (AI providers unavailable). The second proved repeat payment reliability but exposed that a degraded evidence-only artifact was charged; deployed v0.8.8 now blocks settlement unless grounded AI analysis completes. A fresh BTC-bound authorization replayed with ETH was rejected as `payment_request_binding_mismatch` with no receipt or transaction hash. Payer and recipient were the same funded wallet, so these prove mechanics rather than independent merchant revenue.

## Stage 5 — Publish the paid service on OKX.AI

- [x] Define accurate marketplace copy for “Hyperliquid Research Report.”
- [x] State 1–5 symbols, optional question, price, evidence included, and no execution.
- [x] Register the paid endpoint as an A2MCP service under LiquidFlux Agent `13784` (service `e10c7cee-41fd-4c6c-a11a-37b0e780b43b`; transaction `0x58ba919edabb37737b3d185ba0a5f54bb4f7e251e350ac7a129de38c427099ac`).
- [x] Validate the listing with the official validator; no findings.
- [ ] Discover it from the buyer identity in a clean session. General marketplace discovery from the current account succeeded.
- [ ] Invoke and pay through the OKX.AI marketplace flow—not direct `curl`. Initial empty-input probe reached LiquidFlux but exposed missing-parameter interoperability; v0.8.9 fixes the response for a fresh retry.
- [ ] Record service ID, invocation evidence, payment receipt, and delivered result in `OKX_AI.md`.

**Publication completed 2026-09-24:** the service is present in the live three-service catalog and exact marketplace search. End-to-end marketplace purchase remains open. The listing displays 0.01 USDT, while the endpoint requests 0.01 USD₮0 on X Layer testnet; the buyer-side invocation must establish the actual handoff and rule out an unintended second fee before this stage is complete.

## Stage 6 — Build the adversarial AI evaluation suite

- [ ] Add cases for invented prices, rates, percentages, and citations.
- [ ] Add wrong bps/percent and hourly/APR conversion cases.
- [ ] Add cross-symbol number attribution cases.
- [ ] Add attempts to elicit forecasts and trading recommendations.
- [ ] Add visible-book overclaim cases (fill guarantees, durable liquidity, execution cost).
- [ ] Add prompt injection through user questions and supplied conversation context.
- [ ] Add stale evidence and forged prior-result context cases.
- [ ] Run against Gemini and Groq separately.
- [ ] Record pass/fail categories and keep failing model prose out of user-visible output.

**Done when:** we can make a measured factual-consistency claim backed by a repeatable evaluation report.

## Stage 7 — Make conversation state trustworthy

- [ ] Add server-issued conversation/session IDs.
- [ ] Store resolved information scope and result IDs server-side.
- [ ] Bind explanations to trusted result evidence rather than arbitrary client context.
- [ ] Define reset, truncation, reload, and expiry behavior.
- [ ] Add request/version IDs and discard obsolete concurrent responses.
- [ ] Test “BTC → yes → funding” and strategy edits across reloads.
- [ ] Protect against forged history and cross-result evidence reuse.

**Done when:** memory survives normal use without allowing the client to forge what the AI previously analyzed.

## Stage 8 — Add one genuinely independent specialist

Do not add another service merely to increase the count. Choose one distinct evidence source, such as event risk, wallet flow, cross-venue liquidity, or security intelligence.

- [ ] Find and evaluate an independent OKX.AI specialist.
- [ ] Define what unique evidence it contributes.
- [ ] Define price/spend limit, timeout, fallback, and provenance contract.
- [ ] Invoke it from LiquidFlux with explicit payment approval where required.
- [ ] Preserve provider identity and raw evidence boundaries in synthesis.
- [ ] Demonstrate partial failure without collapsing the whole workflow.
- [ ] Record a real independent invocation and, if paid, its receipt.

**Done when:** LiquidFlux truthfully coordinates at least one external agent—not only internal modules.

## Stage 9 — Improve product quality using evidence, not more dashboard widgets

This stage may run in parallel with Stages 6–8 after payment proof.

- [ ] Make the chat answer lead with the direct conclusion, then evidence and caveats.
- [ ] Show data freshness and provider identity without clutter.
- [ ] Clearly label deterministic fallback versus filtered AI analysis.
- [ ] Provide only follow-up actions supported by the actual tool registry.
- [ ] Test keyboard navigation, focus states, screen reader labels, reduced motion, and mobile composer clearance.
- [ ] Measure first-answer latency and reduce avoidable sequential calls.
- [ ] Keep manual tools secondary to the conversation.

**Done when:** a new user can ask, understand, inspect, and continue without needing an explanation of the interface.

## Stage 10 — Production business validation

- [ ] Measure AI tokens/cost, Hyperliquid calls, facilitator cost, latency, and failures per report.
- [ ] Calculate gross margin at 0.01, 0.05, 0.10, and 0.25 USD₮0.
- [ ] Set production pricing from measured cost, not guesses.
- [ ] Track 402-to-paid conversion and repeat buyers.
- [ ] Add budget and concurrency controls for public AI usage.
- [ ] Define support/refund handling for paid failures.
- [ ] Decide whether subscriptions are justified by repeat usage.

**Done when:** pricing covers measured marginal cost and buyers demonstrate repeat demand.

## Stage 11 — Hackathon submission package

- [ ] Record a concise demo: conversational question → grounded evidence → specialist coordination → paid agent report.
- [ ] Show the evidence ledger and limitations, not only polished prose.
- [ ] Show the live OKX.AI listing and paid invocation.
- [ ] Include architecture and trust-boundary diagram.
- [ ] State honestly what is first-party, external, deterministic, AI-generated, paid, and not implemented.
- [ ] Run full tests, syntax checks, desktop/mobile smoke tests, and production smoke tests on the final revision.
- [ ] Freeze the demo revision and record all evidence in `AUDIT.md`.

**Done when:** every major claim in the submission has a corresponding live result, transaction, test, or dated record.

---

## Explicitly deferred until the above is complete

- Trade execution, wallet custody, or automatic position management
- Mainnet payments
- Recurring subscriptions
- Multiple external specialists
- Native mobile application
- Decorative dashboard expansion

These features add risk without proving the current product. The next launch-path action is a buyer-side OKX.AI invocation of the published paid service to verify discovery, payment handoff, and delivered output without assuming the marketplace fee and endpoint challenge are a single charge. Production v0.8.8 is deployed and verified; the direct payment checklist is closed. Credential rotation in Stage 0 remains an unresolved security requirement.
