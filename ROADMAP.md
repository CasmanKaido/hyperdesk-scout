# LiquidFlux Execution Roadmap

This is the project's source of truth for build order. Work on one milestone at a time. A milestone is complete only when every exit criterion is satisfied.

## Status legend

- `[x]` Complete
- `[>]` In progress
- `[ ]` Not started
- `[!]` Blocked or needs a decision

## Current position

**Completed:** M0 — Read-only funding scanner; M1 — Production API hardening (GitHub Actions remains externally blocked by account billing); M2 — Public HTTPS deployment

**In progress:** M3 — Hyperliquid orchestration MVP and free OKX.AI integration; M6 — Demo interface

**Next:** Record the 2–4 minute demo showing the production conversation, approval gate, live evidence, and verified OKX.AI orchestrator invocation; then diagnose why Gemini currently hands off to the working Groq fallback. A paid external specialist is deferred until a relevant provider succeeds through the official OKX.AI invocation path; LiquidFlux will not force an unsafe or incompatible integration merely to claim multi-agent orchestration.

---

## M0 — Read-only funding scanner

**Goal:** Prove we can turn live Hyperliquid data into structured, deterministic intelligence.

- [x] Initialize Git and GitHub repository
- [x] Add `GET /health`
- [x] Add `POST /api/v1/funding-scan`
- [x] Integrate Hyperliquid `metaAndAssetCtxs`
- [x] Calculate funding APR and mark/oracle basis
- [x] Add deterministic liquidity, opportunity, and risk scores
- [x] Add validation, timeouts, and stable JSON errors
- [x] Add unit tests and documentation

**Exit criteria:** Tests pass, syntax checks pass, and the expected fields are confirmed against a live Hyperliquid response.

---

## M1 — Production API hardening

**Goal:** Freeze a dependable API contract suitable for public deployment and OKX AI registration.

### Build

- [x] Add an OpenAPI 3.1 specification
- [x] Add response schemas and request examples
- [x] Add dependency-injected HTTP handler tests without requiring a listening socket
- [x] Add a short-lived in-memory cache to reduce Hyperliquid API pressure
- [x] Add cache age and upstream fetch time to responses
- [x] Mark bounded fallback data `stale` and reject it after the configured threshold
- [x] Add request logging with request ID, latency, status, and no sensitive data
- [x] Add graceful shutdown
- [x] Add explicit CORS policy
- [x] Add rate limiting for the public endpoint
- [x] Add a Dockerfile and container health check
- [x] Add continuous integration for tests and syntax checks

### Exit criteria

- [x] `npm test` passes
- [x] `npm run check` passes
- [x] OpenAPI required fields are contract-tested against actual handler responses
- [x] Upstream timeout and malformed-response paths are tested
- [x] Repeated scans use the cache within its TTL
- [x] Docker image starts and passes its health check on Render
- [!] GitHub Actions passes on `main` — blocked because GitHub reports the account is locked due to a billing issue; no workflow step was started

**Next after completion:** M2 — Public HTTPS deployment.

---

## M2 — Public HTTPS deployment

**Goal:** Produce a stable URL that OKX AI and judges can call.

### Decision required

Selected target: **Render Free web service using the repository Dockerfile**. The Blueprint explicitly requests `plan: free`. Render provides managed HTTPS, environment variables, logs, health checks, and GitHub-based redeployment. Free instances sleep after 15 minutes idle and may take about one minute to wake. Service creation remains a manual authorization step so the dashboard can be checked for **Free / $0** before approval.

### Build

- [x] Select deployment provider: Render
- [x] Add `render.yaml` infrastructure configuration
- [x] Add deployment and verification documentation
- [x] Create production service through the Render dashboard
- [x] Configure or confirm environment variables
- [x] Deploy from the GitHub `main` branch
- [x] Confirm HTTPS certificate
- [x] Confirm `GET /health` from outside the development machine
- [x] Confirm `POST /api/v1/funding-scan` returns live data
- [x] Configure Render's `/health` service health check
- [x] Record deployment URL in `README.md`

### Exit criteria

- [x] Public endpoint returns `HTTP 200`
- [x] Three consecutive live scans succeed (`miss`, `hit`, `hit`)
- [x] Invalid input returns the documented `HTTP 400` shape
- [x] Upstream failure behavior is covered by automated `502` and `504` tests
- [x] Deployment URL is stable and documented

