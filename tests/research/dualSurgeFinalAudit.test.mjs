import test from "node:test";
import assert from "node:assert/strict";
import {auditDualSurgeRelease} from "../../app/lib/research/dualSurgeFinalAudit.mjs";
test("empty evidence blocks every gate and never approves release",()=>{const r=auditDualSurgeRelease();assert.equal(r.allOfflineChecksPass,false);assert.equal(r.blocked.length,8);assert.equal(r.releaseApproved,false);assert.equal(r.productionApproved,false);assert.equal(r.readOnly,true);});
test("provider-only synthetic assertion cannot approve release",()=>{const r=auditDualSurgeRelease({provider:{status:"APPROVED"}});assert.equal(r.releaseApproved,false);assert.ok(r.blocked.includes("provider"));});
test("pending statistical outcomes never approve release",()=>{const r=auditDualSurgeRelease({outcomes:[{status:"PENDING"}],baselineOutcomes:[{status:"PENDING"}]});assert.ok(r.blocked.includes("statistics"));});

test("forward audit without sessions remains blocked",()=>{const r=auditDualSurgeRelease({forward:{bars:[],signalDate:"2026-10-01",asOfDate:"2026-10-11"}});assert.ok(r.blocked.includes("forward"));});
test("partial forward horizons remain blocked",()=>{const bars=Array.from({length:3},(_,i)=>({date:"2026-10-0"+(i+1),close:100+i,adjFactor:1}));const r=auditDualSurgeRelease({forward:{bars,signalDate:"2026-10-01",asOfDate:"2026-10-03"}});assert.ok(r.blocked.includes("forward"));});
test("complete synthetic forward outcomes pass only forward gate",()=>{const bars=Array.from({length:11},(_,i)=>({date:"2026-10-"+String(i+1).padStart(2,"0"),close:100+i,adjFactor:1}));const r=auditDualSurgeRelease({forward:{bars,signalDate:"2026-10-01",asOfDate:"2026-10-11"}});assert.equal(r.checks.forward,true);assert.equal(r.releaseApproved,false);assert.equal(r.productionApproved,false);});

test("custom one-day-only horizons cannot bypass required forward windows",()=>{const bars=Array.from({length:3},(_,i)=>({date:"2026-10-0"+(i+1),close:100+i,adjFactor:1}));const r=auditDualSurgeRelease({forward:{bars,signalDate:"2026-10-01",asOfDate:"2026-10-03",horizons:[1]}});assert.equal(r.checks.forward,false);assert.ok(r.blocked.includes("forward"));});
test("custom subset of mature horizons cannot bypass ten-day window",()=>{const bars=Array.from({length:7},(_,i)=>({date:"2026-10-0"+(i+1),close:100+i,adjFactor:1}));const r=auditDualSurgeRelease({forward:{bars,signalDate:"2026-10-01",asOfDate:"2026-10-07",horizons:[1,3,5]}});assert.equal(r.checks.forward,false);});

test("invalid statistical rows fail closed without throwing",()=>{const r=auditDualSurgeRelease({outcomes:[{status:"MATURED",returnPct:NaN}],baselineOutcomes:[]});assert.equal(r.checks.statistics,false);assert.ok(r.blocked.includes("statistics"));assert.equal(r.productionApproved,false);});
test("non-array statistical input fails closed without throwing",()=>{const r=auditDualSurgeRelease({outcomes:{status:"MATURED"},baselineOutcomes:[]});assert.equal(r.checks.statistics,false);assert.equal(r.releaseApproved,false);});
test("null final audit input remains blocked",()=>{const r=auditDualSurgeRelease(null);assert.equal(r.allOfflineChecksPass,false);assert.equal(r.productionApproved,false);});

test("null evidence fails closed instead of throwing",()=>{const r=auditDualSurgeRelease({evidence:null});assert.equal(r.checks.evidence,false);assert.equal(r.productionApproved,false);});
test("malformed readiness evidence fails closed instead of throwing",()=>{const r=auditDualSurgeRelease({evidence:[]});assert.equal(r.checks.evidence,false);assert.ok(r.blocked.includes("evidence"));});
test("invalid provider input cannot crash the release audit",()=>{const r=auditDualSurgeRelease({provider:{status:"APPROVED",permissions:Symbol("bad")}});assert.equal(r.releaseApproved,false);assert.equal(r.productionApproved,false);});
