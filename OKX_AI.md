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

## Communication readiness blocker

The ASP identity was created successfully, but the required OKX A2A communication readiness check could not run. Installing `@okxweb3/a2a-node` globally failed with an `EACCES` permission error while writing under `/usr/local/lib/node_modules`, and the `okx-a2a` command is therefore unavailable.

Do not claim A2A communication readiness until the official recovery command completes and reports `ready: true`:

```bash
okx-a2a doctor --fix --json
```

After the environment is repaired, continue with listing review, test-user registration, and end-to-end OKX.AI invocation.
