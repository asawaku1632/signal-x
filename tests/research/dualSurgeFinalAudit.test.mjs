import test from "node:test";
import assert from "node:assert/strict";
import {auditDualSurgeRelease} from "../../app/lib/research/dualSurgeFinalAudit.mjs";
test("empty evidence blocks every gate and never approves release",()=>{const r=auditDualSurgeRelease();assert.equal(r.allOfflineChecksPass,false);assert.equal(r.blocked.length,7);assert.equal(r.releaseApproved,false);assert.equal(r.productionApproved,false);assert.equal(r.readOnly,true);});
test("provider-only synthetic assertion cannot approve release",()=>{const r=auditDualSurgeRelease({provider:{status:"APPROVED"}});assert.equal(r.releaseApproved,false);assert.ok(r.blocked.includes("provider"));});
test("pending statistical outcomes never approve release",()=>{const r=auditDualSurgeRelease({outcomes:[{status:"PENDING"}],baselineOutcomes:[{status:"PENDING"}]});assert.ok(r.blocked.includes("statistics"));});
