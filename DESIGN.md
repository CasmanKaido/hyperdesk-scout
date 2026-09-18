<!-- SEED: re-run $impeccable document once there's code to capture the actual tokens and components. -->

---
name: LiquidFlux
description: Transparent, approval-gated Hyperliquid specialist workflows for evidence-led market analysis.
---

# Design System: LiquidFlux

## 1. Overview

**Creative North Star: "The Evidence Desk"**

LiquidFlux should feel like a composed analyst's workspace in clear daylight: evidence is easy to compare, workflow stages are visible, and every decision can be traced back to current market data. The interface earns confidence through hierarchy, legibility, provenance, and restrained interaction feedback rather than visual spectacle.

The system combines Stripe Dashboard's financial clarity, Linear's disciplined workflow states, and GitHub Actions' transparent execution traces. It explicitly rejects the urgency and red/green overload of a Binance Futures trading screen, the decorative glow and unexplained recommendations of a generic AI dashboard, and the undifferentiated density of a lifeless enterprise admin panel.

**Key Characteristics:**

- Evidence-led rather than signal-led
- Restrained color with unambiguous semantic states
- Visible specialist stages and provenance
- Responsive interaction without cinematic choreography
- Comfortable data density with clear decision hierarchy

## 2. Colors

A restrained palette uses a pure white working surface, deep ink, and a considered research green anchored near `oklch(0.650 0.150 145)`; exact production tokens will be resolved during implementation.

### Primary

- **Research Green** (`[to be resolved during implementation]`): Reserved for primary actions, active workflow stages, verified fresh evidence, and the LiquidFlux identity. It must occupy less than 10% of a typical screen.

### Secondary

- **Review Amber** (`[to be resolved during implementation]`): Reserved for caution, unresolved conflicts, and evidence that requires human review. It must never become a decorative second accent.

### Neutral

- **Clear White** (`[to be resolved during implementation]`): The primary workspace background; neutral rather than cream, beige, or blue-gray.
- **Evidence Surface** (`[to be resolved during implementation]`): A subtle neutral distinction for grouped evidence and workflow stages.
- **Deep Ink** (`[to be resolved during implementation]`): Primary text with at least 7:1 contrast against the workspace.
- **Measured Muted** (`[to be resolved during implementation]`): Secondary text that remains readable and never substitutes low contrast for sophistication.

**The Ten Percent Rule.** Research Green is rare enough to carry meaning. It never floods the dashboard or becomes a decorative glow.

**The Semantic Color Rule.** Green, amber, and rejection colors communicate state only when paired with explicit text and shape; color never carries meaning alone.

## 3. Typography

**Display Font:** Technical-humanist sans (`[font family to be chosen at implementation]`)
**Body Font:** Same technical-humanist sans (`[font family to be chosen at implementation]`)
**Label/Mono Font:** Monospaced companion (`[font family to be chosen at implementation]`)

**Character:** The interface uses one highly legible sans-serif family to keep analysis calm and coherent. Monospaced type appears only where fixed-width comparison improves comprehension: market values, timestamps, request IDs, and machine evidence.

### Hierarchy

- **Display** (`[to be resolved during implementation]`): Used sparingly for the current workflow objective or strongest synthesis outcome, never for decorative hero copy.
- **Headline** (`[to be resolved during implementation]`): Separates the constraint setup, workflow trace, evidence, and synthesis regions.
- **Title** (`[to be resolved during implementation]`): Names specialist stages, candidate markets, and decision groups.
- **Body** (`[to be resolved during implementation]`): Explanations and risk reasoning, capped near 70 characters per line.
- **Label** (`[to be resolved during implementation]`): Compact control labels and evidence metadata; sentence case rather than reflexive all-caps tracking.

**The Numbers Earn Mono Rule.** Monospaced type is reserved for values that benefit from alignment and auditability. It is never used as a blanket crypto aesthetic.

## 4. Elevation

LiquidFlux is flat by default. Depth comes from surface tone, spacing, and structural grouping rather than stacks of floating cards. Shadows, if implementation proves they are needed, appear only for temporary overlays or interactive elements lifted by state.

**The Flat Evidence Rule.** Persistent analytical surfaces remain on one plane. If every section looks like a floating card, the hierarchy has failed.

## 6. Do's and Don'ts

### Do:

- **Do** make the user's objective, constraints, and current workflow state immediately understandable.
- **Do** distinguish Funding, Liquidity, Risk, and Synthesis evidence without isolating every datum in a separate card.
- **Do** expose provenance, freshness, rejection reasons, conflicts, and the approval boundary alongside the decision they qualify.
- **Do** use short responsive transitions for input feedback and specialist-stage progress.
- **Do** support keyboard navigation, visible focus, reduced motion, and status communication beyond color.

### Don't:

- **Don't** imitate a Binance Futures trading screen with flashing prices, red/green overload, urgency, or gambling cues.
- **Don't** use generic AI-dashboard styling such as decorative glow, excessive gradients, glass cards, or unexplained AI recommendations.
- **Don't** build a lifeless enterprise admin panel with dense navigation, undifferentiated gray tables, and weak visual hierarchy.
- **Don't** use cream, sand, beige, or tinted-paper backgrounds as a shortcut to warmth.
- **Don't** turn every evidence group into an identical bordered card with a wide soft shadow.
- **Don't** animate layout or hide essential content behind entrance choreography.
