import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/cron/favorite-ai-check/route.ts", "utf8");
const page = fs.readFileSync("app/alerts/result/[code]/page.tsx", "utf8");

test("result web push opens the historical alert context page", () => {
  assert.match(route, /url:\s*resultAlertUrl\(monitor\)/);
  assert.match(route, /entry:/);
  assert.match(route, /takeProfit:/);
  assert.match(route, /stopLoss:/);
  assert.match(route, /resultPrice:/);
});

test("result page clearly separates historical result from current AI analysis", () => {
  assert.match(page, /以前に成立した買いシグナルの結果/);
  assert.match(page, /現在のAI評価/);
  assert.match(page, /href=\{`\/analysis\/\$\{code\}`\}/);
  assert.match(page, /href=\{`\/chart\/\$\{code\}`\}/);
});
