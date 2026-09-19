# LiquidFlux

## Chat-first workspace

The conversation is the main interface. Ask a market question or request a strategy; LiquidFlux presents the relevant confirmation inline. Market answers lead with readable facts and source freshness, while calculations, limitations, candidate comparisons, and specialist traces remain expandable. Earlier results stay in the thread as collapsed snapshots. Manual strategy controls and resource links are under **Tools & service details**.

Local UI verification: `node scripts/browser-smoke.js` runs bounded desktop (1440×1000) and mobile (390×844) Chrome checks using fixture planner replies and market data. It checks both flows, archived evidence, duplicate IDs, runtime errors, and horizontal overflow. Requires Google Chrome at the standard macOS application path; screenshots go to ignored `.tmp/`. This checks UI behavior, not live-model accuracy.

LiquidFlux is a read-only Hyperliquid information and strategy-analysis service distributed through OKX.AI. Its product goal is conversational market information without an implicit strategy, plus separately reviewed market-neutral strategy analysis. Deterministic first-party Funding, Liquidity, Risk, and Synthesis modules process market evidence; configured AI providers interpret requests and explain supplied context.

**Status (2026-09-19):** `market_information`, `POST /api/v1/market-overview`, and short-reply support are implemented locally. All 62 automated tests and syntax/JSON checks pass; a direct live Hyperliquid BTC overview also passed. This is not live AI or browser visual verification. Strategy approval is a browser workflow, not API authorization. No external paid specialist, payment, or trade execution is implemented. See [`AUDIT.md`](AUDIT.md) for code-grounded gaps and validation requirements. The URLs and marketplace records below are historical project references, not freshly verified by this audit.

- **Live dashboard:** https://hyperdesk-scout.onrender.com
- **Live API origin:** https://hyperdesk-scout.onrender.com
- **Health:** https://hyperdesk-scout.onrender.com/health
- **OpenAPI:** https://hyperdesk-scout.onrender.com/openapi.json
- **Conversational planner:** `POST https://hyperdesk-scout.onrender.com/api/v1/plan` — provider-backed intent/planning endpoint; current deployment behavior was not reverified in this audit
- **Orchestrator:** `POST https://hyperdesk-scout.onrender.com/api/v1/orchestrate`
- **OKX.AI ASP:** LiquidFlux, Agent ID `13784` — Funding Specialist and Market-Neutral Orchestrator published as free A2MCP services

## Product direction

Existing marketplace products already expose individual Hyperliquid analytics, risk, and execution capabilities. LiquidFlux is therefore evolving from a standalone scanner into the orchestration layer that selects specialist stages, combines their evidence, reports conflicts, and stops at an explicit execution-approval boundary.

[`OKX_AI.md`](OKX_AI.md) records free Funding Specialist and Market-Neutral Orchestrator A2MCP publication and buyer-side invocations on 2026-09-18. These records support distribution of LiquidFlux's own services, not third-party specialist hiring or a new production verification. In code, the orchestrator calls local modules directly; it does not invoke them through OKX.AI. [`STRATEGY.md`](STRATEGY.md) contains the broader direction, including future A2A/payment ideas; [`AUDIT.md`](AUDIT.md) distinguishes these from implemented behavior.

![LiquidFlux analysis workspace](assets/screenshots/dashboard-result.png)

## Dashboard

The dependency-free dashboard is served by the existing Node service. Its conversational workspace calls `POST /api/v1/plan` to create, refine, or explain the active plan, but it calls `POST /api/v1/orchestrate` only after explicit plan approval. It includes:

- An in-session, bounded natural-language conversation with Gemini preferred when configured and Groq fallback; real Gemini adapter compatibility remains unverified by this audit
- Follow-up plan revisions that preserve validated current constraints
- Evidence-grounded questions after analysis using a reduced, bounded result context
- Compact plan summaries in the conversation plus editable deterministic controls and a manual fallback
- A real objective-and-constraints workflow for market-neutral Hyperliquid income analysis
- Pre-run specialist planning with provider identity, OKX.AI listing status, service cost, and explicit approval
- Honest separation between the marketplace-listed Funding Specialist, first-party modules, and the unconnected external-service slot
- Stage-aware loading, actionable errors, first-run guidance, and no-op outcomes
- Candidate and rejection reasoning before raw specialist evidence
- Expandable Funding, Liquidity, and Risk outputs with the complete structured response
- Visible provenance, freshness, workflow trace, and execution-approval boundary
- Responsive desktop and mobile layouts, keyboard focus, and reduced-motion support

