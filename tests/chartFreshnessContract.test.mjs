import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/chart/[symbol]/route.ts", "utf8");
const page = fs.readFileSync("app/chart/[code]/page.tsx", "utf8");

test("chart route has an explicit one-minute freshness threshold", () => {
  assert.match(route, /CHART_FRESH_MS\s*=\s*60_000/);
});

test("chart page bypasses browser cache when requesting chart data", () => {
  assert.match(page, /fetch\(`\/api\/chart\/\$\{code\}\?tf=\$\{timeframe\}`/);
  assert.match(page, /cache:\s*"no-store"/);
});
