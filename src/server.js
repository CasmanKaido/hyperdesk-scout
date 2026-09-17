import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fetchPerpMarkets, UpstreamError } from "./hyperliquid.js";
import { buildFundingScan, validateScanInput, ValidationError } from "./service.js";

const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 32 * 1024;

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new ValidationError("Request body is too large");
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("Request body must contain valid JSON");
  }
}

export function createApp({ fetchMarkets = fetchPerpMarkets } = {}) {
  return createServer(async (request, response) => {
    const requestId = request.headers["x-request-id"] || randomUUID();
    response.setHeader("x-request-id", requestId);

    try {
      const url = new URL(request.url, "http://localhost");
      if (request.method === "GET" && url.pathname === "/health") {
        return sendJson(response, 200, { status: "ok", service: "hyperdesk-scout" });
      }

      if (request.method === "POST" && url.pathname === "/api/v1/funding-scan") {
        const input = validateScanInput(await readJson(request));
        const markets = await fetchMarkets();
        return sendJson(response, 200, { request_id: requestId, ...buildFundingScan(markets, input) });
      }

      return sendJson(response, 404, { request_id: requestId, error: "not_found" });
    } catch (error) {
      const status = error instanceof ValidationError || error instanceof UpstreamError ? error.status : 500;
      const code = error instanceof ValidationError ? "invalid_request"
        : error instanceof UpstreamError ? "upstream_unavailable" : "internal_error";
      console.error(JSON.stringify({ requestId, code, message: error.message }));
      return sendJson(response, status, { request_id: requestId, error: code, message: error.message });
    }
  });
}

if (process.env.NODE_ENV !== "test") {
  createApp().listen(PORT, "0.0.0.0", () => {
    console.log(`HyperDesk Scout listening on http://localhost:${PORT}`);
  });
}
