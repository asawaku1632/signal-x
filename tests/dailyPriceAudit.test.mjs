import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  collectYahooDailyReferences, compareDailyLearningPrice,
  isValidJapanStockCode, isValidPriceAuditDate, jstDateFromUnix,
} from "../app/lib/learning/dailyPriceAudit.ts";

const read = (path) => readFileSync(path, "utf8");
test("9984: saved 5838 vs later daily close 5803 flags a 35 yen mismatch", () => {
  const bar = { date: "2026-10-09", close: 5803, barTime: 1791504000 };
  const result = compareDailyLearningPrice(5838, bar);
  assert.equal(result.status, "MISMATCH");
  assert.equal(result.differenceYen, 35);
  assert.ok(Math.abs(result.differencePercent - 0.6031) < 0.0001);
  assert.equal(compareDailyLearningPrice(5803, bar).status, "MATCH");
});
test("Japanese daily candle timestamp 09:00 JST maps to same trading date", () => {
  assert.equal(jstDateFromUnix(1791504000), "2026-10-09");
  assert.equal(jstDateFromUnix(Number.NaN), null);
  const references = collectYahooDailyReferences({
    timestamp: [1791504000, 1791417600, 0],
    indicators: { quote: [{ close: [5803, 6040, null] }] },
  });
  assert.deepEqual(references.map((row) => [row.date, row.close]), [
    ["2026-10-09", 5803], ["2026-10-08", 6040],
  ]);
  assert.deepEqual(collectYahooDailyReferences(null), []);
  assert.deepEqual(collectYahooDailyReferences({ timestamp: [1791504000], indicators: { quote: [{ close: [null] }] } }), []);
});
test("reject invalid codes/dates and nonpositive prices", () => {
  assert.ok(isValidJapanStockCode("9984"));
  assert.equal(isValidJapanStockCode("9984.T"), false);
  assert.equal(isValidJapanStockCode("99999"), false);
  assert.ok(isValidPriceAuditDate("2026-10-09"));
  assert.equal(isValidPriceAuditDate("2026-02-30"), false);
  assert.equal(isValidPriceAuditDate("2026-1-09"), false);
  assert.throws(() => compareDailyLearningPrice(0, { date: "2026-10-09", close: 5803, barTime: 1791504000 }), /INVALID_PRICE/);
});
test("audit is on-demand, admin restricted, fail-closed and cannot change learning history", () => {
  const route = read("app/api/admin/daily-price-audit/route.ts");
  const page = read("app/admin/daily-price-audit/page.tsx");
  assert.match(route, /getAdminSession/);
  assert.match(route, /isAdmin/);
  assert.match(route, /WHERE code = \$1 AND date = \$2/);
  assert.match(route, /cache: "no-store"/);
  assert.match(route, /interval=1d/);
  assert.match(route, /status: "PENDING"/);
  assert.match(route, /status: "UNVERIFIED"/);
  assert.doesNotMatch(route, /\b(?:INSERT|UPDATE|DELETE|UPSERT)\s+(?:INTO|public\.|daily_stock_results|paper_trades)/i);
  assert.doesNotMatch(route, /notification|runScan|saveDailyStocks|prime-signal/);
  assert.match(page, /日次株価の差額調査/);
  assert.match(read("app/admin/learning-status/page.tsx"), /\/admin\/daily-price-audit/);
});
