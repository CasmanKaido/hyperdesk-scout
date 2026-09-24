# OKX.AI Integration

## Registered ASP

- **Agent name:** LiquidFlux
- **Agent ID:** `13784`
- **Role:** Agent Service Provider
- **Network:** X Layer
- **Registered services:** Hyperliquid Funding Specialist, Market-Neutral Orchestrator, and Hyperliquid Research Report
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
- **Registered services:** 3
- **Funding Specialist endpoint:** https://hyperdesk-scout.onrender.com/api/v1/funding-scan
- **Market-Neutral Orchestrator endpoint:** https://hyperdesk-scout.onrender.com/api/v1/orchestrate
- **Hyperliquid Research Report endpoint:** https://hyperdesk-scout.onrender.com/api/v1/research-report

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

## End-to-end Orchestrator invocation

On 2026-09-18, the buyer-side OKX.AI flow discovered and invoked the free Market-Neutral Orchestrator using its marketplace service record. This was an official OKX.AI A2MCP invocation rather than a direct endpoint request.

Verified result:

- **Service:** Market-Neutral Orchestrator
- **Marketplace service ID:** `491c8879-74b2-4804-9017-a34017ec623d`
- **Provider Agent ID:** `13784`
- **Confirmation:** Explicit free-service confirmation completed
- **HTTP method:** `POST`
- **HTTP result:** `200`
- **Fee:** Free
- **Request parameters:** `{}`; documented service defaults applied
- **Default constraints:** BTC, ETH, and SOL; moderate risk; 2× leverage; $1,000 maximum notional; 5% minimum funding APR
- **Data source:** Hyperliquid mainnet
- **Data status:** Fresh
- **Workflow:** Funding and Liquidity completed in parallel; Risk completed after stage one; deterministic Synthesis completed last
- **Result:** Three review candidates and no conflicts
- **Generated at:** `2026-09-18T21:55:42.400Z`
- **Request/workflow ID:** `b1eb7e58-9107-4b5d-bd14-83325c7fff9e`
- **Approval required:** Yes
- **Execution:** None

The synchronous result preserved the complete workflow plan, trace, provenance, constraints, specialist evidence, synthesis, and safety disclaimer. The next product milestone is adding a genuinely independent marketplace-callable specialist; the current result proves distribution of the first-party orchestrator, not external-agent hiring.

Next steps are preserving visual evidence and later publishing or integrating additional independent specialist services. Additional services must provide distinct evidence and must not be added merely to inflate the service count.

## Paid service: Hyperliquid Research Report

The business model and seller rail are documented in [`BUSINESS_MODEL.md`](BUSINESS_MODEL.md). `POST /api/v1/research-report` is LiquidFlux's first paid service: x402 v2 on X Layer testnet (`eip155:1952`), with a 0.01 USD₮0 endpoint challenge per complete report. Two direct official buyer tests completed with distinct transactions, settlement reconciliation, and delivered reports; v0.8.8 additionally prevents settlement when grounded AI synthesis is unavailable.

### Marketplace publication — 2026-09-24

- **Provider:** LiquidFlux Agent `13784`
- **Marketplace service:** Hyperliquid Research Report
- **Service ID:** `e10c7cee-41fd-4c6c-a11a-37b0e780b43b`
- **Service type:** A2MCP
- **Marketplace fee:** 0.01 USDT per call
- **Endpoint:** https://hyperdesk-scout.onrender.com/api/v1/research-report
- **Method:** `POST`
- **Parameters:** `symbols` is required (one symbol or 1–5 symbols); `question` is optional
- **Update transaction:** `0x58ba919edabb37737b3d185ba0a5f54bb4f7e251e350ac7a129de38c427099ac`

The official listing validator returned no findings, the deployed endpoint returned its expected HTTP 402 challenge before publication, the service appeared as the third service in LiquidFlux's live catalog, and an exact marketplace service search returned it publicly. The two existing free services were preserved.

The marketplace record displays 0.01 USDT using marketplace token `0x779ded0c9e1022225f8e0630b35a9b54be713736`, while the endpoint challenge currently requests 0.01 USD₮0 on X Layer testnet using `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c`. A buyer-side marketplace probe on 2026-09-24 proved discovery, A2MCP routing, parameter collection, and delivery of `symbols=BTC` to the endpoint. It then stopped before authorization because the endpoint's testnet USD₮0 asset is unsupported by the marketplace invocation path. No marketplace payment or report delivery is claimed. Two direct official payment flows remain the settlement evidence; mainnet/token alignment is deferred rather than rushed for submission.
