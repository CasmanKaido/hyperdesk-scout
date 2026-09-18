# HyperDesk Scout

HyperDesk is a read-only Hyperliquid specialist-orchestration service for OKX.AI. Its first deployed specialist, HyperDesk Scout, returns deterministic funding, basis, liquidity, and risk evidence; the next API coordinates Funding, Liquidity, and Risk specialists into a traceable market-neutral workflow.

- **Service index:** https://hyperdesk-scout.onrender.com
- **Live API origin:** https://hyperdesk-scout.onrender.com
- **Health:** https://hyperdesk-scout.onrender.com/health
- **OpenAPI:** https://hyperdesk-scout.onrender.com/openapi.json
- **Orchestrator:** `POST https://hyperdesk-scout.onrender.com/api/v1/orchestrate`
- **OKX.AI ASP:** LiquidFlux, Agent ID `13784` — listed and eligible for task recommendations

## Product direction

Existing marketplace products already expose individual Hyperliquid analytics, risk, and execution capabilities. HyperDesk is therefore evolving from a standalone scanner into the orchestration layer that selects specialist stages, combines their evidence, reports conflicts, and stops at an explicit execution-approval boundary.

The deployed funding scanner remains useful as the first A2MCP specialist and is registered under the LiquidFlux ASP identity. See [`STRATEGY.md`](STRATEGY.md) for the validated positioning, narrow router MVP, safety boundary, and external-agent integration plan, and [`OKX_AI.md`](OKX_AI.md) for marketplace integration status.

## Run

Requires Node.js 20 or newer and no third-party packages.

```bash
npm start
```

Health check:

```bash
curl http://localhost:3000/health
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

### `POST /api/v1/orchestrate`

Coordinates the Funding and Liquidity specialists in parallel, then applies the dependent Risk Policy specialist and deterministic synthesis.

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

Copy `.env.example` values into your deployment environment. Do not commit a real `.env` file.

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

## Deployment

The initial deployment target is Render's **Free web-service plan**. The repository includes `render.yaml` with `plan: free` and a detailed authorization and verification checklist in [`DEPLOYMENT.md`](DEPLOYMENT.md).

The service is deployed at https://hyperdesk-scout.onrender.com. Free instances sleep after 15 minutes idle and can take about one minute to wake, so warm `/health` before a demo.

## Container

```bash
docker build -t hyperdesk-scout .
docker run --rm -p 3000:3000 hyperdesk-scout
```

The image includes a health check against `/health` and runs as the unprivileged `node` user.

## Validation

```bash
npm test
npm run check
```

## Roadmap

The ordered build plan, acceptance criteria, prerequisites, and current next task are maintained in [`ROADMAP.md`](ROADMAP.md).

Current milestone: **M3 — Hyperliquid orchestration MVP and free OKX.AI integration**. The first router workflow is implemented locally and will be verified on the public deployment before marketplace registration.

## Sources

- OKX A2MCP guide: https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp
- OKX Payment SDK: https://web3.okx.com/onchainos/dev-docs/payments/service-seller-sdk
- Hyperliquid perpetual info API: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals
- Hyperliquid rate limits: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits
