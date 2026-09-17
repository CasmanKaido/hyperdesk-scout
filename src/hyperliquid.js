const DEFAULT_API_URL = "https://api.hyperliquid.xyz";

export class UpstreamError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

export async function fetchPerpMarkets({
  apiUrl = process.env.HYPERLIQUID_API_URL || DEFAULT_API_URL,
  timeoutMs = Number(process.env.HYPERLIQUID_TIMEOUT_MS || 5000),
  fetchImpl = fetch,
} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${apiUrl}/info`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new UpstreamError(`Hyperliquid returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length !== 2) {
      throw new UpstreamError("Hyperliquid returned an unexpected payload");
    }

    const [metadata, contexts] = payload;
    if (!Array.isArray(metadata?.universe) || !Array.isArray(contexts)) {
      throw new UpstreamError("Hyperliquid market metadata is incomplete");
    }

    return metadata.universe.map((asset, index) => ({
      ...contexts[index],
      symbol: asset.name,
      maxLeverage: asset.maxLeverage,
      isDelisted: asset.isDelisted === true,
    })).filter((market) => market.symbol && market.markPx && !market.isDelisted);
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    if (error?.name === "AbortError") {
      throw new UpstreamError("Hyperliquid request timed out", 504);
    }
    throw new UpstreamError("Unable to reach Hyperliquid");
  } finally {
    clearTimeout(timeout);
  }
}
