# LiquidFlux — Ordered Execution Checklist

This is the working order from the current `0.8.0` state. Complete each numbered stage before starting the next unless it is explicitly marked parallel. Do not claim a stage is complete without its listed evidence.

## Current baseline

- [x] Chat-first workspace
- [x] Live Hyperliquid snapshot data
- [x] 72-hour funding and visible L2-book research
- [x] Grounded AI analyst with deterministic numeric findings and fallback
- [x] First-party Funding, Liquidity, Risk, and Synthesis specialists
- [x] Two free services distributed through OKX.AI
- [x] x402 v2 paid research endpoint implemented and locally tested
- [ ] Paid endpoint enabled in production
- [ ] Live testnet payment completed
- [ ] Paid research service published on OKX.AI
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

- [ ] Confirm `GET /health` reports `0.8.0`.
- [ ] Confirm the homepage and chat load on desktop and mobile.
- [ ] Confirm free market information still works with a live provider.
- [ ] Confirm strategy review → approval → orchestration still works.
- [ ] Confirm `POST /api/v1/research-report` returns `503 payments_not_configured` while payments are disabled.
- [ ] Record date, revision, provider/model, request IDs, and results in `AUDIT.md`.

**Done when:** production behavior—not only local tests—matches the `0.8.0` contract.

## Stage 2 — Harden payment correctness before enabling it

**Why before a live payment:** the current implementation settles before generating the report. If Hyperliquid or the AI fails after settlement, a buyer could pay without receiving the resource.

- [ ] Split payment processing into `challenge`, `verify`, and `settle` phases.
- [ ] For a signed request: verify authorization → generate report → settle → release report.
- [ ] Never settle when report generation fails.
- [ ] Add idempotency/recovery for “settled successfully but HTTP response was lost.”
- [ ] Bind cached paid results to payment nonce/transaction and exact request parameters.
- [ ] Reject replay with different symbols/question.
- [ ] Avoid logging raw payment signatures or authorization payloads.
- [ ] Add tests for upstream failure after verification, settlement failure, duplicate replay, mismatched replay, and lost-response recovery.
- [ ] Update OpenAPI and `BUSINESS_MODEL.md` to match the final sequence.

**Done when:** automated tests prove a buyer is not charged for a report-generation failure and a settled buyer can recover the same report safely.

## Stage 3 — Configure X Layer testnet payments

Required operator values:

- [ ] Choose and verify the LiquidFlux receiving EVM address.
- [ ] Confirm the official USD₮0 testnet contract address and decimals.
- [ ] Confirm a compatible facilitator URL supporting x402 v2 `exact` on `eip155:1952`.
- [ ] Fund the buyer test wallet with test USD₮0 if required.
- [ ] Configure Render secrets:
  - [ ] `X402_PAYTO_ADDRESS`
  - [ ] `X402_ASSET_ADDRESS`
  - [ ] `X402_FACILITATOR_URL`
  - [ ] `X402_ENABLED=true`
- [ ] Keep the initial price at `10000` atomic units (0.01 USD₮0) for the proof.

**Done when:** `/api/v1/research-report` returns a valid live `HTTP 402` challenge with the intended network, token, amount, and recipient.

## Stage 4 — Prove the complete paid flow

Use the official OKX buyer/payment flow; do not manually construct signatures.

- [ ] Quote the paid endpoint with a valid research request.
- [ ] Verify the confirmation card shows the correct network, token, amount, and recipient.
- [ ] Explicitly confirm the payment.
- [ ] Complete testnet verification and settlement.
- [ ] Confirm the replay returns `HTTP 200` and the requested research report.
- [ ] Decode and verify the `PAYMENT-RESPONSE` receipt.
- [ ] Record transaction hash, request ID, timestamp, revision, and sanitized result.
- [ ] Repeat once to demonstrate reliability and distinct nonces.
- [ ] Test an invalid/mismatched payment and confirm access remains blocked.

**Done when:** there is reproducible evidence of `402 → confirmation → settlement → 200 report` on X Layer testnet.

## Stage 5 — Publish the paid service on OKX.AI

- [ ] Define accurate marketplace copy for “Hyperliquid Research Report.”
- [ ] State 1–5 symbols, optional question, price, evidence included, and no execution.
- [ ] Register the paid endpoint as an A2MCP service under LiquidFlux Agent `13784`.
- [ ] Validate the listing with the official validator.
- [ ] Discover it from the buyer identity in a clean session.
- [ ] Invoke and pay through the OKX.AI marketplace flow—not direct `curl`.
- [ ] Record service ID, invocation evidence, payment receipt, and delivered result in `OKX_AI.md`.

**Done when:** another agent can discover, pay for, and receive the report through OKX.AI.

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

These features add risk without proving the current product. The next immediate action is **Stage 0: rotate exposed provider credentials**, followed by production verification and payment hardening.