No wallet connection, paid specialist call, or trade execution is included. The planner itself does not fetch market data, but can receive client-supplied result context. The browser review action does not run market analysis; approving it calls the free first-party orchestration endpoint. Direct API callers can call that endpoint without an approval receipt. Gemini/Groq usage can incur operator costs and sends submitted context to configured providers, including fallback; it is separate from marketplace fees or future x402 spend.

## Run

Requires Node.js 20 or newer and no third-party packages.

```bash
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

AI-assisted objective planning (requires at least one configured provider key):

```bash
curl -X POST http://localhost:3000/api/v1/plan \
  -H 'Content-Type: application/json' \
  -d '{"message":"Find a low-risk market-neutral opportunity using no more than $1,000"}'
```

Orchestrated market-neutral analysis:

```bash
curl -X POST http://localhost:3000/api/v1/orchestrate \
  -H 'Content-Type: application/json' \
  -d '{"objective":"market_neutral_income","symbols":["BTC","ETH","SOL"],"risk_tolerance":"moderate","max_leverage":2,"max_notional_usd":1000}'
```

Funding specialist:

```bash
curl -X POST http://localhost:3000/api/v1/funding-scan \
  -H 'Content-Type: application/json' \
  -d '{"symbols":["BTC","ETH","SOL"],"min_funding_apr":5,"risk_tolerance":"moderate"}'
```

## API

The machine-readable OpenAPI 3.1 contract is available in [`openapi.json`](openapi.json) and is served at `GET /openapi.json`.

### `POST /api/v1/plan`

Uses configured providers in preference order (Gemini, then Groq by default). Requests contain `message` and optionally up to 12 user/assistant `conversation` turns, a complete validated `current_plan`, and bounded `analysis_context`. The planner does not fetch Hyperliquid data and returns `execution_included: false`.

**Intent-specific contract:** `market_information` returns symbols/topics without a financial strategy; only `plan_update` returns complete strategy constraints and `suggested_defaults`. Other intents include result explanation, clarification, and unsupported requests. Short replies must resolve against context without turning information into a strategy. Provider/model identity and concise replies accompany results. Only plan updates carry a specialist plan. The compatibility flag `approval_required` remains metadata; the browser separately confirms free information fetches and reviews strategy runs. Default disclosure is model-reported, not independently established field provenance.

If neither key is configured, the endpoint returns `503 ai_unavailable`; the dashboard remains usable through its manual controls. If all configured providers fail, it returns the opaque `502 ai_provider_unavailable` error without exposing provider responses or keys.

### `POST /api/v1/market-overview`

The local implementation accepts required `symbols` (1–50) and optional `topics` drawn from `funding`, `basis`, `liquidity`, and `risk`. It returns a read-only snapshot with `query`, `evidence`, per-market `facts`, `calculations`, and `notices`, plus `execution_included: false`. Missing values are null, not synthetic zeroes. It does not accept investment constraints or rank strategy candidates. Browser integration, OpenAPI alignment, tests, and deployment must be validated together before treating this as a released capability.

### `POST /api/v1/orchestrate`

This free read-only endpoint does not require a server-issued approval token. The dashboard supplies the separate review step. Coordinates the Funding and Liquidity specialists in parallel, then applies the dependent Risk Policy specialist and deterministic synthesis.

Input fields:

- `objective`: currently only `market_neutral_income`; defaults to that value.
- `symbols`: 1–20 Hyperliquid perpetual market names; defaults to BTC, ETH, and SOL.
- `risk_tolerance`: `conservative`, `moderate`, or `aggressive`; defaults to `moderate`.
- `max_leverage`: service constraint from 1–10; defaults to 2.
- `max_notional_usd`: proposed maximum notional, greater than 0 and no more than 1,000,000; defaults to 1,000.
- `min_funding_apr`: absolute annualized snapshot threshold; defaults to 5.

The response includes the workflow plan, specialist trace, provenance, specialist evidence, conflicts, approved/caution candidates, rejected candidates, and the next approval-boundary action. It always returns `execution_included: false`.

### `POST /api/v1/funding-scan`

Input fields:

- `symbols`: 1–50 Hyperliquid market names; defaults to BTC, ETH, and SOL.
- `min_funding_apr`: non-negative absolute annualized funding threshold; defaults to 0.
- `risk_tolerance`: `conservative`, `moderate`, or `aggressive`; defaults to `moderate`.

The endpoint calls Hyperliquid's documented `metaAndAssetCtxs` info request. Current funding is treated as an hourly rate and annualized as `rate × 24 × 365`; this is a snapshot, not a forecast.

Responses include `market_data.fetched_at`, `age_ms`, `cache_status`, and `fetch_duration_ms`. Fresh data is cached briefly to protect the upstream API. If a refresh fails, bounded cached data may be returned with `data_status: "stale"`; data older than `MARKET_DATA_MAX_AGE_MS` is rejected.

## Runtime configuration

Set the following values in the process or deployment environment. `npm start` does not load a `.env` file automatically. Never commit provider secrets.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listen port |
| `HYPERLIQUID_API_URL` | `https://api.hyperliquid.xyz` | Hyperliquid API base URL |
| `HYPERLIQUID_TIMEOUT_MS` | `5000` | Upstream request timeout |
| `MARKET_DATA_CACHE_TTL_MS` | `10000` | Fresh cache lifetime |
| `MARKET_DATA_MAX_AGE_MS` | `30000` | Maximum stale fallback age |
| `RATE_LIMIT_MAX_REQUESTS` | `60` | Requests allowed per client/window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `CORS_ALLOW_ORIGIN` | `*` | Allowed browser origin; restrict for a private frontend |
| `GEMINI_API_KEY` | unset | Server-side Gemini key; never expose it to browser code or commit it |
| `GROQ_API_KEY` | unset | Server-side Groq fallback key; never expose it to browser code or commit it |
| `AI_PROVIDER_ORDER` | `gemini,groq` | Ordered provider preference; unconfigured providers are skipped |
| `AI_PLANNER_TIMEOUT_MS` | `15000` | Timeout applied separately to each configured AI provider |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Gemini planner model override |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Groq planner model override |

