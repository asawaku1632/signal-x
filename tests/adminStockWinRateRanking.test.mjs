import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("admin stock leaderboard requires server-side authentication on page and API", () => {
  const page = read("app/admin/stock-win-rate-ranking/page.tsx");
  const api = read("app/api/admin/stock-win-rate-ranking/route.ts");
  assert.match(page, /getAdminSession\(\)/);
  assert.match(page, /if \(!isAdmin\) notFound\(\)/);
  assert.match(api, /getAdminSession\(\)/);
  assert.match(api, /if \(!isAdmin\)/);
  assert.match(api, /status: 403/);
  assert.ok(api.indexOf("if (!isAdmin)") < api.indexOf("pool.query("), "access check must precede database query");
  assert.match(api, /Cache-Control": "private, no-store/);
  assert.match(page, /force-dynamic/);
});

test("ranking uses completed win/loss decisions and makes no writes", () => {
  const api = read("app/api/admin/stock-win-rate-ranking/route.ts");
  assert.match(api, /judged = win \+ lose/);
  assert.match(api, /judged > 0 \? Math\.round\(\(win \/ judged\) \* 1000\) \/ 10 : null/);
  assert.match(api, /WHERE result = 'WIN'/);
  assert.match(api, /WHERE result = 'LOSE'/);
  assert.match(api, /WHERE result = 'HOLD'/);
  assert.match(api, /recent_position <= 30/);
  assert.match(api, /ROW_NUMBER\(\) OVER/);
  assert.match(api, /scope !== "all" && scope !== "recent30"/);
  assert.doesNotMatch(api, /UPDATE daily_stock_results|INSERT INTO daily_stock_results|DELETE FROM daily_stock_results/);
});

test("admin hub exposes private ranking without changing public results screens", () => {
  const hub = read("app/admin/learning-hub/page.tsx");
  const monitor = read("app/admin/learning-status/page.tsx");
  const client = read("app/admin/stock-win-rate-ranking/AdminWinRateRankingClient.tsx");
  assert.match(hub, /href: "\/admin\/stock-win-rate-ranking"/);
  assert.match(monitor, /href="\/admin\/stock-win-rate-ranking"/);
  assert.match(client, /\/api\/admin\/stock-win-rate-ranking\?scope=/);
  assert.match(client, /minJudged/);
  assert.match(client, /"best" \| "worst" \| "wins" \| "losses" \| "samples"/);
  assert.match(client, /fetch\("\/api\/admin\/stock-win-rate-ranking/);
});
