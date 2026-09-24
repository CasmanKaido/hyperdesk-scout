# LiquidFlux Agent Business Model

Status: implemented seller rail (x402 v2, X Layer testnet) — **enabled on the current production deployment** after authenticated facilitator support verification; still disabled by default in code until operator secrets and `X402_ENABLED=true` are configured. This document is the source of truth for what is sold, to whom, at what price, and why the model is credible.

## What LiquidFlux is

LiquidFlux is an Agent Service Provider (ASP) that sells **verifiable Hyperliquid market intelligence** to AI agents and human analysts. It does not sell trades, signals dressed as certainty, or execution. Every paid artifact is evidence plus a grounded interpretation, with explicit limitations.

## Product tiers

| Tier | Product | Endpoint | Price | Why it is priced this way |
|---|---|---|---|---|
| Free | Funding scan (snapshot) | `POST /api/v1/funding-scan` | Free | Cheap to serve (one cached upstream call, no AI). Top-of-funnel discovery on OKX.AI. |
| Free | Market overview (snapshot + short grounded answer) | `POST /api/v1/market-overview` | Free, rate-limited | Powers the public web workspace. Rate limits cap AI cost exposure. |
| Free | Market-neutral orchestrator | `POST /api/v1/orchestrate` | Free | Deterministic specialists, no AI cost. Demonstrates the workflow on OKX.AI. |
| **Paid** | **Hyperliquid research report** | `POST /api/v1/research-report` | **0.01 USD₮0** (testnet price, `10000` atomic units) per report | Real marginal cost: up to 5 symbols × (72h funding history + L2 book) upstream calls plus one grounded AI analysis. Real differentiated value: persistence, visible liquidity, canonical numeric findings, caveats. |

The paid report is the monetizable artifact because it is the only product with both (a) genuine marginal cost and (b) depth a buyer cannot get from the free snapshot tier.

## Payment rail — OKX Agent Payments Protocol (x402 v2)

Implemented in `src/payments.js` as a seller-side gate using the official pinned `@okxweb3/x402-core@0.1.0` `OKXFacilitatorClient` for authenticated facilitator calls:

1. Buyer calls `POST /api/v1/research-report` without payment → `HTTP 402` with a base64 `PAYMENT-REQUIRED` header (x402 v2 `PaymentRequired`: scheme `exact`, CAIP-2 network, atomic amount, asset, `payTo`, timeout). The body nests the same payload under `payment_required` for clients that cannot read headers.
2. Buyer signs an EIP-3009 `transferWithAuthorization` and replays with a base64 `PAYMENT-SIGNATURE` header (`PaymentPayload`).
3. The server locally rejects malformed payloads and term mismatches (scheme/network/asset/payTo/amount), requires the request fingerprint nested in the selected requirement's `extra.liquidfluxRequest` field, derives a non-logged operation identity, and binds the exact verified proof to the exact normalized symbols/question before calling the facilitator. The binding lives inside `accepts[]` because the official OKX buyer preserves that selected entry in `PAYMENT-SIGNATURE`; it does not echo unknown top-level challenge extensions.
4. The official OKX client signs and sends the facilitator verification request (`POST /api/v6/pay/x402/verify`) with the operator's API credential trio. Only after verification does LiquidFlux generate the complete report and persist the artifact in its operation store.
5. Report generation or pre-settlement storage failure abandons the operation without calling settlement. Once the artifact is ready, the facilitator settles (`POST /settle`). Immediate confirmed success releases the report with a base64 `PAYMENT-RESPONSE` receipt and `report.payment` metadata.
6. A `pending` response is persisted without releasing the report. A `timeout` carrying a transaction hash is persisted and polled through the official SDK's `getSettleStatus`; bounded polling or later exact retries can release only after confirmed `success`. Continued pending or status-service failure returns HTTP 202, while confirmed failure records terminal `settlement_failed`. Settlement exceptions or timeout without a hash remain ambiguous and are never blindly resubmitted.
7. A retry using the same authorization and exact request recovers the stored settled artifact without another verification or settlement call; using that authorization with changed symbols or question returns `authorization_request_mismatch`.

Safety properties, enforced by code and covered in `test/payments.test.js`:

- **Fail closed.** Disabled or misconfigured gate → `503 payments_not_configured`, never a free report. Facilitator unreachable → `502`, never access.
- **Validate and build before charge.** Request input is validated and rate-limited before verification; after verification, the full report is generated and persisted before settlement. Report-generation failure never invokes `/settle`.
- **Request-bound replay protection.** A hash of the authorization domain (`scheme/network/asset/payer/nonce`) and a digest of the complete verified proof are bound to the canonical request fingerprint echoed in `accepted.extra.liquidfluxRequest`. Changed-request or changed-proof replay is rejected; atomic state transitions permit one settlement owner; settled exact retries return the original artifact.
- **No sensitive payment logs.** Raw `PAYMENT-SIGNATURE`, signature, authorization, nonce, credentials, and upstream error bodies are not logged. The raw signed payload is removed from operation state after confirmed settlement or definitive failure.
- **No wallet keys server-side.** The server holds no seed phrase, private key, or buyer signing credential. It does hold least-privilege OKX Developer API credentials solely to authenticate facilitator `/supported`, `/verify`, and `/settle` requests; those values stay in deployment secrets and are never logged.

