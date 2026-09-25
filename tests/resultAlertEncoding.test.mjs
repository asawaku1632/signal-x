import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/cron/favorite-ai-check/route.ts", "utf8");

test("result alert context uses URLSearchParams", () => {
  assert.match(route, /new URLSearchParams\(/);
  assert.match(route, /name: monitor\.name/);
  assert.match(route, /triggeredAt: monitor\.triggeredAt/);
  assert.match(route, /completedAt: monitor\.completedAt/);
});
