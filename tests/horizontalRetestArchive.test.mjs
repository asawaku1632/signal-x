import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  combineArchivedHorizontalTrades,
} from "../app/lib/research/horizontalRetestArchiveStats.ts";
import { HORIZONTAL_COMPARE_VERSION } from "../app/lib/research/horizontalRetestComparison.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
function trade(code, entry, pnl, volume = true, tech = false) {
  return {
    detector_version: HORIZONTAL_COMPARE_VERSION, code,
    breakout_time: 1780000000 + entry - 200000,
    retest_time: 1780000000 + entry - 100000,
    entry_time: 1780000000 + entry,
    exit_time: 1780000000 + entry + 86400,
    profit_yen_100: pnl, return_percent: pnl / 1000,
    volume_eligible: volume, technical_eligible: tech,
  };
}

test("same version/code/signal times saved in overlapping cohorts is counted once", () => {
  const a = trade("2760", 400000, -13135, false);
  const b = trade("8058", 600000, -5242, true);
  const result = combineArchivedHorizontalTrades([a, b, {...a}, {...b}]);
  assert.equal(result.uniqueTrades, 2);
  assert.equal(result.duplicateEventsDiscarded, 2);
  assert.equal(result.stockCountWithTrades, 2);
  assert.equal(result.rows[0].count, 2);
  assert.equal(result.rows[0].sumYen100, -18377);
  assert.equal(result.rows[1].count, 1);
  assert.equal(result.rows[1].sumYen100, -5242);
  assert.equal(result.rows[2].count, 0);
  assert.equal(result.rows[2].winRatePercent, null);
  assert.equal(result.rows[2].sumYen100, null);
});

test("additional valid entry in same code counts separately, different version cannot mix", () => {
  const original = trade("2760", 400000, -5000);
  const another = trade("2760", 800000, 4000, true, true);
  const stale = {...trade("8058", 1000000, 999999), detector_version:"shadow_horizontal_compare_v2"};
  const r = combineArchivedHorizontalTrades([original, another, stale]);
  assert.equal(r.uniqueTrades, 2);
  assert.equal(r.stockCountWithTrades, 1);
  assert.equal(r.rows[0].count, 2);
  assert.equal(r.rows[0].winRatePercent, 50);
  assert.equal(r.rows[2].count, 1);
  assert.equal(r.rows[2].sumYen100, 4000);
});

test("drawdown follows exit chronology and confirmed outcomes only", () => {
  const r = combineArchivedHorizontalTrades([
    trade("7203", 600000, 4000, true, true),
    trade("8058", 200000, -3000, true, true),
    trade("2760", 400000, -5000, true, true),
  ]);
  assert.equal(r.rows[0].count, 3);
  assert.equal(r.rows[0].sumYen100, -4000);
  assert.equal(r.rows[0].drawdownYen100, 8000);
});

test("invalid or impossible archives never become research events", () => {
  const a = trade("3182", 400000, 1000);
  const r = combineArchivedHorizontalTrades([
    {...a, code:"DROP TABLE"},
    {...a, technical_eligible: true, volume_eligible: false},
    {...a, return_percent:"NaN"},
    {...a, exit_time:a.retest_time},
  ]);
  assert.equal(r.uniqueTrades, 0);
  assert.ok(r.rows.every(x => x.count === 0 && x.winRatePercent === null));
});

test("save requires owner, validates max five, re-fetches server-side and inserts append-only", () => {
  const act = read("app/admin/horizontal-retest/actions.ts");
  const owner = act.indexOf("await getLearningOwnerSession()");
  const fetch = act.indexOf("await fetchCohort(codes)");
  const insert = act.indexOf("INSERT INTO public.horizontal_retest_archive_runs");
  assert.ok(owner > 0 && owner < fetch && fetch < insert);
  assert.match(act, /if \(!isOwner\) notFound\(\)/);
  assert.match(act, /codes\.length > 5/);
  assert.match(act, /new Set\(codes\)\.size !== codes\.length/);
  assert.match(act, /createHash\("sha256"\)/);
  assert.match(act, /compareHorizontalRetest\(studies\)/);
  assert.match(act, /loaded\.some\(row => row\.error \|\| row\.candles\.length < 60\)/);
  assert.match(act, /ON CONFLICT \(input_hash\) DO NOTHING/);
  assert.match(act, /ON CONFLICT \(detector_version, code, breakout_time, retest_time, entry_time\) DO NOTHING/);
  assert.match(act, /await client\.query\("BEGIN"\)/);
  assert.match(act, /await client\.query\("COMMIT"\)/);
  assert.doesNotMatch(act, /\b(?:UPDATE|DELETE|TRUNCATE)\s+(?:public\.|[a-z])/i);
  assert.doesNotMatch(act, /\b(?:runScan|sendLine|calculateAiScore|saveDisplaySnapshot)\s*\(/);
});

test("archive RLS restricts anonymous users and unique trade key is composite", () => {
  const sql = read("supabase/migrations/20261012_create_horizontal_retest_archive.sql");
  assert.match(sql, /PRIMARY KEY \(detector_version, code, breakout_time, retest_time, entry_time\)/);
  assert.match(sql, /input_hash text NOT NULL UNIQUE/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT SELECT, INSERT/);
  assert.match(sql, /TO service_role/);
  assert.doesNotMatch(sql, /CREATE\s+TRIGGER|CREATE\s+FUNCTION|ALTER\s+TABLE public\.(?!horizontal_retest_archive_)/i);
});

test("owner archive never performs fetches, and main research does not save on GET", () => {
  const page = read("app/admin/horizontal-retest/page.tsx");
  const history = read("app/admin/horizontal-retest/archive/page.tsx");
  assert.match(page, /<form action=\{saveHorizontalRetestStudy\}/);
  assert.match(page, /loaded\.length === codes\.length && loaded\.every/);
  assert.match(page, /href="\/admin\/horizontal-retest\/archive"/);
  assert.ok(history.indexOf("if (!isOwner) notFound()") < history.indexOf("pool.query<RunRow>"));
  assert.doesNotMatch(history, /\b(?:fetch|fetchCohort|INSERT|UPDATE|DELETE)\s*\(/i);
  assert.doesNotMatch(read("app/lib/learning/stockAnalyzer.ts"), /horizontalRetestArchive/);
  assert.doesNotMatch(read("app/lib/chartPatternEngine.ts"), /horizontalRetestArchive/);
});
