---
name: LiquidFlux
description: Transparent, approval-gated Hyperliquid specialist workflows for evidence-led market analysis.
colors:
  workspace: "oklch(1 0 0)"
  evidence-surface: "oklch(0.975 0.006 145)"
  evidence-surface-strong: "oklch(0.945 0.012 145)"
  deep-ink: "oklch(0.19 0.025 145)"
  measured-muted: "oklch(0.49 0.018 145)"
  evidence-line: "oklch(0.88 0.012 145)"
  research-green: "oklch(0.52 0.145 145)"
  research-green-dark: "oklch(0.42 0.13 145)"
  research-green-soft: "oklch(0.94 0.045 145)"
  review-amber: "oklch(0.58 0.14 75)"
  review-amber-soft: "oklch(0.955 0.045 82)"
  review-amber-chip: "oklch(0.91 0.075 82)"
  review-amber-ink: "oklch(0.37 0.1 65)"
  rejection-red: "oklch(0.5 0.17 28)"
  rejection-red-soft: "oklch(0.955 0.035 25)"
  avatar-ink: "oklch(0.1 0.01 145)"
typography:
  display:
    fontFamily: "Avenir Next, Avenir, Segoe UI, Helvetica Neue, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Avenir Next, Avenir, Segoe UI, Helvetica Neue, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Avenir Next, Avenir, Segoe UI, Helvetica Neue, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Avenir Next, Avenir, Segoe UI, Helvetica Neue, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Avenir Next, Avenir, Segoe UI, Helvetica Neue, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
  data:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  compact: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.research-green}"
    textColor: "{colors.workspace}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    height: "52px"
  input-default:
    backgroundColor: "{colors.workspace}"
    textColor: "{colors.deep-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "12px"
    height: "48px"
  chip-review:
    backgroundColor: "{colors.review-amber-soft}"
    textColor: "{colors.deep-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  panel:
    backgroundColor: "{colors.workspace}"
    textColor: "{colors.deep-ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: LiquidFlux

## 1. Overview

**Creative North Star: "The Evidence Desk"**

LiquidFlux is a composed analyst's workspace in clear daylight. Evidence is easy to compare, workflow stages remain visible, and every decision can be traced to current market data. Confidence comes from hierarchy, provenance, and restraint rather than decorative spectacle.

The system combines Stripe Dashboard's financial clarity, Linear's disciplined workflow states, and GitHub Actions' transparent execution traces. Its primary desktop composition uses a compact constraint rail beside a wider evidence workspace; mobile preserves the same information architecture in one deliberate column.

**Key Characteristics:**

- Evidence-led rather than signal-led
- Restrained semantic color on a true white workspace
- Visible specialist stages and provenance
- Fixed product typography with selective monospaced data
- Flat analytical surfaces with state-driven motion
- Responsive structure without hiding core evidence

## 2. Colors

The palette is restrained: Research Green carries brand and positive workflow state, Review Amber marks caution, Rejection Red marks policy failure, and slightly green-hued neutrals hold the workspace together.

### Primary

- **Research Green:** Primary actions, active workflow stages, policy-pass labels, and verified fresh evidence. It occupies less than 10% of a typical screen.
- **Research Green Dark:** Text and focus-adjacent treatments on pale green surfaces.
- **Research Green Soft:** Fresh-evidence summaries and selected controls.

### Secondary

- **Review Amber:** Caution states and unresolved conflicts.
- **Review Amber Soft:** Review-required banners and caution surfaces; never decorative.
- **Rejection Red:** Error marks and rejection labels.
- **Rejection Red Soft:** Full-surface rejection and recoverable error context.

### Neutral

- **Workspace:** The true white application background.
- **Evidence Surface:** First-level grouping for controls and disclosures.
- **Evidence Surface Strong:** Selected neutral controls and inactive chips.
- **Deep Ink:** Primary copy with AAA-level contrast on the workspace.
- **Measured Muted:** Secondary copy that remains above WCAG AA.
- **Evidence Line:** Hairline structure and dividers.

**The Ten Percent Rule.** Research Green is rare enough to retain meaning. It never floods the dashboard or becomes decorative glow.

**The Semantic Color Rule.** Green, amber, and red always pair with explicit text and shape. Color never carries state alone.

## 3. Typography

**Display Font:** Avenir Next with humanist system fallbacks
**Body Font:** The same technical-humanist UI stack
**Label/Mono Font:** SFMono-Regular with platform monospace fallbacks

**Character:** One readable sans-serif family keeps analysis calm and coherent. Monospaced type appears only where fixed-width comparison improves comprehension: values, timestamps, market symbols, workflow counts, and machine evidence.

### Hierarchy

