import test from "node:test";
import assert from "node:assert/strict";
import {reviewMorningForwardExport as review} from "../app/lib/research/morningForwardExportReview.mjs";
const snapshot=(date,code)=>({experimentId:"v1",tradeDate:date,code,recordedAt:date+"T08:59:00+09:00",sourceVerified:true,researchUseAllowed:true});
const result=(date,code,baselineReturn,candidateReturn)=>({experimentId:"v1",tradeDate:date,code,outcomeAvailableAt:date+"T16:00:00+09:00",outcomeSourceVerified:true,baselineReturn,candidateReturn});
test("daily means are equally weighted rather than stock-count weighted",()=>{
 const a="2026-11-04",b="2026-11-05";
 const snapshots=[snapshot(a,"7203"),snapshot(a,"6758"),snapshot(b,"9984")];
 const outcomes=[result(a,"7203",0,4),result(a,"6758",0,2),result(b,"9984",0,-1)];
 const r=review({snapshots,outcomes});
 assert.equal(r.observedDates,2);assert.equal(r.reconciledPairs,3);
 assert.equal(r.equalDateImprovementPp,1);assert.equal(r.decision,"DO_NOT_PROMOTE");
 assert.equal(r.independentlyAuthenticated,false);
});
test("missing outcomes lower paired coverage without manufacturing zero returns",()=>{
 const r=review({snapshots:[snapshot("2026-11-04","7203")],outcomes:[]});
 assert.equal(r.reconciledPairs,0);assert.equal(r.observedDates,0);
 assert.equal(r.equalDateImprovementPp,null);assert.equal(r.unmatchedSnapshots,1);
});
test("inputs are bounded and invalid input fails closed",()=>{
 assert.throws(()=>review({snapshots:null,outcomes:[]}),/INVALID_FORWARD_EXPORT_ARRAYS/);
 assert.throws(()=>review({snapshots:[],outcomes:new Array(100001).fill(0)}),/INVALID_FORWARD_EXPORT_ARRAYS/);
});
