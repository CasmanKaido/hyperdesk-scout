// Production Chrome smoke check: initial chat workspace, service health, and responsive layout.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const origin = process.argv[2] || "https://liquidflux.onrender.com/";
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const debuggingPort = 9226;

await mkdir(".tmp", { recursive: true });
const profile = await mkdtemp(resolve(".tmp/live-chrome-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

let ws;
try {
  let targets;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)).json();
      break;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
  }
  assert.ok(targets, "Chrome debugging endpoint available");
  ws = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolveOpen) => ws.addEventListener("open", resolveOpen, { once: true }));

  const pending = new Map();
  const runtimeErrors = [];
  let messageId = 0;
  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.method === "Runtime.exceptionThrown") runtimeErrors.push(data.params.exceptionDetails.text);
    if (data.id && pending.has(data.id)) {
      const operation = pending.get(data.id);
      clearTimeout(operation.timer);
      pending.delete(data.id);
      if (data.error) operation.reject(new Error(data.error.message));
      else operation.resolve(data.result);
    }
  });

  const cdp = (method, params = {}) => new Promise((resolveCall, rejectCall) => {
    const id = ++messageId;
    const timer = setTimeout(() => {
      pending.delete(id);
      rejectCall(new Error(`CDP timeout: ${method}`));
    }, 15000);
    pending.set(id, { resolve: resolveCall, reject: rejectCall, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      if (await evaluate(expression)) return;
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    throw new Error(`Condition timed out: ${expression}`);
  };

  await cdp("Runtime.enable");
  await cdp("Page.enable");
  for (const [name, width, height, mobile] of [
    ["desktop", 1440, 1000, false],
    ["mobile", 390, 844, true],
  ]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    await cdp("Page.navigate", { url: origin });
    await waitFor('document.querySelector("#service-status")?.textContent === "Service online"');
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `${name} has horizontal overflow`);
    assert.equal(await evaluate('document.querySelector("#objective-message") !== null'), true, `${name} composer exists`);
    assert.equal(await evaluate('document.querySelector("#chat-form button[type=submit]") !== null'), true, `${name} submit exists`);
    await evaluate('document.querySelector("#main-content").scrollIntoView({ block: "start", behavior: "instant" })');
    await waitFor('document.querySelector("#chat-form").getBoundingClientRect().bottom <= innerHeight');
    const composerClear = await evaluate(`(() => {
      const form = document.querySelector("#chat-form");
      const rect = form.getBoundingClientRect();
      return rect.bottom <= innerHeight && rect.width <= innerWidth;
    })()`);
    assert.equal(composerClear, true, `${name} composer is fully visible`);
    const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
    await writeFile(`.tmp/live-${name}.png`, Buffer.from(screenshot.data, "base64"));
    console.log(`${name}: online, no horizontal overflow, composer visible`);

    if (name === "desktop") {
      await evaluate('document.querySelector("[data-prompt]").click(); document.querySelector("#chat-form").requestSubmit()');
      await waitFor('!document.querySelector("#info-confirmation").hidden && !document.querySelector("#fetch-overview").disabled');
      await evaluate('document.querySelector("#objective-message").value = "check it"; document.querySelector("#chat-form").requestSubmit()');
      await waitFor('!document.querySelector("#overview-state").hidden');
      assert.equal(await evaluate('document.querySelector("#overview-state").textContent.includes("BTC")'), true, "live overview contains BTC evidence");

      await evaluate('document.querySelector("#objective-message").value = "Create a moderate BTC strategy with maximum notional $1000 and leverage 2x"; document.querySelector("#chat-form").requestSubmit()');
      await waitFor('!document.querySelector("#review-plan").hidden && !document.querySelector("#review-plan").disabled');
      await evaluate('document.querySelector("#review-plan").click()');
      await waitFor('!document.querySelector("#plan-state").hidden');
      await evaluate('document.querySelector("#approve-plan").scrollIntoView({ block: "center", behavior: "instant" })');
      const point = await evaluate(`(() => {
        const button = document.querySelector("#approve-plan");
        const rect = button.getBoundingClientRect();
        const x = rect.x + rect.width / 2;
        const y = rect.y + rect.height / 2;
        return { x, y, accessible: button.contains(document.elementFromPoint(x, y)) };
      })()`);
      assert.equal(point.accessible, true, "live approval button is not obscured");
      await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
      await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
      await waitFor('!document.querySelector("#result-state").hidden');
      assert.equal(await evaluate('document.querySelector("#result-state").textContent.includes("BTC")'), true, "live strategy result contains BTC");
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, "desktop result has horizontal overflow");
      const resultScreenshot = await cdp("Page.captureScreenshot", { format: "png" });
      await writeFile(".tmp/live-desktop-result.png", Buffer.from(resultScreenshot.data, "base64"));
      console.log("desktop: live information confirmation → evidence → strategy review → approved result passed");
    }
  }
  assert.deepEqual(runtimeErrors, [], `runtime errors: ${runtimeErrors.join(", ")}`);
  console.log(`Production browser smoke passed: ${origin}`);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill("SIGTERM");
  await Promise.race([once(chrome, "exit"), new Promise((resolveWait) => setTimeout(resolveWait, 2000))]);
  await rm(profile, { recursive: true, force: true });
}
