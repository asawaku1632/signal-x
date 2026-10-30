import test from "node:test";import assert from "node:assert/strict";
import {auditMarketRegimeEvidence as run} from "../app/lib/research/marketRegimeEvidence.mjs";
const base={tradeDate:"2026-10-30",capturedAt:"2026-10-30T08:45:00+09:00",nikkei:50000,topix:3200};
test("plausible level and time never prove regime",()=>{const x=run([base]);assert.equal(x.counts.structurallyPlausible,1);assert.equal(x.verifiedRegimeDays,0);assert.equal(x.readyForTraining,false);});
test("later capture rejected",()=>assert.equal(run([{...base,capturedAt:"2026-10-30T09:06:00+09:00"}]).counts.notAsOf,1));
test("missing index rejected",()=>assert.equal(run([{...base,topix:null}]).counts.invalid,1));
test("duplicate date rejected",()=>assert.equal(run([base,base]).counts.duplicate,1));
test("invalid date rejected",()=>assert.equal(run([{...base,tradeDate:"2026-11-31"}]).counts.invalid,1));
test("naive timestamp rejected",()=>assert.equal(run([{...base,capturedAt:"2026-10-30 08:45:00"}]).counts.notAsOf,1));
test("invalid input rejected",()=>assert.throws(()=>run(null),/INVALID_REGIME_EVIDENCE/));

test("previous-day index capture is not a same-day morning observation",()=>{const x=run([{...base,capturedAt:"2026-10-29T16:00:00+09:00"}]);assert.equal(x.counts.notAsOf,1);assert.equal(x.verifiedRegimeDays,0);});
test("same-day midnight capture stays unverified but structurally plausible",()=>{const x=run([{...base,capturedAt:"2026-10-30T00:00:00+09:00"}]);assert.equal(x.counts.structurallyPlausible,1);assert.equal(x.verifiedRegimeDays,0);});

test("explicit prior close reference never counts as same day capture",()=>{const x=run([{...base,observationType:"PRIOR_CLOSE_REFERENCE",capturedAt:"2026-10-29T16:00:00+09:00"}]);assert.equal(x.counts.priorCloseReferenceOnly,1);assert.equal(x.counts.structurallyPlausible,0);assert.equal(x.days[0].status,"PRIOR_CLOSE_REFERENCE_ONLY");assert.equal(x.readyForTraining,false);});
