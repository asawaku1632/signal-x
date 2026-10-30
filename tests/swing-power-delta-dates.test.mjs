import test from "node:test";import assert from "node:assert/strict";
import {auditSwingPowerDeltaDates as run} from "../app/lib/research/swingPowerDeltaDates.mjs";
const rows=[{date:"2026-10-09",upCount:385,downCount:131,upMean:-1.5901,downMean:1.8315},{date:"2026-10-13",upCount:242,downCount:262,upMean:-0.5804,downMean:-3.4538}];
test("two dated cohorts not 1020 independent experiments",()=>{const r=run(rows);assert.equal(r.comparableDates,2);assert.equal(r.upBetterDates,1);assert.equal(r.status,"INSUFFICIENT_INDEPENDENT_DATES");assert.equal(r.readyForTrading,false);});
test("leave-one-date-out visibly changes mean",()=>{const r=run(rows);assert.ok(r.leaveOneDateOutRange[0]<0);assert.ok(r.leaveOneDateOutRange[1]>0);});
test("small cohort excluded",()=>assert.equal(run([{...rows[0],upCount:9}]).insufficientDates,1));
test("duplicate date rejected",()=>assert.throws(()=>run([rows[0],rows[0]]),/DUPLICATE/));
test("invalid calendar rejected",()=>assert.throws(()=>run([{...rows[0],date:"2026-11-31"}]),/DATE/));
test("cannot enable training via thresholds",()=>assert.equal(run(rows,{minDates:2}).readyForTraining,false));
