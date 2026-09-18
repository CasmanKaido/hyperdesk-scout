# OKX.AI Integration

## Registered ASP

- **Agent name:** LiquidFlux
- **Agent ID:** `13784`
- **Role:** Agent Service Provider
- **Network:** X Layer
- **Registered services:** Hyperliquid Funding Specialist and Market-Neutral Orchestrator
- **Service type:** A2MCP
- **Fee:** Free
- **Funding endpoint:** https://hyperdesk-scout.onrender.com/api/v1/funding-scan
- **Orchestrator endpoint:** https://hyperdesk-scout.onrender.com/api/v1/orchestrate

The service listing passed the local OKX listing validator with no findings before registration.

### Marketplace service description

```text
1. [Service Description] Scan Hyperliquid perpetual markets for funding opportunities and receive decision-ready evidence covering funding APR, spot-perp basis, liquidity, and risk—without executing trades.
2. [Parameter Spec] symbols(array of strings, optional): 1–50 Hyperliquid market symbols, defaults to BTC, ETH, and SOL; min_funding_apr(number, optional): minimum absolute annualized funding APR, defaults to 0; risk_tolerance(string, optional): risk profile for screening results—conservative, moderate, or aggressive—defaults to moderate.
3. [Request Method] POST
4. [Request Example] curl -X POST https://hyperdesk-scout.onrender.com/api/v1/funding-scan -H 'Content-Type: application/json' -d '{"symbols":["BTC","ETH","SOL"],"min_funding_apr":5,"risk_tolerance":"moderate"}'
```

The polished description passed OKX.AI listing validation with no findings and was published on 2026-09-18. X Layer update transaction: `0x81284f1062a2d4a0e5edfef877ceea2f947b6b18f931c53e9fb82d5c00e84db2`.

### Market-Neutral Orchestrator

- **Marketplace service ID:** `491c8879-74b2-4804-9017-a34017ec623d`
- **Service type:** A2MCP
- **Fee:** Free
- **Endpoint:** https://hyperdesk-scout.onrender.com/api/v1/orchestrate
- **Published:** 2026-09-18
- **X Layer update transaction:** `0x50e2b52b3e31b74635c1976a3c09ea81a24d187ba57e6a71d44ddbdb6dd06609`

```text
1. [Service Description] Coordinate LiquidFlux funding, liquidity, risk, and deterministic synthesis stages into a traceable Hyperliquid market-neutral workflow that returns review candidates and rejection evidence without executing trades.
2. [Parameter Spec] objective(string, optional): supported objective market_neutral_income, defaults to market_neutral_income; symbols(array of strings, optional): 1–20 Hyperliquid market symbols, defaults to BTC, ETH, and SOL; risk_tolerance(string, optional): conservative, moderate, or aggressive, defaults to moderate; max_leverage(number, optional): leverage cap from 1–10, defaults to 2; max_notional_usd(number, optional): proposed notional greater than 0 and no more than 1000000, defaults to 1000; min_funding_apr(number, optional): minimum absolute annualized funding APR from 0–10000, defaults to 5.
3. [Request Method] POST
4. [Request Example] curl -X POST https://hyperdesk-scout.onrender.com/api/v1/orchestrate -H 'Content-Type: application/json' -d '{"objective":"market_neutral_income","symbols":["BTC","ETH","SOL"],"risk_tolerance":"moderate","max_leverage":2,"max_notional_usd":1000,"min_funding_apr":5}'
```

The orchestrator endpoint returned `HTTP 200` with fresh Hyperliquid evidence before publication, and the OKX.AI listing validator returned no findings. This listing accurately represents first-party specialist coordination; it does not claim external-agent hiring.

## Communication readiness

The OKX A2A runtime is installed under the user-owned `~/.local` prefix. Codex CLI `0.155.0` is installed, authenticated, and configured as the default provider.

The official readiness command completed successfully:

```bash
okx-a2a doctor --fix --json
```

Result: `ready: true`, with all eight checks passing. The daemon is running, autostart is installed, and one LiquidFlux agent identity is active.

The runtime provider can be changed later without recreating Agent ID `13784`.

## Marketplace review

LiquidFlux was submitted for OKX.AI marketplace listing review in English on 2026-09-18 and has been approved.

Current marketplace state:

- **Agent status:** Active
- **Approval:** Listed — eligible for task recommendations
- **Category:** Finance
- **Registered services:** 2
- **Funding Specialist endpoint:** https://hyperdesk-scout.onrender.com/api/v1/funding-scan
- **Market-Neutral Orchestrator endpoint:** https://hyperdesk-scout.onrender.com/api/v1/orchestrate

## Buyer-side test identity

- **User name:** LiquidFlux Tester
- **User Agent ID:** `13785`
- **Communication status:** Ready

A live marketplace search by LiquidFlux Agent ID and exact service name returned the Hyperliquid Funding Specialist successfully.

## End-to-end A2MCP invocation

On 2026-09-18, `LiquidFlux Tester` selected and invoked the Funding Specialist through the OKX.AI A2MCP flow. This was an OKX.AI marketplace invocation, not a direct `curl` request.

Verified result:

- **Confirmation:** Explicit free-service confirmation completed
- **HTTP method:** `POST`
- **HTTP result:** `200`
- **Fee:** Free
- **Data source:** Hyperliquid mainnet
- **Data status:** Fresh
- **Default query:** BTC, ETH, and SOL; moderate risk tolerance; 0% minimum funding APR
- **Returned opportunities:** BTC, ETH, and SOL
- **Snapshot funding APR:** 10.95% for each returned market at invocation time
- **Generated at:** `2026-09-18T11:43:12.737Z`
- **Request ID:** `3dc87444-ee1a-475d-a9ac-c450ebbe798b`
- **Execution:** None

The structured result was delivered synchronously in the same OKX.AI interaction without manual setup. Funding can reverse, and the returned annualized rate is a snapshot rather than a forecast.

Next steps are invoking the Market-Neutral Orchestrator through the buyer-side OKX.AI flow, preserving visual evidence, and later publishing or integrating additional independent specialist services. Additional services must provide distinct evidence and must not be added merely to inflate the service count.
