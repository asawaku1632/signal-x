import test from "node:test";import assert from "node:assert/strict";import {inspectResearchSnapshotEnvelope as check,auditBoundedResearchSnapshot as audit} from "../app/lib/learning/researchSnapshotBoundary.mjs";
const env=()=>({snapshotAt:"2026-10-28T08:00:00Z",queryStartedAt:"2026-10-28T08:01:00Z",queryFinishedAt:"2026-10-28T08:02:00Z",reportedTotal:1,rowsRead:1,isComplete:true,sourceVerified:true,licenseVerified:true,snapshotDigest:"a".repeat(64)});
const agg=()=>({total:1,days:1,stocks:1,completed5:1,pending5:0,undated5:0,invalid_date:0,invalid_inputs:0,duplicates:0});
const rows=()=>[{trade_date:"2026-10-08",code:"590A",entry_price:100,ai_power:50,captured_at:"2026-10-08T07:00:00Z",return_5d:1,outcome_5d_date:"2026-10-16",rule_version:"r1"}];
const evidence=()=>[{trade_date:"2026-10-08",code:"590A",independent_verified:true,license_verified:true,baseline_paired:true,shadow_paired:true,forward_holdout_verified:true}];
const cases=[
["null",null,"INVALID_ENVELOPE"],["array",[],"INVALID_ENVELOPE"],
["missing snapshot",{snapshotAt:null},"INVALID_SNAPSHOT_TIME"],["bad snapshot",{snapshotAt:"invalid"},"INVALID_SNAPSHOT_TIME"],
["unqualified snapshot",{snapshotAt:"2026-10-28T08:00:00"},"INVALID_SNAPSHOT_TIME"],
["missing start",{queryStartedAt:null},"INVALID_QUERY_START"],["bad start",{queryStartedAt:"no"},"INVALID_QUERY_START"],
["missing finish",{queryFinishedAt:null},"INVALID_QUERY_FINISH"],["bad finish",{queryFinishedAt:"no"},"INVALID_QUERY_FINISH"],
["reversed query",{queryFinishedAt:"2026-10-28T08:00:00Z"},"NEGATIVE_QUERY_DURATION"],
["future snapshot",{snapshotAt:"2026-10-28T09:00:00Z"},"SNAPSHOT_FROM_FUTURE"],
["negative total",{reportedTotal:-1},"INVALID_REPORTED_TOTAL"],
["fractional total",{reportedTotal:1.5},"INVALID_REPORTED_TOTAL"],
["missing total",{reportedTotal:null},"INVALID_REPORTED_TOTAL"],
["string total",{reportedTotal:"1"},"INVALID_REPORTED_TOTAL"],
["negative read",{rowsRead:-1},"INVALID_ROWS_READ"],
["fractional read",{rowsRead:1.5},"INVALID_ROWS_READ"],
["missing read",{rowsRead:null},"INVALID_ROWS_READ"],
["overread",{rowsRead:2},"ROWS_EXCEED_TOTAL"],
["incomplete",{isComplete:false},"INCOMPLETE_SNAPSHOT"],
["missing completeness",{isComplete:null},"INCOMPLETE_SNAPSHOT"],
["source unverified",{sourceVerified:false},"UNVERIFIED_SOURCE"],
["source string",{sourceVerified:"true"},"UNVERIFIED_SOURCE"],
["license unverified",{licenseVerified:false},"UNVERIFIED_LICENSE"],
["license string",{licenseVerified:"true"},"UNVERIFIED_LICENSE"],
["digest absent",{snapshotDigest:null},"MISSING_IMMUTABLE_DIGEST"],
["digest short",{snapshotDigest:"abc"},"MISSING_IMMUTABLE_DIGEST"],
["even declared snapshot blocked",{},"INDEPENDENT_ATTESTATION_REQUIRED"]
];
for(const [name,patch,reason] of cases)test(name,()=>{const r=check(patch===null||Array.isArray(patch)?patch:{...env(),...patch});assert.equal(r.status,"BLOCKED");assert.ok(r.errors.includes(reason),name)});
test("integration remains blocked",()=>{const r=audit(env(),agg(),rows(),evidence());assert.equal(r.adoptable,false);assert.equal(r.notificationAllowed,false)});
test("mismatched reported total",()=>assert.ok(audit({...env(),reportedTotal:2},agg(),rows(),evidence()).blockers.includes("AGGREGATE_TOTAL_MISMATCH")));
test("mismatched read count",()=>assert.ok(audit({...env(),rowsRead:0},agg(),rows(),evidence()).blockers.includes("ROWS_READ_MISMATCH")));
test("missing rows cannot approve",()=>assert.equal(audit(env(),agg(),null,evidence()).adoptable,false));
test("incomplete evidence cannot approve",()=>assert.equal(audit(env(),agg(),rows(),null).adoptable,false));
test("snapshot marked incomplete cannot approve",()=>assert.ok(audit({...env(),isComplete:false},agg(),rows(),evidence()).blockers.includes("INCOMPLETE_SNAPSHOT")));
