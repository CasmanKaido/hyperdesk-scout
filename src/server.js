import { createServer } from "node:http";
import { createRequestHandler } from "./handler.js";
import { createMarketDataProvider } from "./market-data.js";
import { createRateLimiter } from "./rate-limit.js";
import { loadOpenApiSpec } from "./openapi.js";
import { getStaticAsset, loadStaticAssets } from "./static.js";
import { createAIPlanner } from "./ai-planner.js";
import { createAIAnalyst } from "./ai-analyst.js";
import { createResearchEvidenceProvider } from "./research-evidence.js";
import { paymentGateFromEnv } from "./payments.js";

const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 32 * 1024;

async function readBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large");
      error.status = 413;
      throw error;
    }
  }
  return raw;
}

export function createApp({
  getMarketData = createMarketDataProvider(),
  rateLimiter = createRateLimiter(),
  logger = console,
  openApiSpec = loadOpenApiSpec(),
  staticAssets = loadStaticAssets(),
  planObjective = createAIPlanner({ logger }),
  enrichMarketEvidence = process.env.NODE_ENV === "test" ? null : createResearchEvidenceProvider(),
  analyzeEvidence = process.env.NODE_ENV === "test" ? null : createAIAnalyst({ logger }),
  paymentGate = process.env.NODE_ENV === "test" ? null : paymentGateFromEnv(process.env, { logger }),
  researchReportPriceAtomic = process.env.X402_PRICE_RESEARCH_REPORT_ATOMIC || "10000",
  publicBaseUrl = process.env.PUBLIC_BASE_URL || "https://hyperdesk-scout.onrender.com",
} = {}) {
  const handleRequest = createRequestHandler({
    getMarketData, rateLimiter, logger, openApiSpec, planObjective, enrichMarketEvidence, analyzeEvidence,
    paymentGate, researchReportPriceAtomic, publicBaseUrl,
  });

  return createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      const staticAsset = getStaticAsset(staticAssets, request.method, pathname);
      if (staticAsset) {
        response.writeHead(200, staticAsset.headers);
        response.end(request.method === "HEAD" ? undefined : staticAsset.body);
        return;
      }

      const result = await handleRequest({
        method: request.method,
        pathname,
        headers: request.headers,
        bodyText: await readBody(request),
        clientIp: request.socket.remoteAddress || "unknown",
      });
      response.writeHead(result.status, result.headers);
      response.end(JSON.stringify(result.body));
    } catch (error) {
      const status = error.status === 413 ? 413 : 500;
      response.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(JSON.stringify({ error: status === 413 ? "payload_too_large" : "internal_error", message: error.message }));
    }
  });
}

if (process.env.NODE_ENV !== "test") {
  const server = createApp();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`LiquidFlux listening on http://localhost:${PORT}`);
  });

  function shutdown(signal) {
    console.log(JSON.stringify({ event: "shutdown", signal }));
    server.close((error) => {
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
