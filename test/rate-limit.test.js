import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/rate-limit.js";

test("limits each client independently and resets its window", () => {
  let time = 1000;
  const limiter = createRateLimiter({ limit: 2, windowMs: 100, now: () => time });

  assert.equal(limiter.consume("a").allowed, true);
  assert.equal(limiter.consume("a").allowed, true);
  assert.equal(limiter.consume("a").allowed, false);
  assert.equal(limiter.consume("b").allowed, true);

  time = 1100;
  assert.equal(limiter.consume("a").allowed, true);
});