## Deployment

The initial deployment target is Render's **Free web-service plan**. The repository includes `render.yaml` with `plan: free` and a detailed authorization and verification checklist in [`DEPLOYMENT.md`](DEPLOYMENT.md).

The recorded deployment URL is https://hyperdesk-scout.onrender.com; its current revision and behavior were not checked in this audit. Render Free instances may sleep when idle, so check `/health` before a demo. Health alone does not verify provider, market-data, or marketplace functionality.

## Container

```bash
docker build -t hyperdesk-scout .
docker run --rm -p 3000:3000 hyperdesk-scout
```

The image includes a health check against `/health` and runs as the unprivileged `node` user.

## Evidence and security limitations

- Funding annualization is a snapshot, not a forecast. Basis is mark/oracle deviation, not an executable hedged spread; liquidity/risk scores are heuristics, not fill guarantees or loss probabilities.
- All internal specialists share one snapshot. Local fetch timestamps do not establish exchange event time. Fees, borrow/hedge availability, funding persistence, and net strategy return are not established.
- Existing strategy scoring can coerce invalid numeric inputs to zero; the new overview's null handling does not fix that path. Strategy missing-evidence handling remains a priority.
- Conversation and evidence context are supplied by the client and bounded, but not authenticated. Prompt instructions and output schemas do not prove factual grounding or injection resistance.
- Browser history is in-memory and truncated, not durable storage. Public routes have rate limiting but no user authentication; CORS is not authorization.
- Gemini tests mock the expected response shape; real endpoint/model compatibility and fallback causes require separate provider verification.

## Validation

Local integration validation: 62/62 tests passed, syntax/JSON checks passed, and a direct live BTC overview returned Hyperliquid evidence on 2026-09-19. Frontend flow tests use a simulated DOM and mocked planner responses; real provider understanding, visual layout, and deployment need separate verification:

```bash
npm test
npm run check
```

## Roadmap

The ordered build plan, acceptance criteria, prerequisites, and current next task are maintained in [`ROADMAP.md`](ROADMAP.md).

Current work prioritizes validating conversational information versus separately reviewed strategy, preserving default provenance, and documenting evidence/security boundaries before further demo claims. Historical OKX.AI records describe free first-party distribution. A paid external specialist remains intentionally deferred until a relevant independent provider works through the official invocation path with explicit budget approval and distinct evidence.

## Sources

- OKX A2MCP guide: https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp
- OKX Payment SDK: https://web3.okx.com/onchainos/dev-docs/payments/service-seller-sdk
- Hyperliquid perpetual info API: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals
- Hyperliquid rate limits: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits
