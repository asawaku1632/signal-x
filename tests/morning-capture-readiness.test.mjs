import test from "node:test";
import assert from "node:assert/strict";
import {auditMorningCaptureReadiness as audit} from "../app/lib/research/morningCaptureReadiness.mjs";
test("missing provenance is counted, not invented",()=>{
 const r=audit({snapshots:[{experimentId:"e",tradeDate:"2026-11-04",code:"7203",recordedAt:"2026-11-04T08:59:00+09:00"}],outcomes:[]});
 assert.equal(r.snapshot.records,1);assert.equal(r.snapshot.complete,0);
 assert.equal(r.snapshot.missingByField.provider,1);
 assert.equal(r.snapshot.missingByField.featureGeneratedAtUtc,1);
 assert.equal(r.collectionConfigured,false);assert.equal(r.decision,"DO_NOT_PROMOTE");
});
test("claimed complete metadata never proves independent source authentication",()=>{
 const s={experimentId:"e",tradeDate:"2026-11-04",code:"7203",recordedAt:"time",featureGeneratedAtUtc:"time",quoteObservedAtUtc:"time",barEndedAtUtc:"time",provider:"source",scoreVersion:"v1",sourceVerified:true,researchUseAllowed:true};
 const r=audit({snapshots:[s]});
 assert.equal(r.snapshot.complete,1);assert.equal(r.independentlyAuthenticated,false);
});
test("invalid collection rejected and empty lists kept",()=>{
 assert.throws(()=>audit({snapshots:null}),/INVALID_CAPTURE_ROWS/);
 assert.equal(audit().snapshot.records,0);
});
