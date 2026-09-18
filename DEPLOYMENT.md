# Deployment

The selected initial provider is Render because it can deploy the existing Dockerfile directly from GitHub, provides managed HTTPS, health checks, logs, environment variables, and automatic deployments from `main`.

The Blueprint explicitly selects Render's `free` web-service plan. According to Render's current documentation, free web services receive 750 instance hours per workspace each month. If no payment method is attached, exceeding included usage suspends the service instead of generating overage charges. Always confirm that the dashboard still displays **Free / $0** before approving service creation.

Creating the service remains a manual authorization step because you must accept Render's account terms and confirm the selected plan.

## Deploy on Render

1. Sign in to [Render](https://render.com/) with the GitHub account that can access `CasmanKaido/hyperdesk-scout`.
2. Open the Render dashboard and choose **New → Blueprint**.
3. Select `CasmanKaido/hyperdesk-scout`.
4. Render will detect `render.yaml` and the repository `Dockerfile`.
5. Confirm the service plan is **Free / $0**. Do not proceed if Render selects a paid plan.
6. Create the `hyperdesk-scout` web service.
7. Wait for the image build and `/health` health check to pass.
8. Copy the assigned HTTPS URL, such as `https://hyperdesk-scout.onrender.com`.
9. Replace the placeholder deployment URL in the README and OpenAPI `servers` list.

No secrets are needed for the current read-only service. Do not add OKX credentials until the later x402 milestone.

## Free-plan limitations

Render spins down a free web service after 15 minutes without inbound traffic. The first request after spin-down can take about one minute while the service starts. For judging or a live demo, call `/health` a few minutes before presenting and verify the funding scan is warm. Free services also have monthly instance-hour, bandwidth, and build-minute allowances; inspect usage in the Render dashboard. The service has no persistent local state, so ephemeral storage is acceptable.

## Required verification

Set `SERVICE_URL` conceptually to the assigned HTTPS origin and run the equivalent requests with the literal URL.

### Health

```bash
curl -i https://YOUR-SERVICE.example/health
```

Expected: `HTTP 200` and:

```json
{"status":"ok","service":"hyperdesk-scout","version":"0.2.1"}
```

### OpenAPI contract

```bash
curl -i https://YOUR-SERVICE.example/openapi.json
```

Expected: `HTTP 200` and an OpenAPI document with version `3.1.0`.

### Live funding scan

```bash
curl -i -X POST https://YOUR-SERVICE.example/api/v1/funding-scan \
  -H 'Content-Type: application/json' \
  -d '{"symbols":["BTC","ETH","SOL"],"min_funding_apr":0,"risk_tolerance":"aggressive"}'
```

Expected: `HTTP 200`, `data_source: "Hyperliquid mainnet"`, and a non-empty `opportunities` array when those markets are available.

Run this three times. The first request should normally report `cache_status: "miss"`; requests inside the cache TTL should report `cache_status: "hit"`.

### Validation error

```bash
curl -i -X POST https://YOUR-SERVICE.example/api/v1/funding-scan \
  -H 'Content-Type: application/json' \
  -d '{"symbols":[]}'
```

Expected: `HTTP 400` with `error: "invalid_request"`.

## Evidence to record

After deployment, update `ROADMAP.md` and `README.md` with:

- Public HTTPS service URL
- Render deployment status
- Date and time of verification
- Results of three live scans
- Link to service logs or a screenshot, if suitable for the submission package

## Verified deployment

- **Service URL:** https://hyperdesk-scout.onrender.com
- **Verified at:** 2026-09-17 15:21 UTC
- **Health:** `HTTP 200`
- **OpenAPI:** `HTTP 200`, OpenAPI `3.1.0`
- **Live scan:** `HTTP 200`, fresh Hyperliquid mainnet data, BTC/ETH/SOL returned
- **Validation:** empty symbols returned `HTTP 400`
- **Cache sequence:** `miss`, `hit`, `hit` across three consecutive successful scans
- **Container verification:** Render successfully built the Dockerfile and passed `/health`
- **Orchestrator version:** `0.2.0`, verified 2026-09-17 17:19 UTC
- **Orchestration endpoint:** `POST /api/v1/orchestrate` returned `HTTP 200`
- **Workflow trace:** Funding and Liquidity completed in stage 1; Risk completed in stage 2; deterministic synthesis completed in stage 3
- **Safety boundary:** `execution_included: false` and `approval_required: true`
- **Live provenance:** fresh Hyperliquid mainnet snapshot with BTC, ETH, and SOL evidence

## Rollback

Render deploys from `main`. If a deployment is unhealthy, use Render's rollback function or revert the faulty Git commit and push the revert. Never rewrite shared `main` history.
