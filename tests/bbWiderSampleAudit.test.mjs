import test from "node:test";
import assert from "node:assert/strict";
import {consolidateCohortEvents,broadCohortAudit} from "../scripts/research/bb-wider-sample-audit.mjs";
const r=(after5dPct,patterns=["MARUBOZU"])=>({code:"8053",date:"2026-10-27",slot:"14:15",
 marketRegime:"DOWN",patterns,after5dPct});
test("same code,date,time in overlapping cohorts is not double counted",()=>{
 const a=consolidateCohortEvents([r(null),r(-6.7667)]);
 assert.equal(a.events.length,1);
 assert.equal(a.events[0].after5dPct,-6.7667);
});
test("different mature outcomes or patterns quarantine duplicates",()=>{
 const a=consolidateCohortEvents([r(-6.7),r(-2)]);
 assert.equal(a.events.length,0);
 assert.equal(a.quarantinedSignalKeys,1);
 const b=consolidateCohortEvents([r(-6.7),r(-6.7,["ENGULFING"])]);
 assert.equal(b.events.length,0);
});
test("reject missing benchmark and never produce production rules",()=>{
 assert.throws(()=>broadCohortAudit({benchmark:{benchmark:"NIKKEI225"},entries:[]}),/TOPIX_REQUIRED/);
});
