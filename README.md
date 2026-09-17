# HyperDesk Scout

HyperDesk Scout is a read-only Hyperliquid funding intelligence API designed to be published as an OKX AI A2MCP service. It returns deterministic, machine-readable funding, basis, liquidity, and risk metrics.

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

### `POST /api/v1/funding-scan`

Input fields:

- `symbols`: 1–50 Hyperliquid market names; defaults to BTC, ETH, and SOL.
- `min_funding_apr`: non-negative absolute annualized funding threshold; defaults to 0.
- `risk_tolerance`: `conservative`, `moderate`, or `aggressive`; defaults to `moderate`.

The endpoint calls Hyperliquid's documented `metaAndAssetCtxs` info request. Current funding is treated as an hourly rate and annualized as `rate × 24 × 365`; this is a snapshot, not a forecast.

## Validation

```bash
npm test
npm run check
```

## Roadmap

1. Deploy this free endpoint over public HTTPS and register it as an OKX AI A2MCP service.
2. Validate the end-to-end OKX AI request flow.
3. Add a paid endpoint using the official OKX x402 middleware on X Layer testnet (`eip155:1952`).
4. Add a bounded, non-executing trade preview endpoint.

## Sources

- OKX A2MCP guide: https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp
- OKX Payment SDK: https://web3.okx.com/onchainos/dev-docs/payments/service-seller-sdk
- Hyperliquid perpetual info API: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals
- Hyperliquid rate limits: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits
