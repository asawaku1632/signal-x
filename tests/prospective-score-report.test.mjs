import test from "node:test";import assert from "node:assert/strict";
import {prospectiveLedgerFromText as report} from "../scripts/report-prospective-score-ledger.mjs";
test("empty file produces safe shadow report",()=>{const x=report("[]");assert.equal(x.hasLiveSource,false);assert.equal(x.signalEnabled,false);assert.equal(x.comparableDays,0);});
test("pre-freeze rows are excluded",()=>{const x=report(JSON.stringify([{date:"2026-10-28",code:"1234",priorScore:85,price:100,nextPrice:110}]));assert.equal(x.excluded.preFreeze,1);});
test("unsourced future data cannot enter cohort",()=>{const x=report(JSON.stringify([{date:"2026-11-03",code:"1234",priorScore:85,price:100,nextPrice:110}]));assert.equal(x.eligibleRows,0);assert.equal(x.excluded.featureNotAsOf,1);});
test("file must be array",()=>assert.throws(()=>report("{}"),/INVALID_RESEARCH_ROWS/));
test("invalid JSON rejected",()=>assert.throws(()=>report("{")));
test("cannot turn on alerts via input",()=>{const x=report(JSON.stringify([{date:"2026-11-03",code:"1234",priorScore:90,price:100,nextPrice:120,signalEnabled:true}]));assert.equal(x.signalEnabled,false);});
