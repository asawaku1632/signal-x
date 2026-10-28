import test from "node:test";import assert from "node:assert/strict";
import {auditResearchIntegration as audit} from "../app/lib/learning/researchIntegrationAudit.mjs";
const agg=()=>({total:2,days:1,stocks:2,completed5:1,pending5:1,undated5:0,invalid_date:0,invalid_inputs:0,duplicates:0});
const row=(code="590A")=>({trade_date:"2026-10-08",code,entry_price:100,ai_power:55,captured_at:"2026-10-08T07:00:00Z",return_5d:1,outcome_5d_date:"2026-10-16",rule_version:"r1"});
const proof=(code="590A")=>({trade_date:"2026-10-08",code,independent_verified:true,license_verified:true,baseline_paired:true,shadow_paired:true,forward_holdout_verified:true});
const run=(a=agg(),rows=[row(),row("641A")],evidence=[proof(),proof("641A")],options={})=>audit(a,rows,evidence,options);
test("all declared proof still blocked",()=>{const r=run();assert.equal(r.status,"BLOCKED");assert.equal(r.adoptable,false);assert.equal(r.notificationAllowed,false);assert.equal(r.productionMutationAllowed,false)});
test("three components all block",()=>assert.deepEqual(run().checks,{coverage:"BLOCKED",gaps:"BLOCKED",reconciliation:"BLOCKED"}));
const cases=[
 ["missing aggregate",null,undefined,undefined,"INVALID_SUMMARY"],
 ["empty aggregate",{},undefined,undefined,"INVALID_COUNT_total"],
 ["bad count",{...agg(),completed5:-1},undefined,undefined,"INVALID_COUNT_completed5"],
 ["negative pending",{...agg(),pending5:-1},undefined,undefined,"INVALID_COUNT_pending5"],
 ["wrong completion",{...agg(),completed5:0},undefined,undefined,"FIVE_DAY_COVERAGE_INCONSISTENT"],
 ["invalid date count",{...agg(),invalid_date:1},undefined,undefined,"OUTCOME_DATE_ORDER_INVALID"],
 ["input errors",{...agg(),invalid_inputs:1},undefined,undefined,"INPUT_RANGE_INVALID"],
 ["duplicate aggregate",{...agg(),duplicates:1},undefined,undefined,"DUPLICATE_OBSERVATIONS"],
 ["no outcomes",{...agg(),completed5:0,pending5:2},undefined,undefined,"NO_COMPLETED_FIVE_DAY_DATA"],
 ["missing row",undefined,[row()],undefined,"PARTIAL_OBSERVATION_SAMPLE"],
 ["extra rows",undefined,[row(),row("641A"),row("642A")],undefined,"SAMPLE_EXCEEDS_REPORTED_TOTAL"],
 ["empty rows",undefined,[],undefined,"PARTIAL_OBSERVATION_SAMPLE"],
 ["invalid rows",undefined,null,undefined,"INVALID_BATCH"],
 ["invalid evidence",undefined,undefined,null,"INVALID_INPUT"],
 ["empty evidence",undefined,undefined,[],"MISSING_INDEPENDENT_REVIEW"],
 ["missing row proof",undefined,undefined,[proof()],"MISSING_INDEPENDENT_REVIEW"],
 ["unverified claim",undefined,undefined,[{...proof(),independent_verified:false},proof("641A")],"UNVERIFIED_INDEPENDENT_REVIEW"],
 ["unlicensed",undefined,undefined,[{...proof(),license_verified:false},proof("641A")],"UNVERIFIED_LICENSE"],
 ["no baseline",undefined,undefined,[{...proof(),baseline_paired:false},proof("641A")],"INCOMPLETE_PAIR"],
 ["no shadow",undefined,undefined,[{...proof(),shadow_paired:false},proof("641A")],"INCOMPLETE_PAIR"],
 ["no holdout",undefined,undefined,[{...proof(),forward_holdout_verified:false},proof("641A")],"UNVERIFIED_FORWARD_HOLDOUT"],
 ["duplicate proof",undefined,undefined,[proof(),proof(),proof("641A")],"DUPLICATE_EVIDENCE"],
 ["orphan proof",undefined,undefined,[proof(),proof("641A"),proof("642A")],"ORPHAN_EVIDENCE"],
 ["bad observed price",undefined,[{...row(),entry_price:0},row("641A")],undefined,"INVALID_ENTRY"],
 ["bad observed power",undefined,[{...row(),ai_power:102},row("641A")],undefined,"INVALID_AI_POWER"],
 ["missing outcome",undefined,[{...row(),return_5d:null,outcome_5d_date:null},row("641A")],undefined,"PENDING_FIVE_DAY_OUTCOME"],
 ["inconsistent outcome",undefined,[{...row(),return_5d:1,outcome_5d_date:null},row("641A")],undefined,"MISSING_FIVE_DAY_DATE"],
 ["bad timestamp",undefined,[{...row(),captured_at:null},row("641A")],undefined,"INVALID_CAPTURE_TIME"],
 ["bad rule",undefined,[{...row(),rule_version:""},row("641A")],undefined,"MISSING_RULE_VERSION"],
 ["truncated",undefined,undefined,undefined,"TRUNCATED_EVIDENCE"]
];
for(const [name,a,rows,evidence,expected] of cases)test(name,()=>{
 const r=run(a===undefined?agg():a,rows===undefined?[row(),row("641A")]:rows,evidence===undefined?[proof(),proof("641A")]:evidence,name==="truncated"?{limit:1}:{});
 assert.ok(r.blockers.includes(expected),name+" "+JSON.stringify(r.blockers));assert.equal(r.adoptable,false);
});
test("never assumes self-reported attestation is true",()=>assert.ok(run().blockers.includes("INDEPENDENT_PROVENANCE_REVIEW_REQUIRED")));
