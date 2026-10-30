import test from "node:test";
import assert from "node:assert/strict";
import {auditCandidateAdvantage as audit} from "../app/lib/research/candidateAdvantageAudit.mjs";
const row=(date,extra={})=>({tradeDate:date,code:"590A",ruleId:"frozen-v1",
  candidateReturnPct:1,baselineReturnPct:0,outOfSample:true,
  predecisionSnapshotVerified:true,outcomeProvenanceVerified:true,
  costsIncluded:true,baselinePredeclared:true,...extra});
test("empty data block",()=>{const r=audit([]);assert.equal(r.researchCandidate,false);assert.equal(r.productionEligible,false)});
test("unverified and lookahead rows excluded",()=>{const r=audit([row("2026-10-30",{outOfSample:false}),row("2026-02-30")]);assert.equal(r.counts.accepted,0);assert.equal(r.counts.invalid,2)});
test("duplicate candidate cannot inflate result",()=>{const a=row("2026-10-30");const r=audit([a,a]);assert.equal(r.counts.accepted,0);assert.equal(r.counts.duplicates,1)});
test("same-day multiple stocks weighted as one date",()=>{const r=audit([row("2026-10-30"),row("2026-10-30",{code:"641A",candidateReturnPct:-3})]);assert.equal(r.counts.tradingDays,1);assert.equal(r.metrics.dateMatchedMeanEdgePct,-1)});
test("unfrozen rule mix remains blocked",()=>{const r=audit([row("2026-10-30"),row("2026-10-29",{ruleId:"optimized-v2"})]);assert.ok(r.reasons.includes("REQUIRE_SINGLE_FIXED_RULE"))});
test("even strong multi-month evidence never activates production",()=>{
 const dates=["2026-07","2026-08","2026-09","2026-10"].flatMap(m=>Array.from({length:10},(_,i)=>m+"-"+String(i+1).padStart(2,"0")));
 const r=audit(dates.map(d=>row(d)));
 assert.equal(r.researchCandidate,true);
 assert.equal(r.productionEligible,false);assert.equal(r.notificationsEnabled,false);
 assert.deepEqual(r.reasons,["INDEPENDENT_AUDIT_AND_HUMAN_RELEASE_REQUIRED"]);
});
test("a rule that fails in later dates is not promising",()=>{
 const dates=["2026-07","2026-08","2026-09","2026-10"].flatMap(m=>Array.from({length:10},(_,i)=>m+"-"+String(i+1).padStart(2,"0")));
 const r=audit(dates.map((d,i)=>row(d,{candidateReturnPct:i<20?3:-1})));
 assert.equal(r.researchCandidate,false);
 assert.ok(r.reasons.includes("NO_SPLIT_PERIOD_REPLICATION"));
});
test("cannot relax research sample gate below safety minimum",()=>assert.throws(()=>audit([],{minDates:1}),/UNSAFE_RESEARCH_POLICY/));
