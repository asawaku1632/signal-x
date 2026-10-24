import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/cron/favorite-ai-check/route.ts", "utf8");
for (const field of ["entry", "takeProfit", "stopLoss", "resultPrice", "triggeredAt", "completedAt"]) {
  test(`result alert includes ${field}`, () => assert.match(route, new RegExp(`${field}:`)));
}
