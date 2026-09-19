# Product

## Register

product

## Platform

web

## Users

LiquidFlux serves crypto traders and analysts who want to understand Hyperliquid markets conversationally and, separately, evaluate market-neutral opportunities. Information requests should receive sourced facts without requiring investment constraints. Strategy requests should lead to an editable plan, explicit review, and deterministic specialist evidence.

AI agents and developers are a secondary audience. They consume the same structured evidence, provenance, workflow trace, and explicit approval boundary through the API.

Hackathon judges are demo observers rather than the product's primary audience. The interface should demonstrate the real analyst workflow clearly enough that its value is evident without becoming a presentation-only site.

## Product Purpose

The chatbot is the product’s primary workspace: one centered conversation, a persistent composer, and contextual research actions. There is no always-visible orchestration dashboard. LiquidFlux coordinates the next step; users inspect and confirm proposals inline. Supporting evidence and specialist activity are expandable, and manual controls are a secondary fallback under Tools & service details.

LiquidFlux has two distinct product journeys:

1. **Market information:** “Tell me about BTC” requests Hyperliquid facts and clearly labeled calculations, not a strategy. Follow-ups such as “yes” or “funding” retain the resolved information scope. No risk tolerance, leverage, or investment budget is required.
2. **Strategy review:** An explicit market-neutral strategy request creates or revises editable constraints. User values must remain distinct from suggested defaults. The user separately reviews the first-party specialist plan before running Funding, Liquidity, Risk, and deterministic Synthesis. Policy-pass, caution, and rejected candidates are review outcomes, not execution authorization.

Implementation status (2026-09-19): the information intent, `POST /api/v1/market-overview`, and short replies are integrated locally with automated flow coverage. Live AI understanding and deployed behavior require separate verification. The existing strategy approval step is enforced by the browser flow, not by an approval credential on the public API. No payment or trade execution is implemented. See [`AUDIT.md`](AUDIT.md) for code evidence and priorities.

Success means a user can run a live analysis, understand how the result was produced, inspect data freshness and risk evidence, and distinguish an actionable review candidate from a misleading headline funding rate. The product never implies that snapshot funding is guaranteed yield and never executes a trade in the current MVP.

## Positioning

Conversational Hyperliquid information and separately reviewed strategy analysis, powered by deterministic first-party specialists. OKX.AI is a distribution channel for LiquidFlux services, not evidence that independent external agents run the workflow. Paid external specialists are deferred.

## Brand Personality

Precise, transparent, and composed. LiquidFlux should communicate technical confidence and institutional discipline without aggression. Its voice should be concise, evidence-led, and candid about uncertainty, stale data, conflicts, and limitations.

## Anti-references

LiquidFlux should not resemble a retail trading terminal built around flashing prices, red/green overload, urgency, or gambling cues. It should avoid generic AI-dashboard styling such as decorative glow, excessive gradients, glass cards, and unexplained AI recommendations. It should also avoid becoming a lifeless enterprise admin panel with dense navigation, undifferentiated gray tables, and weak visual hierarchy.

## Design Principles

1. **Separate information from strategy.** Answer information requests without creating a strategy. Before a strategy run, expose the selected first-party stages, provider identity, dated marketplace status, service fee, and review boundary; after the call, preserve the evidence trace.
2. **Make safety visible.** The no-execution boundary, approval requirement, and market-data limitations should be clear without dominating the workflow.
3. **Prioritize the analyst's decision.** Inputs, candidate comparison, rejection reasons, and next actions matter more than decorative metrics.
4. **Separate evidence from interpretation.** Funding, liquidity, risk, and synthesis should remain distinguishable so users can challenge the result.
5. **Keep AI in its lane.** Configured providers may interpret intent, revise a validated plan, and explain supplied evidence. Deterministic code validates constraints and calculates evidence; the current browser manages strategy review. Model output validation is not factual verification, and client-supplied context is not authenticated evidence.
6. **Demonstrate the real product.** Show actual data, timestamps, limitations, and provider identity. Distinguish inspected code, passing local tests, historical deployment records, and fresh production verification; never substitute one for another.

## Accessibility & Inclusion

Target WCAG 2.2 AA contrast. Support keyboard navigation, visible focus states, reduced-motion preferences, and responsive layouts without horizontal page overflow. Communicate statuses through text and shape in addition to color so the workflow remains understandable for users with color-vision differences.
