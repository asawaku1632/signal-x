import test from "node:test";
import assert from "node:assert/strict";
import {adjustmentStatus,groupEvents,fiveDayOutcome,nextOpenReturn} from "../../app/lib/research/dualSurgeEvaluation.mjs";
const dates=["D1","D2","D3","D4","D5","D6","D7","D8"];
const bars=Array.from({length:8},(_,i)=>({open:100+i,close:100+i,adjFactor:1}));
test("missing and malformed adjustment factors fail closed",()=>{for(const x of [undefined,null,"1",NaN,0,-1])assert.equal(adjustmentStatus(x),"EXCLUDED_UNKNOWN_ADJUSTMENT")});
test("split factor excluded",()=>assert.equal(adjustmentStatus(.5),"EXCLUDED_CORPORATE_ACTION"));
test("normal factor eligible",()=>assert.equal(adjustmentStatus(1),"ELIGIBLE"));
test("consecutive signals are one event",()=>{const e=groupEvents([{date:"D1",cohort:"PRE"},{date:"D2",cohort:"PRE"}],dates);assert.equal(e.length,1);assert.equal(e[0].signalDays,2)});
test("separated signals are separate events",()=>assert.equal(groupEvents([{date:"D1",cohort:"PRE"},{date:"D3",cohort:"PRE"}],dates).length,2));
test("different cohort starts new event",()=>assert.equal(groupEvents([{date:"D1",cohort:"PRE"},{date:"D2",cohort:"START"}],dates).length,2));
test("unrecognized session rejected",()=>assert.throws(()=>groupEvents([{date:"BAD",cohort:"PRE"}],dates),/UNKNOWN_SESSION/));
test("unmatured horizon is pending, not loss",()=>assert.deepEqual(fiveDayOutcome(bars,5),{status:"PENDING",returnPct:null}));
test("matured five-day close return",()=>assert.deepEqual(fiveDayOutcome(bars,0),{status:"MATURED",returnPct:5}));
test("future corporate action invalidates label",()=>{const b=structuredClone(bars);b[3].adjFactor=2;assert.equal(fiveDayOutcome(b,0).status,"EXCLUDED_CORPORATE_OR_UNKNOWN_ADJUSTMENT")});
test("unknown factor invalidates label",()=>{const b=structuredClone(bars);delete b[3].adjFactor;assert.equal(fiveDayOutcome(b,0).status,"EXCLUDED_CORPORATE_OR_UNKNOWN_ADJUSTMENT")});
test("next open is distinct from signal close",()=>{const b=structuredClone(bars);b[1].open=110;assert.equal(nextOpenReturn(b,0).returnPct,Number(((105/110-1)*100).toFixed(3)));assert.equal(fiveDayOutcome(b,0).returnPct,5)});
test("next-open pending when future unavailable",()=>assert.equal(nextOpenReturn(bars,6).status,"PENDING"));

test("interleaved cohorts merge independently",()=>{const e=groupEvents([{date:"D1",cohort:"PRE"},{date:"D1",cohort:"START"},{date:"D2",cohort:"PRE"}],dates);assert.equal(e.length,2);assert.equal(e.find(x=>x.cohort==="PRE").signalDays,2)});
test("duplicate same-cohort signal rejected",()=>assert.throws(()=>groupEvents([{date:"D1",cohort:"PRE"},{date:"D1",cohort:"PRE"}],dates),/DUPLICATE_SIGNAL/));
test("different cohorts on same session retained",()=>assert.equal(groupEvents([{date:"D1",cohort:"PRE"},{date:"D1",cohort:"START"}],dates).length,2));
test("invalid cohort rejected",()=>assert.throws(()=>groupEvents([{date:"D1",cohort:""}],dates),/INVALID_SIGNAL/));
test("duplicate sessions rejected",()=>assert.throws(()=>groupEvents([],["D1","D1"]),/INVALID_SESSIONS/));

test("null intermediate bar excluded instead of throwing",()=>{const b=structuredClone(bars);b[3]=null;assert.equal(fiveDayOutcome(b,0).status,"EXCLUDED_MISSING_DATA");assert.equal(nextOpenReturn(b,0).status,"EXCLUDED_MISSING_DATA")});
test("string close price excluded",()=>{const b=structuredClone(bars);b[5].close="105";assert.equal(fiveDayOutcome(b,0).status,"EXCLUDED_MISSING_DATA")});
test("string entry open price excluded",()=>{const b=structuredClone(bars);b[1].open="101";assert.equal(nextOpenReturn(b,0).status,"EXCLUDED_MISSING_DATA")});

test("null existing entry is excluded not pending",()=>{const b=structuredClone(bars);b[1]=null;assert.equal(nextOpenReturn(b,0).status,"EXCLUDED_MISSING_DATA")});
test("null existing exit is excluded not pending",()=>{const b=structuredClone(bars);b[5]=null;assert.equal(nextOpenReturn(b,0).status,"EXCLUDED_MISSING_DATA")});
test("future session outside array remains pending",()=>assert.equal(nextOpenReturn(bars,6).status,"PENDING"));

test("null existing future close is excluded not pending",()=>{const b=structuredClone(bars);b[5]=null;assert.equal(fiveDayOutcome(b,0).status,"EXCLUDED_MISSING_DATA")});

test("sparse missing intermediate bar excludes five-day close outcome",()=>{const b=structuredClone(bars);delete b[3];assert.equal(fiveDayOutcome(b,0).status,"EXCLUDED_MISSING_DATA")});
test("sparse missing intermediate bar excludes next-open outcome",()=>{const b=structuredClone(bars);delete b[3];assert.equal(nextOpenReturn(b,0).status,"EXCLUDED_MISSING_DATA")});
