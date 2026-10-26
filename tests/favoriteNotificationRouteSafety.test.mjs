import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("monitor cron gates new monitoring before persistence and delivery", () => {
  const src = read("../app/api/cron/favorite-ai-monitor/route.ts");
  const gate = src.indexOf("favoriteQuoteLicenseGuard(stock.dataSource)");
  const monitor = src.indexOf("startFavoriteAiMonitor(");
  const line = src.indexOf("pushLineToUser(");
  const web = src.indexOf("pushWebToUser(");
  assert.ok(gate >= 0 && monitor > gate && line > gate && web > gate);
});

test("outcome cron gates activation and result settlement by source and quote age", () => {
  const src = read("../app/api/cron/favorite-ai-check/route.ts");
  const gate = src.indexOf("favoriteQuoteLicenseGuard(stock?.dataSource)");
  const fresh = src.indexOf("favoriteOutcomeQuoteGuard(stock?.latestBarTimestamp");
  const activation = src.indexOf("claimFavoriteActivationNotification(");
  const settlement = src.indexOf("recordFavoriteAiOutcome(");
  assert.ok(gate >= 0 && fresh > gate && activation > fresh && settlement > fresh);
});

test("old pending result replay is blocked before sending", () => {
  const src = read("../app/api/cron/favorite-ai-check/route.ts");
  const pending = src.indexOf("for (const monitor of pending)");
  const gate = src.indexOf("favoriteQuoteLicenseGuard(null)", pending);
  const push = src.indexOf("pushWebToUser(", pending);
  assert.ok(pending >= 0 && gate > pending && push > gate);
});

test("price target push is blocked before querying pending thresholds", () => {
  const src = read("../app/lib/push/priceTargetWatcher.ts");
  const gate = src.indexOf("favoriteQuoteLicenseGuard(null)");
  const query = src.indexOf("const pending = await pool.query");
  const push = src.indexOf("pushWebToUser(target.user_email");
  assert.ok(gate >= 0 && query > gate && push > query);
});
