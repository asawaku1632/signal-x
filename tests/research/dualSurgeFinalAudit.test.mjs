import test from "node:test";
import assert from "node:assert/strict";
import {auditDualSurgeRelease} from "../../app/lib/research/dualSurgeFinalAudit.mjs";
test("empty evidence blocks every gate and never approves release",()=>{const r=auditDualSurgeRelease();assert.equal(r.allOfflineChecksPass,false);assert.equal(r.blocked.length,8);assert.equal(r.releaseApproved,false);assert.equal(r.productionApproved,false);assert.equal(r.readOnly,true);});
test("provider-only synthetic assertion cannot approve release",()=>{const r=auditDualSurgeRelease({provider:{status:"APPROVED"}});assert.equal(r.releaseApproved,false);assert.ok(r.blocked.includes("provider"));});
test("pending statistical outcomes never approve release",()=>{const r=auditDualSurgeRelease({outcomes:[{status:"PENDING"}],baselineOutcomes:[{status:"PENDING"}]});assert.ok(r.blocked.includes("statistics"));});

test("forward audit without sessions remains blocked",()=>{const r=auditDualSurgeRelease({forward:{bars:[],signalDate:"2026-10-01",asOfDate:"2026-10-11"}});assert.ok(r.blocked.includes("forward"));});
test("partial forward horizons remain blocked",()=>{const bars=Array.from({length:3},(_,i)=>({date:"2026-10-0"+(i+1),close:100+i,adjFactor:1}));const r=auditDualSurgeRelease({forward:{bars,signalDate:"2026-10-01",asOfDate:"2026-10-03"}});assert.ok(r.blocked.includes("forward"));});
test("complete synthetic forward outcomes pass only forward gate",()=>{const bars=Array.from({length:11},(_,i)=>({date:"2026-10-"+String(i+1).padStart(2,"0"),close:100+i,adjFactor:1}));const r=auditDualSurgeRelease({forward:{bars,signalDate:"2026-10-01",asOfDate:"2026-10-11"}});assert.equal(r.checks.forward,true);assert.equal(r.releaseApproved,false);assert.equal(r.productionApproved,false);});
