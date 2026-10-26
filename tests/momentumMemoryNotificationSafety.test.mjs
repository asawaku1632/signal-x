import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/lib/learning/momentumMemoryNotification.ts", import.meta.url), "utf8");

test("admin research alert does not retrieve Yahoo quote when notifying", () => {
  assert.doesNotMatch(source, /yahooFinance\.quote\s*\(/);
  assert.doesNotMatch(source, /captureNotificationPrice\s*\(/);
});

test("admin research alert stores no unverified notification quote metadata", () => {
  assert.match(source, /notification_price,price_captured_at,price_source/);
  assert.match(source, /\[\s*row\.id,\s*null,\s*null,\s*null,/);
});
