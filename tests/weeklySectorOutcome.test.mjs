import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { evaluateSector, weeklyPriceDates } from "../app/lib/weeklySectorOutcome.ts";

const daily = (date, close) => ({
  date, close, barTime: Date.parse(date + "T00:00:00Z") / 1000,
});
const forecast = { key: "SHIPPING", name: "海運", score: 61, codes: ["9101", "9104", "9107"] };

test("the week of the October 12 holiday anchors October 9 and October 16 closes", () => {
  assert.deepEqual(weeklyPriceDates("2026-10-12", "2026-10-18"), {
    baseline: "2026-10-09", finish: "2026-10-16",
  });
});
test("closing prices are used once per symbol, not the mean of daily changes", () => {
  const quotes = new Map([
    ["9101", [daily("2026-10-09", 100), daily("2026-10-16", 105)]],
    ["9104", [daily("2026-10-09", 200), daily("2026-10-16", 196)]],
    ["9107", [daily("2026-10-09", 300), daily("2026-10-16", 309)]],
  ]);
  const result = evaluateSector(forecast, 1, quotes, "2026-10-09", "2026-10-16");
  assert.equal(result.status, "COMPLETE");
  assert.equal(result.averageReturnPercent, 2);
  assert.equal(result.hit, true);
  assert.equal(result.matched, 3);
});
test("missing a single required closing bar prevents false confirmed results", () => {
  const result = evaluateSector(forecast, 1, new Map([
    ["9101", [daily("2026-10-09", 100), daily("2026-10-16", 110)]],
    ["9104", [daily("2026-10-09", 200), daily("2026-10-15", 180)]],
    ["9107", [daily("2026-10-09", 300), daily("2026-10-16", 315)]],
  ]), "2026-10-09", "2026-10-16");
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.averageReturnPercent, null);
  assert.equal(result.hit, null);
  assert.deepEqual(result.missingCodes, ["9104"]);
});
test("previously issued forecasts without frozen members are never reconstructed from a new map", () => {
  const result = evaluateSector({ key:"SHIPPING", name:"海運", score:70 }, 1, new Map(), "2026-10-09","2026-10-16");
  assert.equal(result.status,"INCOMPLETE");
  assert.equal(result.expected,0);
  assert.equal(result.hit,null);
});
test("flat or negative returns are not a successful positive-direction forecast", () => {
  const quotes = new Map([
    ["9101", [daily("2026-10-09", 100), daily("2026-10-16", 101)]],
    ["9104", [daily("2026-10-09", 100), daily("2026-10-16", 99)]],
  ]);
  const result = evaluateSector({...forecast,codes:["9101","9104"]},1,quotes,"2026-10-09","2026-10-16");
  assert.equal(result.averageReturnPercent,0);
  assert.equal(result.hit,false);
});
test("outcome writes use a separate RLS-protected table, cannot change completed grades, and require cron secret", () => {
  const migration = readFileSync("supabase/migrations/20261011_create_weekly_sector_outcome_audits.sql","utf8");
  const cron = readFileSync("app/api/cron/weekly-sector-outcomes/route.ts","utf8");
  const vercel = JSON.parse(readFileSync("vercel.json","utf8"));
  assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
  assert.match(migration,/REVOKE ALL.*anon,authenticated/);
  assert.match(cron,/weekly_sector_outcome_audits\.status <> 'COMPLETE'/);
  assert.match(cron,/request\.headers\.get\("authorization"\)/);
  assert.doesNotMatch(cron,/UPDATE\s+daily_stock_results/i);
  assert.ok(vercel.crons.some(x=>x.path === "/api/cron/weekly-sector-outcomes"));
});
