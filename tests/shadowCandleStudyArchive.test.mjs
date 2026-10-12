import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { combineArchivedShadowRuns } from "../app/lib/research/shadowCandleArchiveStats.ts";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function event(code, tradeDate, returns) {
  return {
    code, tradeDate, patternId: "SH_CDL_BULL_HARAMI", direction: "BUY",
    outcomes: [1, 3, 5].map((days, i) => ({
      days, date: returns[i] === null ? null : "2026-10-09",
      directionalReturn: returns[i],
    })),
  };
}
const version = "CANDLE9_V1";

test("repeated research runs never double count the same pattern event", () => {
  const rows = combineArchivedShadowRuns([
    { id: "a", detector_version: version, events: [event("3182","2026-05-14",[1,2,3])] },
    { id: "b", detector_version: version, events: [
      event("3182","2026-05-14",[1,2,3]),
      event("3387","2026-05-15",[-1,-3,-5]),
    ] },
  ]);
  const selected = rows.rows.find(x => x.patternId === "SH_CDL_BULL_HARAMI");
  assert.equal(rows.eventCount, 2);
  assert.equal(rows.stockCount, 2);
  assert.equal(selected.detections, 2);
  assert.equal(selected.horizons[2].completed, 2);
  assert.equal(selected.horizons[2].wins, 1);
  assert.equal(selected.horizons[2].winRate, 50);
  assert.equal(selected.horizons[2].meanReturn, -1);
});

test("future outcomes are filled once only when they become available", () => {
  const rows = combineArchivedShadowRuns([
    { id: "a", detector_version: version, events: [event("3182","2026-06-25",[1,null,null])] },
    { id: "b", detector_version: version, events: [event("3182","2026-06-25",[1,2,4])] },
  ]);
  const selected = rows.rows.find(x => x.patternId === "SH_CDL_BULL_HARAMI");
  assert.deepEqual(selected.horizons.map(h => h.completed), [1,1,1]);
  assert.deepEqual(selected.horizons.map(h => h.meanReturn), [1,2,4]);
  assert.equal(rows.eventCount, 1);
});

test("different detector versions and malformed archived event rows are excluded", () => {
  const rows = combineArchivedShadowRuns([
    { id: "a", detector_version:"CANDLE9_V2", events:[event("3182","2026-05-14",[10,10,10])] },
    { id: "b", detector_version:version, events:[{ ...event("3182","invalid",[1,2,3]) }] },
  ]);
  assert.equal(rows.eventCount, 0);
  assert.equal(rows.rows.every(x => x.horizons.every(h => h.completed === 0)), true);
});

test("save action re-authenticates and NEVER trusts client result metrics", () => {
  const action = read("app/admin/shadow-candlestick-nine/batch/actions.ts");
  const auth = action.indexOf("await getLearningOwnerSession()");
  const fetchIndex = action.indexOf("await fetchCohort(parsed.codes)");
  assert.ok(auth > 0 && auth < fetchIndex);
  assert.match(action, /if \(!isOwner\) notFound\(\)/);
  assert.match(action, /parseShadowBatchCodes\(raw\)/);
  assert.match(action, /loaded\.some\(row => row\.error \|\| !row\.candles\.length\)/);
  assert.match(action, /ON CONFLICT \(input_hash\) DO NOTHING/);
  assert.match(action, /createHash\("sha256"\)/);
  assert.doesNotMatch(action, /\b(?:UPDATE|DELETE|TRUNCATE)\s+(?:[A-Za-z_]+|public\.)/i);
  assert.doesNotMatch(action, /\b(?:runScan|saveDisplaySnapshot|sendLine|calculateAiScore)\s*\(/);
  const page = read("app/admin/shadow-candlestick-nine/batch/page.tsx");
  assert.match(page, /<form action=\{saveShadowCandleBatch\}/);
  assert.match(page, /研究結果を保存（1回だけ再取得）/);
  assert.match(page, /prefetch=\{false\}/);
});

test("research archive is guarded and cannot fetch Yahoo charts just by viewing history", () => {
  const source = read("app/admin/shadow-candlestick-nine/archive/page.tsx");
  const auth = source.indexOf("if (!isOwner) notFound()");
  const dbRead = source.indexOf("await pool.query<SavedRun>");
  assert.ok(auth > 0 && auth < dbRead);
  assert.match(source, /combineArchivedShadowRuns\(runs\)/);
  assert.doesNotMatch(source, /\b(?:fetch|fetchCohort|runScan|INSERT|UPDATE|DELETE)\s*\(/i);
  const schema = read("supabase/migrations/20261012_create_shadow_candle_research_runs.sql");
  assert.match(schema, /enable row level security/);
  assert.match(schema, /revoke all on table public\.shadow_candle_research_runs from public, anon, authenticated/);
  assert.match(schema, /grant select, insert on table public\.shadow_candle_research_runs to service_role/);
  assert.match(read("app/admin/learning-hub/page.tsx"), /href: "\/admin\/shadow-candlestick-nine\/archive"/);
});
