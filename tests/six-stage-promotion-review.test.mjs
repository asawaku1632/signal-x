import test from "node:test";
import assert from "node:assert/strict";
import {reviewSixStagePromotion as review} from "../app/lib/research/sixStagePromotionReview.mjs";
const snap=(date,experimentId)=>({tradeDate:date,experimentId,recordedAt:date+"T08:59:00+09:00",
 sourceVerified:true,independentTimeAttestation:true,outcomeNotYetKnown:true});
const comp=(date,experimentId,candidateReturn=1)=>({tradeDate:date,experimentId,baselineReturn:0,candidateReturn,benchmarkReturn:0,outcomeSourceVerified:true,outcomeAvailableAt:date+"T16:00:00+09:00"});
test("no verified inputs remain blocked at sixth stage",()=>{
 const x=review();assert.equal(x.stage6.decision,"DO_NOT_PROMOTE");
 assert.equal(x.stage6.comparisonDates,0);assert.equal(x.productionChanged,false);
 assert.equal(x.trainingEnabled,false);assert.equal(x.rankingsChanged,false);
 assert.equal(x.notificationsEnabled,false);assert.equal(x.tradingEnabled,false);
});
test("one claimed snapshot matches one experiment and date but cannot authorize release",()=>{
 const x=review({snapshots:[snap("2026-11-04","fixed-a")],comparisons:[comp("2026-11-04","fixed-a"),comp("2026-11-04","other")]});
 assert.equal(x.stage6.comparisonDates,1);
 assert.equal(x.stage6.rejectedUnanchoredComparisonRows,1);
 assert.equal(x.stage6.pairedDateMeanGap,1);
 assert.equal(x.stage6.decision,"DO_NOT_PROMOTE");
 assert.ok(x.stage6.blockers.includes("INDEPENDENT_SOURCE_ATTESTATION_MISSING"));
});
test("date-only matches cannot substitute for immutable experiment identifiers",()=>{
 const x=review({snapshots:[snap("2026-11-04","a")],comparisons:[comp("2026-11-04","b")]});
 assert.equal(x.stage6.comparisonDates,0);
});
test("duplicated experiment-date pairs are discarded, not double weighted",()=>{
 const x=review({snapshots:[snap("2026-11-04","a")],comparisons:[comp("2026-11-04","a"),comp("2026-11-04","a")]});
 assert.equal(x.stage6.duplicateExperimentDatePairs,1);
 assert.equal(x.stage6.comparisonDates,0);
});
test("even optimistic multi-month caller claims fail independent release review",()=>{
 const months=["2026-11","2026-12","2027-01"];
 const pairs=months.flatMap(m=>Array.from({length:7},(_,i)=>({d:`${m}-${String(i+1).padStart(2,"0")}`,id:`${m}-${i}`})));
 const x=review({snapshots:pairs.map(p=>snap(p.d,p.id)),comparisons:pairs.map(p=>comp(p.d,p.id,10))});
 assert.equal(x.stage6.comparisonDates,21);
 assert.equal(x.stage6.comparisonMonths,3);
 assert.equal(x.stage6.pairedDateMeanGap,10);
 assert.equal(x.stage6.decision,"DO_NOT_PROMOTE");
 assert.equal(x.stage6.independentlyValidated,false);
 assert.equal(x.trainingEnabled,false);
});

test("a snapshot from a previous day cannot masquerade as the 09:05 signal",()=>{
 const s={...snap("2026-11-04","a"),recordedAt:"2026-11-03T08:59:00+09:00"};
 const x=review({snapshots:[s],comparisons:[comp("2026-11-04","a")]});
 assert.equal(x.stage6.comparisonDates,0);
 assert.equal(x.stage6.rejectedUnanchoredComparisonRows,1);
 assert.equal(x.stage6.decision,"DO_NOT_PROMOTE");
});
test("duplicated snapshot for same experiment and day invalidates matching outcome",()=>{
 const s=snap("2026-11-04","a");
 const x=review({snapshots:[s,{...s,recordedAt:"2026-11-04T09:00:00+09:00"}],comparisons:[comp("2026-11-04","a")]});
 assert.equal(x.stage6.comparisonDates,0);
 assert.equal(x.stage6.duplicateSnapshotExperimentDatePairs,1);
 assert.ok(x.stage6.blockers.includes("DUPLICATE_SNAPSHOT_EXPERIMENT_DATE"));
});

test("missing or predecision outcomes never count as matured results",()=>{
 const d="2026-11-04",s=snap(d,"a"),good=comp(d,"a");
 for(const value of [undefined,"2026-11-04T09:04:59+09:00","2026-11-04 16:00:00"]){
  const x=review({snapshots:[s],comparisons:[{...good,outcomeAvailableAt:value}]});
  assert.equal(x.stage6.comparisonDates,0);
  assert.ok(x.stage6.blockers.includes("OUTCOME_AVAILABILITY_NOT_PROVEN"));
  assert.equal(x.stage6.decision,"DO_NOT_PROMOTE");
 }
});
