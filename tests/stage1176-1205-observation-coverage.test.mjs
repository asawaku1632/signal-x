import test from "node:test";import assert from "node:assert/strict";
import {assessObservationCoverage as audit} from "../app/lib/learning/researchObservationCoverage.mjs";
const baseline=()=>({total:13300,days:14,stocks:950,completed5:8550,pending5:4750,undated5:0,invalid_date:0,invalid_inputs:0,duplicates:0});
test("production-shaped aggregate remains blocked",()=>{const r=audit(baseline());assert.equal(r.status,"BLOCKED");assert.equal(r.verified,false);assert.equal(r.completedFiveDay,8550);assert.equal(r.completionRate,8550/13300)});
test("null summary",()=>assert.ok(audit(null).issues.includes("INVALID_SUMMARY")));
test("array summary",()=>assert.ok(audit([]).issues.includes("INVALID_SUMMARY")));
const fields=Object.keys(baseline());
for(const field of fields){
 for(const [label,value] of [["missing",undefined],["negative",-1],["fractional",0.5],["malformed","bad"]]){
  test(field+" "+label,()=>assert.ok(audit({...baseline(),[field]:value}).issues.includes("INVALID_COUNT_"+field)));
 }
}
test("SQL decimal count strings are allowed",()=>{const v=Object.fromEntries(Object.entries(baseline()).map(([k,n])=>[k,String(n)]));assert.equal(audit(v).total,13300)});
test("mismatched coverage",()=>assert.ok(audit({...baseline(),completed5:8549}).issues.includes("FIVE_DAY_COVERAGE_INCONSISTENT")));
test("undated outcome",()=>assert.ok(audit({...baseline(),undated5:1}).issues.includes("OUTCOME_WITHOUT_DATE")));
test("invalid date",()=>assert.ok(audit({...baseline(),invalid_date:1}).issues.includes("OUTCOME_DATE_ORDER_INVALID")));
test("invalid inputs",()=>assert.ok(audit({...baseline(),invalid_inputs:1}).issues.includes("INPUT_RANGE_INVALID")));
test("duplicates",()=>assert.ok(audit({...baseline(),duplicates:1}).issues.includes("DUPLICATE_OBSERVATIONS")));
test("too many dates",()=>assert.ok(audit({...baseline(),days:13301}).issues.includes("IMPOSSIBLE_CARDINALITY")));
test("too many stocks",()=>assert.ok(audit({...baseline(),stocks:13301}).issues.includes("IMPOSSIBLE_CARDINALITY")));
test("zero outcomes",()=>assert.ok(audit({...baseline(),completed5:0,pending5:13300}).issues.includes("NO_COMPLETED_FIVE_DAY_DATA")));
test("all completed still blocked",()=>assert.equal(audit({...baseline(),completed5:13300,pending5:0}).status,"BLOCKED"));
test("never attests provenance",()=>assert.ok(audit(baseline()).issues.includes("SOURCE_LICENSE_NOT_ATTESTED")));
test("never attests SHADOW",()=>assert.ok(audit(baseline()).issues.includes("BASELINE_SHADOW_COMPARISON_NOT_ATTESTED")));
test("never attests forward results",()=>assert.ok(audit(baseline()).issues.includes("INDEPENDENT_FORWARD_VALIDATION_NOT_ATTESTED")));
test("pending explicitly noted",()=>assert.ok(audit(baseline()).issues.includes("PENDING_OUTCOMES")));
test("empty dataset no fabricated rate",()=>{const r=audit({total:0,days:0,stocks:0,completed5:0,pending5:0,undated5:0,invalid_date:0,invalid_inputs:0,duplicates:0});assert.equal(r.completionRate,null);assert.equal(r.verified,false)});
