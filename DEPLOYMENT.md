# Deployment

The selected initial provider is Render because it can deploy the existing Dockerfile directly from GitHub, provides managed HTTPS, health checks, logs, environment variables, and automatic deployments from `main`.

Creating the service is intentionally a manual authorization step: provider signup and plan selection may involve account or billing terms.

## Deploy on Render

1. Sign in to [Render](https://render.com/) with the GitHub account that can access `CasmanKaido/hyperdesk-scout`.
2. Open the Render dashboard and choose **New → Blueprint**.
3. Select `CasmanKaido/hyperdesk-scout`.
4. Render will detect `render.yaml` and the repository `Dockerfile`.
5. Review the selected plan and any displayed cost before approving creation.
6. Create the `hyperdesk-scout` web service.
7. Wait for the image build and `/health` health check to pass.
8. Copy the assigned HTTPS URL, such as `https://hyperdesk-scout.onrender.com`.
9. Replace the placeholder deployment URL in the README and OpenAPI `servers` list.

No secrets are needed for the current read-only service. Do not add OKX credentials until the later x402 milestone.

## Required verification

Set `SERVICE_URL` conceptually to the assigned HTTPS origin and run the equivalent requests with the literal URL.

### Health

```bash
curl -i https://YOUR-SERVICE.example/health
```

Expected: `HTTP 200` and:

```json
{"status":"ok","service":"hyperdesk-scout","version":"0.1.0"}
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

## Rollback

Render deploys from `main`. If a deployment is unhealthy, use Render's rollback function or revert the faulty Git commit and push the revert. Never rewrite shared `main` history.
