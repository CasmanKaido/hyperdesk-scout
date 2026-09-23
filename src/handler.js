import { randomUUID } from "node:crypto";
import { UpstreamError } from "./hyperliquid.js";
import { buildFundingScan, validateScanInput, ValidationError } from "./service.js";
import { orchestrateMarketNeutral, validateOrchestrationInput } from "./orchestrator.js";
import { PlannerError } from "./ai-planner.js";
import { validateMarketOverviewInput } from "./market-overview.js";
import { assembleEnrichedOverview, fingerprintResearchReportRequest, validateResearchReportInput } from "./research-report.js";
import { VERSION } from "./version.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(status, body, requestId, headers = {}) {
  return {
    status,
    headers: { ...JSON_HEADERS, "x-request-id": requestId, ...headers },
    body,
  };
}

function parseJsonBody(bodyText) {
  if (!bodyText) return {};
  try {
    return JSON.parse(bodyText);
  } catch {
    throw new ValidationError("Request body must contain valid JSON");
  }
}

export function createRequestHandler({
  getMarketData,
  requestId = randomUUID,
  now = () => new Date(),
  logger = console,
  rateLimiter = null,
  corsAllowOrigin = process.env.CORS_ALLOW_ORIGIN || "*",
  openApiSpec = null,
  planObjective = null,
  enrichMarketEvidence = null,
  analyzeEvidence = null,
  paymentGate = null,
  researchReportPriceAtomic = "10000",
  publicBaseUrl = "https://hyperdesk-scout.onrender.com",
} = {}) {
  if (typeof getMarketData !== "function") throw new TypeError("getMarketData is required");

  return async function handleRequest({ method, pathname, headers = {}, bodyText = "", clientIp = "unknown" }) {
    const id = headers["x-request-id"] || headers["X-Request-Id"] || requestId();
    const startedAt = Date.now();
    const corsHeaders = {
      "access-control-allow-origin": corsAllowOrigin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type, X-Request-Id, PAYMENT-SIGNATURE",
      "access-control-expose-headers": "X-Request-Id, PAYMENT-REQUIRED, PAYMENT-RESPONSE",
    };

    try {
      let result;
      if (method === "OPTIONS") {
        result = { status: 204, headers: { ...corsHeaders, "x-request-id": id }, body: null };
      } else if (method === "GET" && pathname === "/") {
        result = json(200, {
          service: "LiquidFlux",
          product: "LiquidFlux Orchestrator",
          version: VERSION,
          status: "operational",
          description: "AI-assisted planning with approval-gated, deterministic Hyperliquid funding, liquidity, and risk evidence.",
          endpoints: {
            health: { method: "GET", path: "/health" },
            payment_support: { method: "GET", path: "/health/payments" },
            openapi: { method: "GET", path: "/openapi.json" },
            ai_planner: { method: "POST", path: "/api/v1/plan" },
            funding_specialist: { method: "POST", path: "/api/v1/funding-scan" },
            market_overview: { method: "POST", path: "/api/v1/market-overview" },
            research_report: { method: "POST", path: "/api/v1/research-report", payment: "x402" },
            orchestrator: { method: "POST", path: "/api/v1/orchestrate" },
          },
          execution_included: false,
        }, id, corsHeaders);
      } else if (method === "GET" && pathname === "/health") {
        result = json(200, { status: "ok", service: "hyperdesk-scout", version: VERSION }, id, corsHeaders);
      } else if (method === "GET" && pathname === "/health/payments") {
        if (!paymentGate?.supportConfigured || typeof paymentGate.checkSupport !== "function") {
          result = json(503, {
            request_id: id,
            status: "not_configured",
            error: "facilitator_support_not_configured",
          }, id, corsHeaders);
        } else {
          try {
            const support = await paymentGate.checkSupport();
            result = json(200, {
              request_id: id,
              status: support.supported ? "supported" : "unsupported",
              payments_enabled: paymentGate.configured,
              ...support,
            }, id, corsHeaders);
          } catch (error) {
            logger.error?.(JSON.stringify({
              event: "payment_support_check_failed",
              requestId: id,
              errorType: error?.name || "Error",
            }));
            result = json(502, {
              request_id: id,
              status: "unavailable",
              error: "facilitator_support_check_failed",
            }, id, corsHeaders);
          }
        }
      } else if (method === "GET" && pathname === "/openapi.json" && openApiSpec) {
        result = json(200, openApiSpec, id, corsHeaders);
      } else if (method === "POST" && pathname === "/api/v1/plan") {
        const rate = rateLimiter?.consume(clientIp);
        if (rate && !rate.allowed) {
          result = json(429, {
            request_id: id,
            error: "rate_limited",
            message: "Too many requests",
          }, id, {
            ...corsHeaders,
            "retry-after": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
            "x-ratelimit-limit": String(rate.limit),
            "x-ratelimit-remaining": "0",
          });
        } else if (typeof planObjective !== "function") {
          result = json(503, {
            request_id: id,
            error: "ai_unavailable",
            message: "AI planning is not configured",
          }, id, corsHeaders);
        } else {
          const plan = await planObjective(parseJsonBody(bodyText));
          result = json(200, { request_id: id, ...plan }, id, {
            ...corsHeaders,
            ...(rate ? {
              "x-ratelimit-limit": String(rate.limit),
              "x-ratelimit-remaining": String(rate.remaining),
            } : {}),
          });
        }
      } else if (method === "POST" && pathname === "/api/v1/orchestrate") {
        const rate = rateLimiter?.consume(clientIp);
        if (rate && !rate.allowed) {
          result = json(429, {
            request_id: id,
            error: "rate_limited",
            message: "Too many requests",
          }, id, {
            ...corsHeaders,
            "retry-after": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
            "x-ratelimit-limit": String(rate.limit),
            "x-ratelimit-remaining": "0",
          });
        } else {
          const input = validateOrchestrationInput(parseJsonBody(bodyText));
          const marketData = await getMarketData();
          result = json(200, {
            request_id: id,
            ...await orchestrateMarketNeutral({
              markets: marketData.markets,
              input,
              marketData: {
                fetchedAt: marketData.fetchedAt,
                ageMs: marketData.ageMs,
                cacheStatus: marketData.cacheStatus,
                dataStatus: marketData.cacheStatus === "stale_fallback" ? "stale" : "fresh",
              },
              generatedAt: now(),
              workflowId: id,
            }),
          }, id, {
            ...corsHeaders,
            ...(rate ? {
              "x-ratelimit-limit": String(rate.limit),
              "x-ratelimit-remaining": String(rate.remaining),
            } : {}),
          });
        }
      } else if (method === "POST" && pathname === "/api/v1/market-overview") {
        const rate = rateLimiter?.consume(clientIp);
        if (rate && !rate.allowed) {
          result = json(429, {
            request_id: id,
            error: "rate_limited",
            message: "Too many requests",
          }, id, {
            ...corsHeaders,
            "retry-after": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
            "x-ratelimit-limit": String(rate.limit),
            "x-ratelimit-remaining": "0",
          });
        } else {
          const input = validateMarketOverviewInput(parseJsonBody(bodyText));
          const overview = await assembleEnrichedOverview({
            input, getMarketData, enrichMarketEvidence, analyzeEvidence, now,
          });
          result = json(200, {
            request_id: id,
            ...overview,
          }, id, {
            ...corsHeaders,
            ...(rate ? {
              "x-ratelimit-limit": String(rate.limit),
              "x-ratelimit-remaining": String(rate.remaining),
            } : {}),
          });
        }
      } else if (method === "POST" && pathname === "/api/v1/research-report") {
        const input = validateResearchReportInput(parseJsonBody(bodyText));
        const product = {
          resourceUrl: `${publicBaseUrl}/api/v1/research-report`,
          description: "LiquidFlux Hyperliquid research report: 72-hour realized funding, visible order-book evidence, and grounded AI analysis",
          amountAtomic: researchReportPriceAtomic,
        };
        if (!paymentGate || !paymentGate.configured) {
          result = json(503, {
            request_id: id,
            error: "payments_not_configured",
            message: "Paid access is not configured on this deployment",
          }, id, corsHeaders);
        } else {
          const requestFingerprint = fingerprintResearchReportRequest(input);
          const finishPayment = (payment) => {
            if (!payment.ok) return json(payment.response.status, payment.response.body, id, { ...corsHeaders, ...payment.response.headers });
            return json(200, {
              request_id: id,
              report: {
                kind: "hyperliquid_research_report",
                payment: {
                  scheme: "x402",
                  network: paymentGate.network,
                  asset: paymentGate.assetName,
                  amount_atomic: researchReportPriceAtomic,
                  payer: payment.payer,
                  transaction: payment.transaction,
                  recovered: payment.status === "recovered",
                },
              },
              ...payment.artifact,
            }, id, { ...corsHeaders, ...payment.responseHeaders });
          };

          // Exact settled-proof recovery does not consume generation capacity.
          const recovery = await paymentGate.recover({ headers, requestId: id, requestFingerprint, ...product });
          if (recovery) {
            result = finishPayment(recovery);
          } else {
            const rate = rateLimiter?.consume(clientIp);
            if (rate && !rate.allowed) {
              result = json(429, {
                request_id: id,
                error: "rate_limited",
                message: "Too many requests",
              }, id, {
                ...corsHeaders,
                "retry-after": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
                "x-ratelimit-limit": String(rate.limit),
                "x-ratelimit-remaining": "0",
              });
            } else {
              const authorization = await paymentGate.verify({
                headers, requestId: id, requestFingerprint, ...product,
              });
              if (!authorization.ok) {
                result = finishPayment(authorization);
              } else {
                let payment = authorization;
                if (authorization.status === "verified") {
                  let overview;
                  try {
                    overview = await assembleEnrichedOverview({
                      input, getMarketData, enrichMarketEvidence, analyzeEvidence, now,
                    });
                  } catch (error) {
                    await paymentGate.abandon(authorization.context);
                    throw error;
                  }
                  payment = await paymentGate.settle({ context: authorization.context, artifact: overview, requestId: id });
                }
                result = finishPayment(payment);
              }
            }
          }
        }
      } else if (method === "POST" && pathname === "/api/v1/funding-scan") {
        const rate = rateLimiter?.consume(clientIp);
        if (rate && !rate.allowed) {
          result = json(429, {
            request_id: id,
            error: "rate_limited",
            message: "Too many requests",
          }, id, {
            ...corsHeaders,
            "retry-after": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
            "x-ratelimit-limit": String(rate.limit),
            "x-ratelimit-remaining": "0",
          });
        } else {
          const input = validateScanInput(parseJsonBody(bodyText));
          const marketData = await getMarketData();
          result = json(200, {
            request_id: id,
            ...buildFundingScan(marketData.markets, input, {
              generatedAt: now(),
              fetchedAt: marketData.fetchedAt,
              ageMs: marketData.ageMs,
              cacheStatus: marketData.cacheStatus,
              fetchDurationMs: marketData.fetchDurationMs,
            }),
          }, id, {
            ...corsHeaders,
            ...(rate ? {
              "x-ratelimit-limit": String(rate.limit),
              "x-ratelimit-remaining": String(rate.remaining),
            } : {}),
          });
        }
      } else {
        result = json(404, { request_id: id, error: "not_found", message: "Route not found" }, id, corsHeaders);
      }

      logger.info?.(JSON.stringify({ requestId: id, method, pathname, status: result.status, latencyMs: Date.now() - startedAt }));
      return result;
    } catch (error) {
      const status = error instanceof ValidationError || error instanceof UpstreamError || error instanceof PlannerError
        ? error.status
        : 500;
      const code = error instanceof ValidationError ? "invalid_request"
        : error instanceof UpstreamError ? "upstream_unavailable"
          : error instanceof PlannerError ? error.code
            : "internal_error";
      logger.error?.(JSON.stringify({ requestId: id, method, pathname, status, code, latencyMs: Date.now() - startedAt }));
      return json(status, { request_id: id, error: code, message: error.message }, id, corsHeaders);
    }
  };
}
