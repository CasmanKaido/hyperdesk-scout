// Optional local Chrome check. Responses are fixtures: this tests UI, not model understanding.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
const { createApp } = await import("../src/server.js");
await mkdir(".tmp", { recursive: true });
const profile = await mkdtemp(resolve(".tmp/chrome-"));
const server = createApp({
  logger: { info() {}, error() {} },
  getMarketData: async () => ({ markets: [{ symbol: "BTC", funding: "0.00001", markPx: "80000", oraclePx: "79990", openInterest: "1000", dayNtlVlm: "500000000", impactPxs: ["79999", "80001"], maxLeverage: 40, isDelisted: false }], fetchedAt: new Date().toISOString(), ageMs: 0, cacheStatus: "miss" }),
  planObjective: async ({ message }) => message.toLowerCase().includes("strategy")
    ? { intent: "plan_update", reply: "I can review BTC with these suggested limits. Review them before I run the specialists.", summary: "BTC strategy review", objective: "market_neutral_income", symbols: ["BTC"], risk_tolerance: "moderate", max_leverage: 2, max_notional_usd: 1000, min_funding_apr: 5, suggested_defaults: ["risk_tolerance", "max_leverage", "max_notional_usd", "min_funding_apr"], assumptions: [], missing_information: [], provider: "groq", model: "fixture" }
    : { intent: "market_information", reply: "I can check BTC funding for you.", symbols: ["BTC"], topics: ["funding"], provider: "groq", model: "fixture" },
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=9225", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let ws;
try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch("http://127.0.0.1:9225/json/list")).json(); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  assert.ok(targets, "Chrome debugging endpoint available");
  ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  const pending = new Map();
  const errors = [];
  let id = 0;
  ws.addEventListener("message", event => {
    const data = JSON.parse(event.data);
    if (data.method === "Runtime.exceptionThrown") errors.push(data.params.exceptionDetails.text);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject, timer } = pending.get(data.id);
      clearTimeout(timer); pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message)); else resolve(data.result);
    }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(key, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const wait = async expression => {
    for (let i = 0; i < 80; i++) {
      if (await evaluate(expression)) return;
      await new Promise(r => setTimeout(r, 75));
    }
    throw new Error(`Condition timed out: ${expression}`);
  };
  const screenshot = async name => {
    await new Promise(r => setTimeout(r, 400));
    const shot = await cdp("Page.captureScreenshot", { format: "png" });
    await writeFile(`.tmp/${name}.png`, Buffer.from(shot.data, "base64"));
  };
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  for (const [name, width, height, mobile] of [["desktop", 1440, 1000, false], ["mobile", 390, 844, true]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    await cdp("Page.navigate", { url: origin });
    await wait('document.querySelector("#service-status")?.textContent === "Service online"');
    assert.equal(await evaluate('document.querySelector(".analysis-panel").hidden'), true);
    assert.equal(await evaluate('document.querySelector("#review-plan").hidden'), true);
    await screenshot(`${name}-chat`);
    await evaluate('document.querySelector("[data-prompt]").click(); document.querySelector("#chat-form").requestSubmit()');
    await wait('!document.querySelector("#info-confirmation").hidden && !document.querySelector("#fetch-overview").disabled');
    await evaluate('document.querySelector("#objective-message").value = "yes"; document.querySelector("#chat-form").requestSubmit()');
    await wait('!document.querySelector("#overview-state").hidden');
    assert.equal(await evaluate('document.querySelector("#overview-state > details").open'), false);
    assert.equal(await evaluate('document.querySelector("#conversation-log").contains(document.querySelector(".analysis-panel"))'), true);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `${name} information overflow`);
    await screenshot(`${name}-information`);
    await evaluate('document.querySelector("#overview-state > details").open = true');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `${name} expanded evidence overflow`);
    await evaluate('document.querySelector("#overview-state > details").open = false');
    await evaluate('document.querySelector("#objective-message").value = "Create a BTC strategy"; document.querySelector("#chat-form").requestSubmit()');
    await wait('!document.querySelector("#review-plan").hidden && !document.querySelector("#review-plan").disabled');
    await evaluate('document.querySelector("#review-plan").click()');
    await wait('!document.querySelector("#plan-state").hidden');
    assert.equal(await evaluate('document.querySelectorAll(".research-archive").length'), 1, "Prior evidence stays in the conversation");
    assert.equal(await evaluate('new Set([...document.querySelectorAll("[id]")].map(n => n.id)).size === document.querySelectorAll("[id]").length'), true, "No duplicate IDs in archived evidence");
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `${name} plan overflow`);
    await evaluate('document.querySelector("#approve-plan").scrollIntoView({ block: "center", behavior: "instant" })');
    await screenshot(`${name}-plan`);
    const point = await evaluate('(() => { const button = document.querySelector("#approve-plan"); const rect = button.getBoundingClientRect(); const x = rect.x + rect.width / 2; const y = rect.y + rect.height / 2; return { x, y, accessible: button.contains(document.elementFromPoint(x, y)) }; })()');
    assert.equal(point.accessible, true, `${name} approval is not obscured by composer`);
    await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await wait('!document.querySelector("#result-state").hidden');
    assert.equal(await evaluate('document.querySelector("#result-state > details").open'), false);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `${name} results overflow`);
    console.log(`${name}: chat → information confirmation → evidence → strategy review → result passed`);
  }
  assert.deepEqual(errors, [], "No browser runtime exceptions");
  console.log("Chrome UI smoke checks passed. Screenshots are in .tmp/; provider responses were mocked.");
} finally {
  ws?.close();
  chrome.kill();
  server.closeAllConnections();
  await new Promise(r => server.close(r));
  await once(chrome, "exit").catch(() => {});
  await rm(profile, { recursive: true, force: true });
}
