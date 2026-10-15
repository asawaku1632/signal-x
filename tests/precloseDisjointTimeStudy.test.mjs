import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PRECLOSE_EXCLUSIVE_BANDS, PRECLOSE_COMPARE_SLOTS,
  classifyPreclose100Shares, summarizeExclusivePrecloseBands,
  compareMatchedTimeByExclusiveBand,
} from "../app/lib/research/precloseDisjointTimeStudy.ts";

const precloseRow = (tradeDate, code, price, ai = 95, outcome = price * 1.03, outcomeDate = "2026-10-14") => ({
  tradeDate, outcomeDate, code, name: code, entryPrice: price,
  aiPower: ai, sampledAt: tradeDate + "T06:15:00Z", outcomePrice: outcome,
});
const pair = (slot, first, last, date = "2026-10-13", code = "1234", outcome = 1040) => ({
  slot, tradeDate: date, code, earlierPrice: first, preclosePrice: last,
  earlierAi: 95, precloseAi: 95, outcomePrice: outcome,
});

test("non-overlapping budget intervals cover each valid 100-share price exactly once", () => {
  assert.equal(PRECLOSE_EXCLUSIVE_BANDS.length, 4);
  assert.equal(classifyPreclose100Shares(999), "0-10");
  assert.equal(classifyPreclose100Shares(1000), "0-10");
  assert.equal(classifyPreclose100Shares(1000.01), "10-30");
  assert.equal(classifyPreclose100Shares(3000), "10-30");
  assert.equal(classifyPreclose100Shares(3000.01), "30-50");
  assert.equal(classifyPreclose100Shares(5000), "30-50");
  assert.equal(classifyPreclose100Shares(5000.01), "50-100");
  assert.equal(classifyPreclose100Shares(10000), "50-100");
  for (const bad of [0, -1, NaN, Infinity, 10000.01])
    assert.equal(classifyPreclose100Shares(bad), null);
});

test("exclusive stats neither double-count budget buckets nor use today's future price", () => {
  const rows = [
    precloseRow("2026-10-13", "1", 1000, 95, 1030),
    precloseRow("2026-10-13", "2", 3000, 95, 2910),
    precloseRow("2026-10-13", "3", 5000, 95, 5100),
    precloseRow("2026-10-13", "4", 10000, 95, 10100),
    precloseRow("2026-10-13", "5", 900, 89, 9999), // under policy AI
    precloseRow("2026-10-13", "6", 10001, 95, 1), // over max
    precloseRow("2026-10-15", "7", 900, 95, 99999, "2026-10-16"),
  ];
  const result = summarizeExclusivePrecloseBands(rows, "2026-10-15");
  assert.deepEqual(result.map(x => x.stats.samples), [1, 1, 1, 1]);
  assert.deepEqual(result.map(x => x.todayCount), [1, 0, 0, 0]);
  assert.equal(result[0].stats.meanChangePct, 3);
  assert.equal(result[1].stats.meanPnl100, -9000);
  assert.equal(result[0].worst100, 3000);
  assert.deepEqual(result.map(x => x.stats.wins), [1, 0, 1, 0]);
});

test("matched pairs compare the SAME code/day; drop pairs crossing price bands or failing AI", () => {
  assert.equal(PRECLOSE_COMPARE_SLOTS.length, 6);
  const rows = [
    pair("09:15", 1000, 1000),   // both 10万以内
    pair("09:30", 999, 1001),    // crosses band, excluded
    pair("10:30", 900, 1000, "2026-10-15"), // today's future, excluded
    {...pair("12:40", 1000, 1000), earlierAi: 89}, // lower AI, excluded
    {...pair("13:00", 1000, 1000), outcomePrice: null}, // unsettled
    pair("14:30", 3000, 3000, "2026-10-13", "9999", 2970),
  ];
  const res = compareMatchedTimeByExclusiveBand(rows, "2026-10-15");
  const ten = res[0].slots.find(s => s.slot === "09:15");
  assert.equal(ten.matched, 1);
  assert.equal(ten.observedDays, 1);
  assert.equal(ten.precloseMeanPct, 4);
  assert.equal(ten.earlierMeanPct, 4);
  assert.equal(ten.differencePctPoints, 0);
  assert.equal(res[0].slots.find(s => s.slot === "09:30").matched, 0);
  assert.equal(res[0].slots.find(s => s.slot === "10:30").matched, 0);
  assert.equal(res[0].slots.find(s => s.slot === "12:40").matched, 0);
  assert.equal(res[0].slots.find(s => s.slot === "13:00").matched, 0);
  assert.equal(res[1].slots.find(s => s.slot === "14:30").matched, 1);
  assert.equal(res[1].slots.find(s => s.slot === "14:30").precloseWinRate, null);
});

test("later price can be better or worse; zero matched pair returns null instead of invented result", () => {
  const res = compareMatchedTimeByExclusiveBand([pair("09:15", 900, 1000, "2026-10-13", "1234", 1100)],"2026-10-15");
  const a = res[0].slots.find(s => s.slot === "09:15");
  assert.equal(a.precloseMeanPct, 10);
  assert.ok(a.earlierMeanPct > a.precloseMeanPct);
  assert.ok(a.differencePctPoints < 0);
  assert.equal(res[2].slots.find(s => s.slot === "09:30").earlierMeanPct, null);
});

test("owner-only UI and matched SQL stay read-only, bounded, and on frozen outcomes", () => {
  const page = readFileSync("app/admin/preclose-candidates/page.tsx", "utf8");
  const model = readFileSync("app/lib/research/precloseDisjointTimeStudy.ts", "utf8");
  assert.match(page, /getLearningOwnerSession\(\)/);
  assert.match(page, /if \(!isOwner\) notFound\(\)/);
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /o?e\.trade_date = p\.trade_date AND e\.code = p\.code/);
  assert.match(page, /e\.outcome_date = p\.outcome_date/);
  assert.match(page, /p\.outcome_date <= \(NOW\(\) AT TIME ZONE 'Asia\/Tokyo'\)::date/);
  assert.match(page, /INTERVAL '60 days'/);
  assert.match(page, /LIMIT 12000/);
  assert.match(page, /15:15 vs 他の6時刻/);
  assert.match(page, /重複なし・購入金額帯別の比較/);
  assert.doesNotMatch(page + model, /\b(INSERT INTO|UPDATE public|DELETE FROM|CREATE TABLE|runScan\(|sendNotification\(|pushWebToAll\()/i);
});
