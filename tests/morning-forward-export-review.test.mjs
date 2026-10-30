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

test("report explicitly blocks sparse and low-pair-coverage forward evidence",()=>{
 const d="2026-11-04",snapshots=[snapshot(d,"7203"),snapshot(d,"6758")];
 const r=review({snapshots,outcomes:[result(d,"7203",0,1)]});
 assert.equal(r.pairCoverage,0.5);assert.equal(r.observedMonths,1);
 assert.ok(r.blockers.includes("INSUFFICIENT_PAIR_COVERAGE"));
 assert.ok(r.blockers.includes("INSUFFICIENT_FORWARD_MONTHS"));
 assert.equal(r.decision,"DO_NOT_PROMOTE");
});
test("orphan outcome keys are surfaced and never counted as paired results",()=>{
 const d="2026-11-04";
 const r=review({snapshots:[snapshot(d,"7203")],outcomes:[result(d,"7203",0,1),result(d,"6758",0,10)]});
 assert.equal(r.reconciledPairs,1);assert.equal(r.orphanOutcomeKeys,1);
 assert.ok(r.blockers.includes("ORPHAN_OUTCOMES"));
 assert.equal(r.equalDateImprovementPp,1);
});
test("empty exports report no inferred coverage",()=>{
 const r=review({snapshots:[],outcomes:[]});
 assert.equal(r.pairCoverage,null);assert.equal(r.equalDateImprovementPp,null);
 assert.ok(r.blockers.includes("NO_PREDECISION_SNAPSHOTS"));
});

test("unmatched stocks keep their trading date visibly incomplete",()=>{
 const a="2026-11-04",b="2026-11-05";
 const r=review({snapshots:[snapshot(a,"7203"),snapshot(a,"6758"),snapshot(b,"9984")],
  outcomes:[result(a,"7203",0,10),result(b,"9984",0,-2)]});
 assert.deepEqual(r.dateCoverage.map(x=>x.coverage),[0.5,1]);
 assert.equal(r.incompleteDates,1);assert.equal(r.completeDates,1);
 assert.equal(r.equalDateImprovementPp,4);
 assert.equal(r.completeDateImprovementPp,-2);
 assert.ok(r.blockers.includes("INCOMPLETE_TRADING_DATES"));
 assert.equal(r.decision,"DO_NOT_PROMOTE");
});

test("sample-depth audit separates thin dates from ten-pair dates",()=>{
 const d="2026-11-04",s=Array.from({length:10},(_,i)=>snapshot(d,String(1000+i)));
 const o=s.map((x,i)=>result(d,x.code,0,i===0?10:0));
 const r=review({snapshots:s,outcomes:o});
 assert.equal(r.datesWith10Pairs,1);
 assert.equal(r.tenPairDateImprovementPp,1);
 assert.equal(r.positiveDays,1);
 assert.equal(r.decision,"DO_NOT_PROMOTE");
});
test("thin samples remain unqualified for ten-pair comparison",()=>{
 const d="2026-11-04",r=review({snapshots:[snapshot(d,"7203")],outcomes:[result(d,"7203",0,2)]});
 assert.equal(r.datesWith10Pairs,0);
 assert.equal(r.tenPairDateImprovementPp,null);
 assert.ok(r.blockers.includes("NO_DATES_WITH_10_PAIRS"));
});
