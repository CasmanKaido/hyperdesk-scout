# HyperDesk Scout

HyperDesk Scout is a read-only Hyperliquid funding intelligence API designed to be published as an OKX AI A2MCP service. It returns deterministic, machine-readable funding, basis, liquidity, and risk metrics.

- **Live API:** https://hyperdesk-scout.onrender.com
- **Health:** https://hyperdesk-scout.onrender.com/health
- **OpenAPI:** https://hyperdesk-scout.onrender.com/openapi.json

## Why this shape

The OKX A2MCP guide defines a service as an HTTPS API that takes parameters and returns a clear result. A free endpoint returns HTTP 200 directly; x402 can be added with the OKX Payment SDK after the service is deployed and validated.

## Run

Requires Node.js 20 or newer and no third-party packages.

```bash
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

Funding scan:

```bash
curl -X POST http://localhost:3000/api/v1/funding-scan \
  -H 'Content-Type: application/json' \
  -d '{"symbols":["BTC","ETH","SOL"],"min_funding_apr":5,"risk_tolerance":"moderate"}'
```

## API

The machine-readable OpenAPI 3.1 contract is available in [`openapi.json`](openapi.json) and is served at `GET /openapi.json`.

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

Current milestone: **M1 — Production API hardening**. We will freeze and test the public API contract before deployment, OKX AI registration, and x402 payments.

## Sources

- OKX A2MCP guide: https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp
- OKX Payment SDK: https://web3.okx.com/onchainos/dev-docs/payments/service-seller-sdk
- Hyperliquid perpetual info API: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals
- Hyperliquid rate limits: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits
