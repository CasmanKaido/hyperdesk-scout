import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const renderConfig = await readFile(new URL("../render.yaml", import.meta.url), "utf8");
const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");

test("deployment config uses the Docker runtime and health endpoint", () => {
  assert.match(renderConfig, /runtime: docker/);
  assert.match(renderConfig, /plan: free/);
  assert.match(renderConfig, /healthCheckPath: \/health/);
  assert.match(renderConfig, /branch: main/);
  assert.match(dockerfile, /COPY public \.\/public/);
  assert.match(dockerfile, /COPY assets \.\/assets/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /USER node/);
});
