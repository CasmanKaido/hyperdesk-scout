# Product

## Register

product

## Platform

web

## Users

LiquidFlux primarily serves crypto traders and analysts evaluating market-neutral opportunities on Hyperliquid. Their main job is to set investment and risk constraints, run a live specialist workflow, inspect the evidence behind each decision, and determine whether an opportunity deserves further review.

AI agents and developers are a secondary audience. They consume the same structured evidence, provenance, workflow trace, and explicit approval boundary through the API.

Hackathon judges are demo observers rather than the product's primary audience. The interface should demonstrate the real analyst workflow clearly enough that its value is evident without becoming a presentation-only site.

## Product Purpose

LiquidFlux turns a natural-language objective and current Hyperliquid market data into a traceable market-neutral orchestration workflow. An AI planner may translate the user's request into editable, validated constraints; the user then reviews the specialist and provider plan, approves its service budget, and receives deterministic Funding, Liquidity, Risk, and Synthesis evidence. The workflow identifies policy-pass, caution, and rejected candidates and stops before execution.

Success means a user can run a live analysis, understand how the result was produced, inspect data freshness and risk evidence, and distinguish an actionable review candidate from a misleading headline funding rate. The product never implies that snapshot funding is guaranteed yield and never executes a trade in the current MVP.

## Positioning

LiquidFlux turns live Hyperliquid market data into transparent, approval-gated specialist workflows—not black-box trading signals.

## Brand Personality

Precise, transparent, and composed. LiquidFlux should communicate technical confidence and institutional discipline without aggression. Its voice should be concise, evidence-led, and candid about uncertainty, stale data, conflicts, and limitations.

## Anti-references

LiquidFlux should not resemble a retail trading terminal built around flashing prices, red/green overload, urgency, or gambling cues. It should avoid generic AI-dashboard styling such as decorative glow, excessive gradients, glass cards, and unexplained AI recommendations. It should also avoid becoming a lifeless enterprise admin panel with dense navigation, undifferentiated gray tables, and weak visual hierarchy.

## Design Principles

1. **Show the orchestration.** Before any call, expose the selected specialists, provider identity, marketplace status, service fee, and approval boundary; after the call, preserve the evidence trace.
2. **Make safety visible.** The no-execution boundary, approval requirement, and market-data limitations should be clear without dominating the workflow.
3. **Prioritize the analyst's decision.** Inputs, candidate comparison, rejection reasons, and next actions matter more than decorative metrics.
4. **Separate evidence from interpretation.** Funding, liquidity, risk, and synthesis should remain distinguishable so users can challenge the result.
5. **Keep AI in its lane.** Gemini or Groq may interpret intent and explain assumptions, but deterministic code validates constraints, calculates market evidence, and enforces the approval boundary.
6. **Demonstrate the real product.** The interface should run the deployed workflow rather than acting as a static hackathon presentation.

## Accessibility & Inclusion

Target WCAG 2.2 AA contrast. Support keyboard navigation, visible focus states, reduced-motion preferences, and responsive layouts without horizontal page overflow. Communicate statuses through text and shape in addition to color so the workflow remains understandable for users with color-vision differences.
