import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server.js";
import { getStaticAsset, loadStaticAssets } from "../src/static.js";
import { VERSION } from "../src/version.js";

const silentLogger = { info() {}, error() {} };

test("loads the dashboard assets with strict security headers", () => {
  const assets = loadStaticAssets();
  const dashboard = getStaticAsset(assets, "GET", "/");

  assert.equal(dashboard.headers["content-type"], "text/html; charset=utf-8");
  assert.match(dashboard.headers["content-security-policy"], /default-src 'self'/);
  const html = dashboard.body.toString("utf8");
  assert.match(html, /LiquidFlux/);
  assert.match(html, /class="paid-service-badge">Paid agent service<\/span>/);
  assert.match(html, /Hyperliquid Research Report/);
  assert.match(html, /0\.01 USD₮0/);
  assert.match(html, /No browser wallet connection is required/);
  assert.match(html, /Free first-party analysis · no paid service selected/);
  assert.equal(getStaticAsset(assets, "POST", "/"), null);
  assert.equal(getStaticAsset(assets, "GET", "/missing.css"), null);
});

test("serves the dashboard and preserves JSON health checks", async (context) => {
  const server = createApp({
    getMarketData: async () => { throw new Error("should not run"); },
    logger: silentLogger,
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  const dashboard = await fetch(`${origin}/`);
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.headers.get("content-type"), /text\/html/);
  assert.match(await dashboard.text(), /id="analysis-form"/);

  const head = await fetch(`${origin}/`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");

  const health = await fetch(`${origin}/health`);
  assert.equal(health.status, 200);
  assert.match(health.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await health.json(), { status: "ok", service: "hyperdesk-scout", version: VERSION });
});
