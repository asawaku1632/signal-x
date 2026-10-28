import test from "node:test";import assert from "node:assert/strict";import {inspectSnapshotConsistency as check} from "../app/lib/learning/researchSnapshotConsistency.mjs";
const m=()=>({snapshotAt:"2026-10-28T08:00:00Z",queryStartedAt:"2026-10-28T08:01:00Z",queryFinishedAt:"2026-10-28T08:02:00Z",reportedTotal:1,rowsRead:1,isComplete:true,sourceVerified:true,licenseVerified:true});
const a=()=>({total:1});
const r=()=>[{trade_date:"2026-10-08",code:"590A"}],e=()=>[{id:"e1"}];
const run=(meta=m(),aggregate=a(),rows=r(),proof=e())=>check(meta,aggregate,rows,proof);
const cases=[
["null meta",null,undefined,undefined,undefined,"INVALID_ENVELOPE"],
["array meta",[],undefined,undefined,undefined,"INVALID_ENVELOPE"],
["bad aggregate",undefined,null,undefined,undefined,"INVALID_AGGREGATE"],
["bad rows",undefined,undefined,null,undefined,"INVALID_ROWS"],
["bad proof",undefined,undefined,undefined,null,"INVALID_EVIDENCE"],
["reported total mismatch",{reportedTotal:2},undefined,undefined,undefined,"TOTAL_MISMATCH"],
["negative total",{reportedTotal:-1},undefined,undefined,undefined,"TOTAL_MISMATCH"],
["fractional total",{reportedTotal:1.5},undefined,undefined,undefined,"TOTAL_MISMATCH"],
["aggregate total mismatch",undefined,{total:3},undefined,undefined,"TOTAL_MISMATCH"],
["missing aggregate total",undefined,{},undefined,undefined,"TOTAL_MISMATCH"],
["wrong read count",{rowsRead:0},undefined,undefined,undefined,"ROWS_READ_MISMATCH"],
["negative read count",{rowsRead:-1},undefined,undefined,undefined,"ROWS_READ_MISMATCH"],
["partial full read",{rowsRead:0},undefined,[],[],"FALSE_COMPLETENESS_CLAIM"],
["partial rows",undefined,undefined,[],[],"INCOMPLETE_FULL_READ"],
["missing start",{queryStartedAt:null},undefined,undefined,undefined,"INVALID_TIME_ENVELOPE"],
["missing end",{queryFinishedAt:null},undefined,undefined,undefined,"INVALID_TIME_ENVELOPE"],
["missing snapshot",{snapshotAt:null},undefined,undefined,undefined,"INVALID_TIME_ENVELOPE"],
["timezone-less time",{queryStartedAt:"2026-10-28T08:01:00"},undefined,undefined,undefined,"INVALID_TIME_ENVELOPE"],
["reversed time",{queryFinishedAt:"2026-10-28T07:00:00Z"},undefined,undefined,undefined,"REVERSED_QUERY_WINDOW"],
["snapshot after query",{snapshotAt:"2026-10-28T09:00:00Z"},undefined,undefined,undefined,"SNAPSHOT_AFTER_QUERY"],
["evidence fewer",undefined,undefined,undefined,[],"EVIDENCE_COUNT_NOT_ALIGNED"],
["evidence more",undefined,undefined,undefined,[{},{}],"EVIDENCE_COUNT_NOT_ALIGNED"],
["bad observation",undefined,undefined,[null],undefined,"INVALID_OBSERVATION_KEY"],
["bad code",undefined,undefined,[{trade_date:"2026-10-08"}],undefined,"INVALID_OBSERVATION_KEY"],
["bad trade day",undefined,undefined,[{code:"590A"}],undefined,"INVALID_OBSERVATION_KEY"],
["duplicate row",{reportedTotal:2,rowsRead:2}, {total:2},[...r(),...r()],[{},{}],"DUPLICATE_OBSERVATION_KEY"],
["source false",{sourceVerified:false},undefined,undefined,undefined,"SOURCE_OR_LICENSE_UNVERIFIED"],
["license false",{licenseVerified:false},undefined,undefined,undefined,"SOURCE_OR_LICENSE_UNVERIFIED"],
["source string",{sourceVerified:"true"},undefined,undefined,undefined,"SOURCE_OR_LICENSE_UNVERIFIED"],
["all declared still blocked",undefined,undefined,undefined,undefined,"INDEPENDENT_ATTESTATION_UNAVAILABLE"]
];
for(const [name,meta,aggregate,rows,proof,reason] of cases)test(name,()=>{const data=meta===null||Array.isArray(meta)?meta:{...m(),...meta};const result=run(data,aggregate===undefined?a():aggregate,rows===undefined?r():rows,proof===undefined?e():proof);assert.equal(result.status,"BLOCKED");assert.ok(result.issues.includes(reason),name+JSON.stringify(result.issues));assert.equal(result.productionEligible,false)});
test("bounded 1000 is explicit",()=>{const rows=Array.from({length:1001},(_,i)=>({trade_date:"2026-10-08",code:String(1000+i)}));assert.ok(run({...m(),reportedTotal:1001,rowsRead:1001},{total:1001},rows,Array(1001).fill({})).issues.includes("BOUNDED_REVIEW_ONLY"))});
