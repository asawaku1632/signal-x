import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("new daily audit runs only with authenticated cron, after result checks", () => {
  const vercel = JSON.parse(read("vercel.json"));
  const scheduled = vercel.crons.find((item) => item.path === "/api/cron/win-rate-reliability-audit");
  assert.equal(scheduled?.schedule, "15 9 * * 1-5");
  const route = read("app/api/cron/win-rate-reliability-audit/route.ts");
  assert.match(route, /requireCronAuth\(request\)/);
  assert.match(route, /auditDateIsTradingDay/);
  assert.match(route, /saveCronRunLog/);
  assert.doesNotMatch(route, /sendLine|runAutoLearning|UPDATE daily_stock_results/);
});

test("daily audit only reads learning data and checks provenance in both directions", () => {
  const source = read("app/lib/learning/winRateReliabilityAudit.ts");
  assert.match(source, /isTseTradingDate/);
  assert.match(source, /cron_learning_logs/);
  assert.match(source, /PRICE_PROVENANCE_MISMATCH/);
  assert.match(source, /RECENT_RESULTS_WITHOUT_PROVENANCE/);
  assert.match(source, /source_row\.price/);
  assert.match(source, /result_row\.next_price/);
  assert.doesNotMatch(source, /\bUPDATE\b|\bINSERT\b|\bDELETE\b|\bTRUNCATE\b/i);
});

test("weekly summaries never treat missing audits as success", () => {
  const source = read("app/lib/learning/winRateWeeklyAudit.ts");
  assert.match(source, /missingDays = scheduledDays - auditedDays/);
  assert.match(source, /isTseTradingDate\(date\)/);
  assert.match(source, /timeJst < "18:15"/);
  assert.match(source, /status: scheduledDays === 0 \? "PENDING"/);
  const api = read("app/api/admin/ai-win-rate-audit/route.ts");
  assert.match(api, /getAdminSession/);
  assert.match(api, /summarizeWeeklyAudits/);
  assert.match(api, /WIN_RATE_DAILY_AUDIT_ROUTE/);
  assert.doesNotMatch(api, /\bUPDATE\b|\bINSERT\b|\bDELETE\b/i);
});

test("audit page shows new results separately from the legacy August audit", () => {
  const page = read("app/admin/ai-win-rate-audit/page.tsx");
  assert.match(page, /毎営業日の自動監査/);
  assert.match(page, /週次監査レポート/);
  assert.match(page, /過去データの監査/);
  assert.match(page, /未実施日は正常扱いしません/);
});
