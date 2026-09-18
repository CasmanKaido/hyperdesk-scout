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