- **Display** (700, 2.25rem, 1.12): Page objective on wider screens; the mobile step is 1.875rem.
- **Headline** (700, 1.5rem, 1.2): Constraint and evidence regions.
- **Title** (700, 1.1875rem, 1.25): Specialist stages and result sections.
- **Body** (400, 1rem, 1.5): Explanations and risk reasoning, capped near 68–70 characters where narrative.
- **Label** (700, 0.875rem, 1.4): Controls, state labels, and compact metadata.
- **Data** (700, 0.875rem, 1.5): Tabular values and identifiers.

**The Numbers Earn Mono Rule.** Monospaced type is reserved for values that benefit from alignment and auditability. It is never a blanket crypto aesthetic.

## 4. Elevation

LiquidFlux is flat by default. Depth comes from surface tone, spacing, and structural grouping. Persistent panels use full-perimeter hairlines without decorative shadow; temporary browser-level overlays would be the only surfaces allowed to lift.

**The Flat Evidence Rule.** Analytical surfaces remain on one plane. Candidates are divided comparison rows, not an identical grid of floating cards.

## 5. Components

### Buttons

- **Shape:** Compact and composed with gently curved corners (6px).
- **Primary:** Research Green fill, white text, 52px minimum height, and a specific verb-object label.
- **Hover / Focus:** Darker green on hover; a 3px Research Green focus ring with 3px offset; 1px active press translation.
- **Disabled:** Strong neutral fill with a wait cursor during analysis.

### Chips

- **Style:** Full-pill shape reserved for compact state and metadata labels.
- **State:** Every chip includes text; green means policy pass/fresh, amber means review, and red means rejected/error.

### Cards / Containers

- **Corner Style:** Main panels use 14px; disclosures use 10px.
- **Background:** White panels and softly tinted evidence disclosures.
- **Shadow Strategy:** None at rest.
- **Border:** One full-perimeter Evidence Line hairline on main panels only.
- **Internal Padding:** 24px desktop, structurally reduced on narrow viewports.

### Inputs / Fields

- **Style:** White fill, 48px height, 6px corners, and a visible neutral outline.
- **Focus:** Research Green border plus the global external focus ring.
- **Error / Disabled:** Pale rejection surface with explicit error text; never color alone.

### Navigation

- **Style:** A sticky, white utility header with the LiquidFlux avatar, product label, service status, OpenAPI, and GitHub links. Mobile preserves the brand and status dot while visually hiding the longer status label.

### Conversational Evidence Workflow

- **Conversation:** A bounded message thread is the primary input. User requests, AI replies, compact plan snapshots, and deterministic result summaries share one chronological surface.
- **Follow-ups:** Natural-language revisions carry the complete validated current plan; result questions carry only reduced current evidence. Unsupported requests stay conversational without creating new capabilities.
- **Manual fallback:** Detailed controls remain available in a disclosure and always reflect the active conversational plan.
- **Structure:** Conversation and constraints produce a pre-run service manifest: Funding and Liquidity in parallel, dependent Risk Policy, then deterministic Synthesis.
- **Plan Review:** Every service row exposes provider identity, marketplace status, fee, and whether the stage is connected, skipped, or first-party before approval.
- **Loading:** Named stages, a bounded progress orbit, and skeleton lines communicate active work without fake percentages.
- **Results:** Synthesis appears first, candidate rows follow, then workflow trace and expandable specialist evidence.
- **Boundary:** Every completed state repeats that candidates require review and execution is excluded.

## 6. Do's and Don'ts

### Do:

- **Do** make the objective, constraints, and current workflow state understandable within two seconds.
- **Do** expose provenance, freshness, conflicts, rejection reasons, and the approval boundary beside the decision they qualify.
- **Do** use the 4px-derived spacing scale and reserve 48px separation for major groups.
- **Do** use sentence-case labels and tabular numerals for comparable evidence.
- **Do** preserve 44px touch targets, visible focus, reduced motion, and local table scrolling.
- **Do** use short 100–250ms transitions only when they explain state.

### Don't:

- **Don't** imitate a Binance Futures trading screen with flashing prices, red/green overload, urgency, or gambling cues.
- **Don't** use generic AI-dashboard styling such as decorative glow, excessive gradients, glass cards, or unexplained AI recommendations.
- **Don't** build a lifeless enterprise admin panel with dense navigation, undifferentiated gray tables, and weak visual hierarchy.
- **Don't** use cream, sand, beige, or tinted-paper backgrounds as a shortcut to warmth.
- **Don't** use colored side stripes, gradient text, decorative grid backgrounds, nested cards, or identical card grids.
- **Don't** animate layout casually or hide essential content behind entrance choreography.