**Next after completion:** M3 — Free OKX AI A2MCP registration.

---

## M3 — Hyperliquid orchestration MVP and free OKX.AI integration

**Goal:** Differentiate LiquidFlux as a transparent coordinator of specialist Hyperliquid capabilities, then prove that OKX.AI can call it end to end.

### Router build

- [x] Validate the orchestration positioning against live marketplace searches without claiming market exclusivity
- [x] Define the narrow product and safety boundary in `STRATEGY.md`
- [x] Add `POST /api/v1/orchestrate`
- [x] Support the first objective: `market_neutral_income`
- [x] Extract Funding, Liquidity, and Risk specialist modules
- [x] Add a fixed specialist registry and explicit workflow plan
- [x] Run independent Funding and Liquidity specialists in parallel
- [x] Add evidence provenance, timestamps, and workflow trace
- [x] Add deterministic synthesis and conflict reporting
- [x] Return `execution_included: false` and an explicit approval boundary
- [x] Add OpenAPI schemas and contract tests
- [x] Deploy and verify the orchestration endpoint

### OKX.AI integration

- [x] Confirm current ASP registration fields with the official CLI workflow
- [x] Confirm ASP name, one-sentence description, and avatar
- [x] Prepare and validate the free A2MCP service listing
- [x] Register LiquidFlux ASP Agent ID `13784` and the free funding specialist
- [x] Publish the free Market-Neutral Orchestrator A2MCP service
- [x] Initialize OKX A2A communication with Codex; official doctor reports `ready: true`
- [x] Submit LiquidFlux Agent `13784` for English marketplace review
- [x] Receive marketplace approval — active and eligible for task recommendations
- [x] Register LiquidFlux Tester User Agent ID `13785`
- [x] Discover the Funding Specialist through a live OKX.AI marketplace search
- [x] Invoke LiquidFlux from OKX.AI
- [x] Confirm default parameters arrive correctly
- [x] Confirm structured results are returned without manual setup
- [ ] Save service/listing URL
- [x] Invoke the Market-Neutral Orchestrator through OKX.AI from the buyer test identity
- [!] Add one real, non-duplicative external OKX.AI specialist integration — deferred after live searches found no suitable current Hyperliquid service and the strongest free candidate failed the official A2MCP transport check
- [ ] Later: publish additional independent Liquidity or Risk services only when they add distinct marketplace-callable evidence
- [ ] Capture screenshots or a short recording as evidence

### Exit criteria

- [x] One live orchestration request produces a traceable Funding → Liquidity → Risk workflow
- [x] Automated orchestration tests reject an unsafe candidate with deterministic evidence
- [x] A real OKX.AI request reaches the public endpoint
- [x] The result is delivered in the same interaction
- [ ] The OKX.AI listing or integration URL is public and documented
- [ ] The workflow can be repeated from a clean session

**Next after completion:** M4 — x402 payment on X Layer testnet.

---

## M4 — Paid A2MCP endpoint on X Layer testnet

**Goal:** Prove the business model using the official OKX Payment SDK before using real funds.

### Prerequisites

- [ ] OKX Developer Portal API key
- [ ] OKX API secret and passphrase stored only as deployment secrets
- [ ] EVM receiving address
- [ ] X Layer testnet gas and test USD₮0

### Build

- [ ] Add official OKX x402 dependencies
- [ ] Keep `/health` free
- [ ] Keep a free sample or limited scan for discovery
- [ ] Add a paid detailed scan route
- [ ] Configure X Layer testnet `eip155:1952`
- [ ] Configure a small test price
- [ ] Verify an unpaid call returns `HTTP 402`
- [ ] Verify the `PAYMENT-REQUIRED` response header
- [ ] Complete payment with the supported OKX buyer flow
- [ ] Verify the paid request is replayed and returns `HTTP 200`
- [ ] Verify settlement receipt
- [ ] Document the payment flow and security model

### Exit criteria

- [ ] Unpaid request consistently returns a valid challenge
- [ ] Paid replay consistently returns the resource
- [ ] No credentials appear in source code or logs
- [ ] Testnet transaction or settlement evidence is recorded

**Next after completion:** M5 — Trade preview.

---

## M5 — Bounded trade preview

**Goal:** Turn an opportunity into a safe, non-executing plan.

### Build

