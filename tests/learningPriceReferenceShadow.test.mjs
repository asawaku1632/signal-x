import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { collectYahooDailyReferences, compareDailyLearningPrice } from "../app/lib/learning/dailyPriceAudit.ts";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("multiple real 1D comparison fixtures distinguish difference and agreement", () => {
  const samples = [
    { code: "9984", saved: 5838, close: 5803, expectedYen: 35, status: "MISMATCH" },
    { code: "5105", saved: 3992, close: 3995, expectedYen: -3, status: "MISMATCH" },
    { code: "6098", saved: 18215, close: 18215, expectedYen: 0, status: "MATCH" },
  ];
  for (const row of samples) {
    const result = compareDailyLearningPrice(row.saved, { date: "2026-10-09", close: row.close, barTime: 1791504000 });
    assert.equal(result.differenceYen, row.expectedYen, row.code);
    assert.equal(result.status, row.status, row.code);
  }
  assert.deepEqual(collectYahooDailyReferences({
    timestamp: [1791504000], indicators: { quote: [{ close: [5803] }] },
  }).map((value) => value.date), ["2026-10-09"]);
});

test("private append-only research table preserves both prices, explicit source and JST observed day", () => {
  const sql = read("supabase/migrations/20261010_create_daily_learning_price_reference_audits.sql");
  assert.match(sql, /REFERENCES public\.daily_stock_results\(id\)/);
  assert.match(sql, /baseline_price NUMERIC/);
  assert.match(sql, /reference_price NUMERIC/);
  assert.match(sql, /observation_date_jst DATE/);
  assert.match(sql, /CHECK \(observation_date_jst > trade_date\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL PRIVILEGES.*PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT SELECT, INSERT/);
  assert.doesNotMatch(sql, /\bGRANT UPDATE\b|\bGRANT DELETE\b/);
});

test("on-demand shadow capture is bounded, exact-date and immutable", () => {
  const service = read("app/lib/learning/priceReferenceObservations.ts");
  assert.match(service, /MAX_MANUAL_REFERENCE_CODES = 5/);
  assert.match(service, /date >= today/);
  assert.match(service, /isTseTradingDate\(date\)/);
  assert.match(service, /bar\.date === date/);
  assert.match(service, /bars\.length !== 1/);
  assert.match(service, /ON CONFLICT \(trade_date, code, reference_source, observation_date_jst\) DO NOTHING/);
  assert.match(service, /public\.daily_learning_price_reference_audits/);
  assert.match(service, /for \(const code of codes\)/);
  assert.doesNotMatch(service, /\b(?:UPDATE|DELETE)\s+(?:public\.)?(?:daily_stock_results|paper_trades|weight_rules)/i);
  assert.doesNotMatch(service, /saveDailyStocks\(|runScan\(|sendNotification\(/);
});

test("admin auth and explicit POST protect Yahoo fetch and isolated side effects", () => {
  const route = read("app/api/admin/daily-price-reference/route.ts");
  const page = read("app/admin/daily-price-reference/page.tsx");
  assert.match(route, /getAdminSession/);
  assert.match(route, /if \(!isAdmin\) return forbidden\(\)/);
  assert.match(route, /origin !== new URL\(request\.url\)\.origin/);
  assert.match(route, /export async function POST/);
  assert.match(route, /parseReferenceBatch/);
  assert.match(route, /captureManualPriceReferences/);
  assert.match(route, /export async function GET/);
  assert.match(route, /Cache-Control.*private, no-store/);
  assert.doesNotMatch(route, /runScan\(|saveDailyStocks\(|notify\(/);
  assert.match(page, /後日のYahoo日足参考値/);
  assert.match(page, /最大5件/);
  assert.match(read("app/admin/daily-price-audit/page.tsx"), /\/admin\/daily-price-reference/);
});
