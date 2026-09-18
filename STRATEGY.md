# LiquidFlux Strategy: From Scanner to Orchestration Layer

## Market conclusion

The opportunity is not another standalone Hyperliquid data API. OKX.AI already contains services for analytics, risk, execution, fees, and autonomous workflows. Marketplace searches also show many component APIs, while no clear Hyperliquid-focused service-orchestration product appeared for the exact `service marketplace` query. Search is not proof of absence, so the product claim must remain narrow:

> Existing products expose individual analytics, risk, or execution capabilities. LiquidFlux coordinates specialist capabilities into a transparent Hyperliquid decision workflow.

Never claim that nobody else provides orchestration.

## Product definition

LiquidFlux is an agent-native orchestration layer for Hyperliquid. A caller states an objective and constraints. LiquidFlux selects specialist stages, runs them, records their evidence, and synthesizes one structured result. Execution remains outside the MVP and always requires explicit approval.

### MVP request

```json
{
  "objective": "market_neutral_income",
  "symbols": ["BTC", "ETH", "SOL"],
  "risk_tolerance": "moderate",
  "max_leverage": 2,
  "max_notional_usd": 1000
}
```

### MVP response

The response must include:

- Selected workflow and why it was selected
- Every specialist stage invoked
- Input and timestamp for each stage
- Funding analysis
- Liquidity and market-impact analysis
- Risk-policy decision
- Synthesized opportunities or a no-op result
- Conflicts between specialist outputs
- Data freshness and provenance
- Explicit statement that no trade was executed
- Next action requiring user approval

## Specialist model

The first version uses three first-party specialists derived from the existing live Hyperliquid snapshot:

1. **Funding Specialist**
   - Annualizes the current hourly funding snapshot
   - Filters by caller constraints
   - Never describes the result as forecast yield

2. **Liquidity Specialist**
   - Evaluates 24-hour notional volume, open-interest notional, and impact spread
   - Rejects or penalizes markets without adequate execution depth

3. **Risk Policy Specialist**
   - Applies maximum leverage, notional, freshness, basis, and liquidity rules
   - Returns deterministic `approve`, `caution`, or `reject`

These are separate deterministic capability modules, not falsely marketed as independent third-party agents.

## Router behavior

The router is useful only if it performs explicit coordination:

1. Parse a supported objective.
2. Build a workflow plan from a fixed registry.
3. Run independent specialist stages in parallel where safe.
4. Reject stale or incomplete evidence.
5. Reconcile conflicting outputs.
6. Produce a traceable synthesis.
7. Stop before execution and request explicit approval for any later action.

The MVP supports one objective well: `market_neutral_income`. Additional objectives are added only after this workflow is reliable.

## External-agent integration

After the first-party workflow works, add one real external OKX.AI service integration. The external provider must add non-duplicative evidence, such as wallet/whale behavior, vault intelligence, or cross-venue basis data.

Rules:

- Discover providers through OKX.AI rather than hardcoding an unverified brand claim.
- Pin the selected service identity and validate its response contract.
- Show provider name, service, fee, status, and evidence provenance.
- Never spend without an explicit budget and confirmation.
- Continue safely when an optional provider fails; fail closed when a required provider fails.
- Do not claim “agents hire agents” in the demo until a real provider call and payment are shown.

## OKX.AI service shape

LiquidFlux should eventually expose two complementary services under one ASP identity:

1. **A2MCP — Hyperliquid Funding Specialist**
   - Existing `POST /api/v1/funding-scan`
   - Free during integration validation
   - Deterministic, synchronous, machine-readable

2. **A2A — Hyperliquid Strategy Orchestrator**
   - Multi-step objective and constraint clarification
   - Coordinates specialist services
   - Produces a strategy report and approval boundary
   - Best home for future agent-to-agent purchasing

We register the existing A2MCP service first because it is already deployed. The A2A listing follows only after the router workflow exists.

## X Layer role

Do not build a custom vault contract yet. It introduces custody, allowance, accounting, and audit risk before the orchestration value is proven.

For the hackathon MVP, X Layer has a real role through OKX x402 settlement for paid specialist calls. If time remains after end-to-end orchestration works, add non-custodial service credits or a tightly bounded spending vault as a separate, reviewed milestone.

## What remains reusable

Nothing built so far is discarded:

- Hyperliquid adapter becomes the shared evidence source.
- Funding scanner becomes the Funding Specialist.
- Existing scoring functions seed Liquidity and Risk specialists.
- OpenAPI, validation, caching, rate limiting, tests, Docker, and Render remain the production foundation.
- The live A2MCP endpoint remains the first marketplace listing and a callable component of the router.

## Winning demo

1. Caller asks for a low-risk market-neutral Hyperliquid opportunity.
2. Router displays the workflow plan.
3. Funding, Liquidity, and Risk specialists run with timestamps.
4. Router rejects at least one superficially attractive but unsafe market.
5. Router synthesizes the surviving opportunity and explains conflicts.
6. Optional external OKX.AI specialist contributes distinct evidence.
7. x402 payment is shown for the external or premium specialist.
8. Router stops at an explicit execution-approval boundary.

This demonstrates agent coordination, monetization, safety, and a complete workflow without relying on unsafe autonomous trading.

## Immediate build sequence

1. Implement `POST /api/v1/orchestrate` for `market_neutral_income`.
2. Extract current calculations into Funding, Liquidity, and Risk specialist modules.
3. Add a fixed specialist registry and workflow trace.
4. Add deterministic synthesis and conflict reporting.
5. Publish and test the orchestrator endpoint.
6. Register the existing free A2MCP funding service with OKX.AI.
7. Add one real external OKX.AI provider integration.
8. Add x402 only after the free orchestration path is reproducible.