- [ ] Define `POST /api/v1/trade-preview`
- [ ] Validate symbol, direction, notional, leverage, and slippage
- [ ] Reject leverage above market and service limits
- [ ] Estimate entry from current market data
- [ ] Estimate fees and slippage
- [ ] Estimate liquidation distance with clearly documented assumptions
- [ ] Add invalidation conditions and risk flags
- [ ] Return `execution_included: false`
- [ ] Add unit and contract tests
- [ ] Publish as a second OKX AI capability

### Exit criteria

- [ ] Unsafe requests are rejected deterministically
- [ ] Every result states its assumptions and data timestamp
- [ ] No wallet or signing key is required
- [ ] OKX AI can request and receive a preview

**Next after completion:** M6 — Demo product and optional AI explanation.

---

## M6 — Demo interface and AI explanation

**Goal:** Make the service understandable in a 2–4 minute judging demo.

- [x] Create a focused web interface or polished CLI
- [x] Show live opportunities and risk flags
- [ ] Show the OKX AI invocation
- [ ] Show the unpaid and paid request flow
- [x] Add provider-neutral natural-language objective planning with Gemini primary and Groq fallback
- [x] Replace the one-shot objective form with a persistent conversational planning workspace
- [x] Support natural-language plan revisions using the validated current plan
- [x] Support evidence-grounded result questions using bounded analysis context
- [x] Verify create → revise → analyze → explain conversation against production
- [x] Configure production provider keys and verify a successful Groq fallback plan
- [x] Validate AI-generated constraints before displaying or using them
- [x] Preserve explicit human approval and manual fallback when AI is unavailable
- [x] Add an optional natural-language explanation generated from structured results
- [x] Keep all numerical controls deterministic
- [x] Add loading, empty, stale-data, and failure states
- [x] Add a visible informational-use disclaimer

**Exit criteria:** A new user can complete the main workflow without developer assistance.

**Next after completion:** M7 — Submission package.

---

## M7 — Hackathon submission package

**Goal:** Deliver a complete and verifiable Build a Company submission.

- [ ] Finalize public GitHub README
- [ ] Add architecture diagram
- [ ] Add API documentation and live examples
- [ ] Add security and limitations section
- [ ] Add deployment URL
- [ ] Add OKX AI listing/integration URL
- [ ] Document work completed during the hackathon
- [ ] Record a 2–4 minute demo video
- [ ] Verify every link in a private/incognito browser
- [ ] Complete submission form before the deadline

**Exit criteria:** Every submission link is public, functional, and reproducible.

---

## Optional M8 — Permissioned execution

Do this only if M0–M7 are complete and stable.

- [ ] Use a dedicated Hyperliquid API Agent Key
- [ ] Never request withdrawal capability
- [ ] Encrypt secrets at rest
- [ ] Add symbol allowlists
- [ ] Add maximum notional and leverage policies
- [ ] Require explicit user confirmation per order
- [ ] Add slippage limits, idempotency, audit logs, and a kill switch
- [ ] Start on Hyperliquid testnet
- [ ] Obtain a focused security review

Execution is not required for a compelling hackathon demo. A reliable paid intelligence and preview product is preferable to unsafe or incomplete automation.

---

## Decisions log

| Decision | Choice | Reason |
| --- | --- | --- |
| Primary hackathon track | Build a Company | Core product is an agent/API service distributed through OKX AI |
| Product position | Hyperliquid specialist orchestrator | Individual analytics APIs are crowded; coordination and synthesis are the differentiated workflow |
| First OKX AI service type | A2MCP | The existing funding specialist is already a standardized parameter-in/result-out task |
| Second OKX AI service type | A2A | Multi-step strategy orchestration requires clarification, coordination, and an approval boundary |
| Initial Hyperliquid access | Read-only | Safest way to prove value and integration |
| Initial pricing mode | Free | Validate the marketplace workflow before adding payment dependencies |
| Payment network | X Layer testnet first | Demonstrate x402 without risking real funds |
| Custom X Layer vault | Deferred | x402 provides a real X Layer role without introducing custody and contract-audit risk |
| Execution | Deferred | Not necessary until orchestration, payment, and safety controls are stable |

## Working rule

When a milestone is completed:

1. Mark its tasks and exit criteria complete.
2. Record evidence such as URLs, test output, screenshots, or transaction hashes.
3. Update the **Current position** section.
4. Start only the next milestone unless a blocker requires parallel work.
