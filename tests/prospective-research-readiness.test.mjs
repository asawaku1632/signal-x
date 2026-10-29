import test from "node:test";import assert from "node:assert/strict";
import {summarizeProspectiveResearch as summarize} from "../app/lib/research/prospectiveResearchReadiness.mjs";
test("empty prospective evidence remains blocked",()=>{const r=summarize([]);assert.equal(r.stability.dates,0);assert.ok(r.blockers.includes("INSUFFICIENT_DATES"));assert.ok(r.blockers.includes("EXTERNAL_AUTHENTICATION_MISSING"));assert.equal(r.trainingEnabled,false);});
test("reported verification cannot authorize trading",()=>{const r=summarize([],{minDays:2,minMonths:2});assert.equal(r.tradingEnabled,false);assert.equal(r.notificationsEnabled,false);});
test("invalid month requirement rejected",()=>assert.throws(()=>summarize([],{minMonths:1}),/INVALID_MONTH_REQUIREMENT/));
test("invalid ledger input rejected",()=>assert.throws(()=>summarize(null),/INVALID_PROSPECTIVE_LEDGER/));

test("duplicate prospective stock/date inputs trigger explicit review blocker",()=>{
 const row={date:"2026-10-30",code:"7203",priorScore:85,price:1000,featureSnapshotVerified:true,featureAvailableAt:"2026-10-29T16:00:00+09:00",nextPrice:1050,outcomeSourceVerified:true,outcomeTradeDate:"2026-11-02",outcomeAvailableAt:"2026-11-02T16:00:00+09:00"};
 const x=summarize([row,row]);assert.ok(x.blockers.includes("DUPLICATE_STOCK_DAY_RECORDS"));assert.equal(x.trainingEnabled,false);
});
test("unverified as-of source gets explicit blocker",()=>{
 const row={date:"2026-10-30",code:"7203",priorScore:85,price:1000,featureSnapshotVerified:false,featureAvailableAt:"2026-10-29T16:00:00+09:00"};
 assert.ok(summarize([row]).blockers.includes("FEATURE_AS_OF_EVIDENCE_MISSING"));
});

test("descriptive evidence remains distinct from independently attested proof",()=>{
 const x=summarize([]);
 assert.equal(x.evidence.observedTradingDates,0);
 assert.equal(x.evidence.descriptiveMeanGapPp,null);
 assert.equal(x.evidence.independentSourceAttestation,false);
 assert.equal(x.evidence.chronologicalHoldoutVerified,false);
 assert.equal(x.trainingEnabled,false);
});
