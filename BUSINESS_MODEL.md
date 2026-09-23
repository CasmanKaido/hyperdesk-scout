# LiquidFlux Agent Business Model

Status: implemented seller rail (x402 v2, X Layer testnet) — **payments disabled by default** until operator secrets are configured. This document is the source of truth for what is sold, to whom, at what price, and why the model is credible.

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

Implemented in `src/payments.js` as a seller-side gate:

1. Buyer calls `POST /api/v1/research-report` without payment → `HTTP 402` with a base64 `PAYMENT-REQUIRED` header (x402 v2 `PaymentRequired`: scheme `exact`, CAIP-2 network, atomic amount, asset, `payTo`, timeout). The body nests the same payload under `payment_required` for clients that cannot read headers.
2. Buyer signs an EIP-3009 `transferWithAuthorization` and replays with a base64 `PAYMENT-SIGNATURE` header (`PaymentPayload`).
3. The server locally rejects malformed payloads and term mismatches (scheme/network/asset/payTo/amount) **before** any facilitator call, then delegates cryptographic verification and settlement to the configured facilitator (`POST /verify`, then `POST /settle`).
4. On settlement the report is released with a base64 `PAYMENT-RESPONSE` receipt header and `report.payment` metadata (network, asset, amount, payer, transaction hash).

Safety properties, enforced by code and covered in `test/payments.test.js`:

- **Fail closed.** Disabled or misconfigured gate → `503 payments_not_configured`, never a free report. Facilitator unreachable → `502`, never access.
- **Validate before charge.** Request input is validated and rate-limited before payment processing, so buyers are never charged for an invalid request.
- **Replay protection.** EIP-3009 nonces at the token contract level; settlement through the facilitator rejects reused authorizations.
- **No keys server-side.** The server holds no wallet or signing credentials — only a public receiving address and a facilitator URL.

### Configuration (operator)

Set in the deployment environment (Render dashboard), never in source:

| Variable | Purpose | Default |
|---|---|---|
| `X402_ENABLED` | Master switch | `false` |
| `X402_PAYTO_ADDRESS` | LiquidFlux receiving address (public) | — |
| `X402_NETWORK` | CAIP-2 network | `eip155:1952` (X Layer testnet) |
| `X402_ASSET_ADDRESS` | Payment token contract (USD₮0 on the chosen network) | — |
| `X402_FACILITATOR_URL` | Verification/settlement facilitator (https) | — |
| `X402_PRICE_RESEARCH_REPORT_ATOMIC` | Price in atomic units | `10000` (0.01 USD₮0) |
| `X402_MAX_TIMEOUT_SECONDS` | Authorization validity window | `300` |

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
| 2 | x402 seller rail implemented, tested, documented | **This change** |
| 3 | Configure testnet secrets; verify unpaid 402 → paid 200 → settlement receipt with the official OKX buyer flow; record testnet transaction evidence | Blocked on operator secrets (payTo address, USD₮0 testnet asset, facilitator URL) |
| 4 | Publish research report as a paid A2MCP service on OKX.AI; keep a free tier for discovery | After phase 3 |
| 5 | Mainnet (`eip155:196`) pricing review against measured AI/facilitator costs | After testnet evidence |
| 6 | Subscriptions (`period` scheme) for recurring research; outbound payments to independent specialist agents (LiquidFlux as buyer) | Deferred — requires distinct provider value and its own evidence |

## Metrics that matter

- 402 → paid conversion per buyer agent; settlement success rate
- AI cost per report vs. price (gross margin per call)
- Facilitator latency and failure rate (paid SLA risk)
- Marketplace invocations by service; evaluator ratings on OKX.AI
