import { randomUUID } from "node:crypto";
import { UpstreamError } from "./hyperliquid.js";
import { buildFundingScan, validateScanInput, ValidationError } from "./service.js";
import { orchestrateMarketNeutral, validateOrchestrationInput } from "./orchestrator.js";
import { PlannerError } from "./ai-planner.js";
import { buildEvidenceLedger } from "./ai-analyst.js";
import { buildMarketOverview, validateMarketOverviewInput } from "./market-overview.js";

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
} = {}) {
  if (typeof getMarketData !== "function") throw new TypeError("getMarketData is required");

  return async function handleRequest({ method, pathname, headers = {}, bodyText = "", clientIp = "unknown" }) {
    const id = headers["x-request-id"] || headers["X-Request-Id"] || requestId();
    const startedAt = Date.now();
    const corsHeaders = {
      "access-control-allow-origin": corsAllowOrigin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type, X-Request-Id, PAYMENT-SIGNATURE",
    };

    try {
      let result;
      if (method === "OPTIONS") {
        result = { status: 204, headers: { ...corsHeaders, "x-request-id": id }, body: null };
      } else if (method === "GET" && pathname === "/") {
        result = json(200, {
          service: "LiquidFlux",
          product: "LiquidFlux Orchestrator",
          version: "0.7.5",
          status: "operational",
          description: "AI-assisted planning with approval-gated, deterministic Hyperliquid funding, liquidity, and risk evidence.",
          endpoints: {
            health: { method: "GET", path: "/health" },
            openapi: { method: "GET", path: "/openapi.json" },
            ai_planner: { method: "POST", path: "/api/v1/plan" },
            funding_specialist: { method: "POST", path: "/api/v1/funding-scan" },
            market_overview: { method: "POST", path: "/api/v1/market-overview" },
            orchestrator: { method: "POST", path: "/api/v1/orchestrate" },
          },
          execution_included: false,
        }, id, corsHeaders);
      } else if (method === "GET" && pathname === "/health") {
        result = json(200, { status: "ok", service: "hyperdesk-scout", version: "0.7.5" }, id, corsHeaders);
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
          const marketData = await getMarketData();
          const overview = buildMarketOverview(marketData.markets, input, {
            generatedAt: now(),
            fetchedAt: marketData.fetchedAt,
            ageMs: marketData.ageMs,
            cacheStatus: marketData.cacheStatus,
          });
          if (typeof enrichMarketEvidence === "function") {
            const research = await enrichMarketEvidence(input);
            const bySymbol = new Map(research.markets.map((item) => [item.symbol, item]));
            for (const market of overview.markets) market.research = bySymbol.get(market.symbol) || null;
            overview.research = { window_hours: research.window_hours, limitations: research.limitations };
          }
          overview.evidence_ledger = buildEvidenceLedger(overview);
          overview.analysis = input.question && typeof analyzeEvidence === "function"
            ? await analyzeEvidence({ question: input.question, evidence: overview.evidence_ledger })
            : { status: "unavailable", reason: input.question ? "not_configured" : "question_not_supplied" };
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
