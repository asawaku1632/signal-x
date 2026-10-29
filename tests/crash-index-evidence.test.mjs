import test from "node:test";import assert from "node:assert/strict";
import {inspectCrashIndexEvidence as run} from "../app/lib/research/crashIndexEvidence.mjs";
const base={trade_date:"2026-10-22",selected_at:"2026-10-22T07:55:47.880Z",nikkei_close:62907.83984375,nikkei_previous_close:64621.23828125};
test("real-shaped saved index event is retrospective, not preopen evidence",()=>{const r=run([base]);assert.equal(r.counts.retrospective,1);assert.equal(r.rows[0].after0905,true);assert.equal(r.predecisionAuthenticated,0);assert.equal(r.tradingEnabled,false);});
test("duplicates do not inflate dates",()=>assert.equal(run([base,base]).counts.duplicate,1));
test("invalid prices are excluded",()=>assert.equal(run([{...base,nikkei_close:0}]).counts.invalid,1));
test("invalid calendar dates are excluded",()=>assert.equal(run([{...base,trade_date:"2026-11-31"}]).counts.invalid,1));
test("input must be an array",()=>assert.throws(()=>run(null),/INVALID_CRASH_INDEX_ROWS/));
