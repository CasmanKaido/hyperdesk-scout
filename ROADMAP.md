# HyperDesk Scout Execution Roadmap

This is the project's source of truth for build order. Work on one milestone at a time. A milestone is complete only when every exit criterion is satisfied.

## Status legend

- `[x]` Complete
- `[>]` In progress
- `[ ]` Not started
- `[!]` Blocked or needs a decision

## Current position

**Completed:** M0 — Read-only funding scanner

**Next:** M1 — Production API hardening

**Why M1 is next:** We need a reliable service contract before deployment, OKX AI registration, or payment middleware. Changing the response after marketplace registration would create avoidable rework.

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
- [!] Docker image starts and passes its health check — Docker is not installed in the current environment
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
- [ ] Create production service through the Render dashboard
- [ ] Configure or confirm environment variables
- [ ] Deploy from the GitHub `main` branch
- [ ] Confirm HTTPS certificate
- [ ] Confirm `GET /health` from outside the development machine
- [ ] Confirm `POST /api/v1/funding-scan` returns live data
- [ ] Configure uptime monitoring
- [ ] Record deployment URL in `README.md`

### Exit criteria

- [ ] Public endpoint returns `HTTP 200`
- [ ] Three consecutive live scans succeed
- [ ] Invalid input returns the documented `HTTP 400` shape
- [ ] Upstream failure returns a documented `502` or `504`
- [ ] Deployment URL is stable and documented

**Next after completion:** M3 — Free OKX AI A2MCP registration.

---

## M3 — Free OKX AI A2MCP integration

**Goal:** Demonstrate that OKX AI can discover and call HyperDesk end to end.

### Build

- [ ] Confirm current ASP registration fields with official documentation or hackathon support
- [ ] Prepare service name, description, category, endpoint, input fields, and example output
- [ ] Register the free funding scan endpoint
- [ ] Register a test user through the OKX AI debugging flow
- [ ] Invoke HyperDesk from OKX AI
- [ ] Confirm parameters arrive correctly
- [ ] Confirm structured results are returned without manual setup
- [ ] Save service/listing URL
- [ ] Capture screenshots or a short recording as evidence

### Exit criteria

- [ ] A real OKX AI request reaches the public endpoint
- [ ] The result is delivered in the same interaction
- [ ] The OKX AI listing or integration URL is public and documented
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

- [ ] Create a focused web interface or polished CLI
- [ ] Show live opportunities and risk flags
- [ ] Show the OKX AI invocation
- [ ] Show the unpaid and paid request flow
- [ ] Add an optional natural-language explanation generated from structured results
- [ ] Keep all numerical controls deterministic
- [ ] Add loading, empty, stale-data, and failure states
- [ ] Add a visible informational-use disclaimer

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
| First OKX AI service type | A2MCP | Funding scans are standardized parameter-in/result-out tasks |
| Initial Hyperliquid access | Read-only | Safest way to prove value and integration |
| Initial pricing mode | Free | Validate the marketplace workflow before adding payment dependencies |
| Payment network | X Layer testnet first | Demonstrate x402 without risking real funds |
| Execution | Deferred | Not necessary until analytics, payment, and safety controls are stable |

## Working rule

When a milestone is completed:

1. Mark its tasks and exit criteria complete.
2. Record evidence such as URLs, test output, screenshots, or transaction hashes.
3. Update the **Current position** section.
4. Start only the next milestone unless a blocker requires parallel work.
