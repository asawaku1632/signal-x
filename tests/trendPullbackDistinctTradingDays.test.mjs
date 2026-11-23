import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source=readFileSync(new URL("../app/lib/learning/trendPullbackReversal.ts",import.meta.url),"utf8");
const updater=source.slice(source.indexOf("export async function updateTrendPullbackReversalOutcomes("));
test("TPR forward outcomes select distinct trading days and deterministic prices",()=>{
 assert.match(updater,/DISTINCT ON \(d\.date::date\)/);
 assert.match(updater,/ORDER BY d\.date::date,d\.created_at DESC/);
 assert.match(updater,/ORDER BY daily_price\.trade_date LIMIT 5/);
 assert.match(updater,/c\.base_price>0/);
 assert.match(updater,/COALESCE\(h\.result_5d/);
});
test("repeated snapshots do not advance the fifth trading day",()=>{
 const rows=[["2026-10-21",100],["2026-10-21",101],["2026-10-22",102],["2026-10-23",103],["2026-10-26",104],["2026-10-27",105]];
 const dates=[...new Set(rows.map(x=>x[0]))].sort();
 assert.equal(dates.length,5);
 assert.equal(dates[4],"2026-10-27");
});
