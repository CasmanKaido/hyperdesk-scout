# OKX.AI Integration

## Registered ASP

- **Agent name:** LiquidFlux
- **Agent ID:** `13784`
- **Role:** Agent Service Provider
- **Network:** X Layer
- **Registered service:** Hyperliquid Funding Specialist
- **Service type:** A2MCP
- **Fee:** Free
- **Endpoint:** https://hyperdesk-scout.onrender.com/api/v1/funding-scan

The service listing passed the local OKX listing validator with no findings before registration.

### Marketplace service description

```text
1. [Service Description] Scan Hyperliquid perpetual markets for funding opportunities and receive decision-ready evidence covering funding APR, spot-perp basis, liquidity, and risk—without executing trades.
2. [Parameter Spec] symbols(array of strings, optional): 1–50 Hyperliquid market symbols, defaults to BTC, ETH, and SOL; min_funding_apr(number, optional): minimum absolute annualized funding APR, defaults to 0; risk_tolerance(string, optional): risk profile for screening results—conservative, moderate, or aggressive—defaults to moderate.
3. [Request Method] POST
4. [Request Example] curl -X POST https://hyperdesk-scout.onrender.com/api/v1/funding-scan -H 'Content-Type: application/json' -d '{"symbols":["BTC","ETH","SOL"],"min_funding_apr":5,"risk_tolerance":"moderate"}'
```

The polished description passed OKX.AI listing validation with no findings and was published on 2026-09-18. X Layer update transaction: `0x81284f1062a2d4a0e5edfef877ceea2f947b6b18f931c53e9fb82d5c00e84db2`.

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
- **Registered services:** 1
- **Funding Specialist endpoint:** https://hyperdesk-scout.onrender.com/api/v1/funding-scan

## Buyer-side test identity

- **User name:** LiquidFlux Tester
- **User Agent ID:** `13785`
- **Communication status:** Ready

A live marketplace search by LiquidFlux Agent ID and exact service name returned the Hyperliquid Funding Specialist successfully. The next gate is explicit service selection followed by end-to-end A2MCP invocation.

Next steps are service invocation through OKX.AI and preservation of the returned marketplace evidence.
