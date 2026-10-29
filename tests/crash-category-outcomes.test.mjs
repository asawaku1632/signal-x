import test from "node:test";import assert from "node:assert/strict";
import {auditCrashCategoryOutcomes as run} from "../app/lib/research/crashCategoryOutcomes.mjs";
const rows=[{eventDate:"2026-10-22",code:"1234",category:"REBOUND_WATCH",excessReturn:-1.5},{eventDate:"2026-10-22",code:"5678",category:"RESISTANCE",excessReturn:2}];
test("multiple stocks on one event are not independent dates",()=>{const x=run(rows);assert.equal(x.distinctEvents,1);assert.equal(x.researchStatus,"INSUFFICIENT_INDEPENDENT_EVENTS");assert.equal(x.categories.length,2);assert.equal(x.tradingEnabled,false);});
test("duplicate code within event not counted twice",()=>assert.equal(run([...rows,rows[0]]).duplicates,1));
test("invalid outcome excluded",()=>assert.equal(run([{...rows[0],excessReturn:NaN}]).excluded,1));
test("different event dates counted separately",()=>assert.equal(run([...rows,{...rows[0],eventDate:"2026-10-23"}]).distinctEvents,2));
test("never allows training from user-supplied records",()=>assert.equal(run(rows,{minEvents:2}).trainingEnabled,false));
test("invalid input rejected",()=>assert.throws(()=>run(null),/INVALID_CRASH_OUTCOMES/));