The default operation store is bounded, process-local memory: unused verified operations expire after 24 hours, while settling/failed/settled bindings are retained and new work is rejected at 1,000 operations rather than evicting replay evidence. It provides same-process lost-client-response and transaction-hash reconciliation for a small testnet proof but is not restart-safe, multi-instance-safe, or production-scalable. Before production/mainnet, replace it with a durable shared transactional store so authorization ownership and reconciliation survive restarts and coordinate across instances. A settlement exception or malformed timeout without a transaction hash remains blocked as `settlement_outcome_unknown`; LiquidFlux never blindly retries that authorization.

### Configuration (operator)

Set in the deployment environment (Render dashboard), never in source:

| Variable | Purpose | Default |
|---|---|---|
| `X402_ENABLED` | Master switch | `false` |
| `X402_PAYTO_ADDRESS` | LiquidFlux receiving address (public) | — |
| `X402_NETWORK` | CAIP-2 network | `eip155:1952` (X Layer testnet) |
| `X402_ASSET_ADDRESS` | Payment token contract (USD₮0 on the chosen network) | — |
| `X402_FACILITATOR_URL` | Official facilitator API base URL | `https://web3.okx.com` |
| `OKX_API_KEY` | Facilitator API key (secret) | — |
| `OKX_SECRET_KEY` | Facilitator HMAC secret (secret) | — |
| `OKX_API_PASSPHRASE` | Facilitator API passphrase (secret) | — |
| `X402_PRICE_RESEARCH_REPORT_ATOMIC` | Price in atomic units | `10000` (0.01 USD₮0) |
| `X402_MAX_TIMEOUT_SECONDS` | Authorization validity window | `300` |
| `X402_SETTLEMENT_POLL_ATTEMPTS` | Bounded status checks after a settlement timeout with a hash | `5` |
| `X402_SETTLEMENT_POLL_INTERVAL_MS` | Delay between settlement status checks | `1000` |

## Cost structure and unit economics (per paid report)

| Cost line | Driver | Estimate |
|---|---|---|
| AI analysis | 1 grounded analyst call (Gemini primary, Groq fallback), evidence-ledger prompt + completion | Fractions of a cent on current provider pricing |
| Hyperliquid data | Up to 11 upstream calls (meta + 5× funding history + 5× L2 book), cached 60s | Free (public API, rate-limit bound) |
| Facilitator | Per verify+settle | Facilitator-dependent; gas on X Layer is low and platform-sponsored for buyers |
| Infrastructure | Render free tier today | ~0 at hackathon scale |

A 0.01 USD₮0 test price proves the rail; production pricing should target a clear multiple over AI + facilitator cost per report (e.g. 0.05–0.25 USD₮0) and be revisited against measured provider spend. Honest constraint: at free-tier volumes the model is validated mechanically, not economically — revenue significance requires marketplace traffic.

## Distribution

1. **OKX.AI marketplace** (primary): Agent ID `13784`, approved and listed. Two free A2MCP services live today; the research report becomes the first paid A2MCP service once the gate is configured. The marketplace invoke flow handles the 402 challenge natively and hands payment to the OKX Agent Payments Protocol — no custom buyer UX needed.
2. **Direct API**: any x402-capable client (including `onchainos payment quote`) can probe, confirm, and pay the endpoint.
3. **Public web workspace**: free chat-first demo that funnels toward the API and marketplace listings.

## What we never sell

- No trade execution, custody, or strategy authorization. Review candidates are not execution approval.
- No forecasts presented as fact. Funding APR is snapshot/historical simple annualization; visible book depth is a bounded snapshot, not an executable quote.
- No invented evidence. Numeric findings are deterministic from the server-built ledger; AI prose is filtered and replaced by a deterministic fallback when rejected.

These boundaries are the brand: buyers pay for evidence they can audit, not confidence they cannot.

## Phased rollout

| Phase | Milestone | State |
|---|---|---|
| 1 | Free tier live on OKX.AI (funding scan, orchestrator) | Done (2026-09-18) |
| 2 | x402 seller rail, request-bound state machine, and bounded transaction-hash reconciliation implemented, tested, documented | Done locally; process-local durability only |
| 3 | Configure testnet secrets; verify unpaid 402 → paid 200 → settlement receipt with the official OKX buyer flow; record testnet transaction evidence | Gate enabled; authenticated facilitator support confirmed; buyer funded with 10 USD₮0; one pre-funding attempt failed closed without a transaction; fresh post-v0.8.7 proof remains |
| 4 | Publish research report as a paid A2MCP service on OKX.AI; keep a free tier for discovery | After phase 3 |
| 5 | Mainnet (`eip155:196`) pricing review against measured AI/facilitator costs | After testnet evidence |
| 6 | Subscriptions (`period` scheme) for recurring research; outbound payments to independent specialist agents (LiquidFlux as buyer) | Deferred — requires distinct provider value and its own evidence |

## Metrics that matter

- 402 → paid conversion per buyer agent; settlement success rate
- AI cost per report vs. price (gross margin per call)
- Facilitator latency and failure rate (paid SLA risk)
- Marketplace invocations by service; evaluator ratings on OKX.AI
