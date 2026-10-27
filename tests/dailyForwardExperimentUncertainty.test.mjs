import test from "node:test";
import assert from "node:assert/strict";
import { assessForwardExperimentUncertainty } from "../app/lib/research/dailyForwardExperimentUncertainty.mjs";
const rows=Array.from({length:20},(_,d)=>Array.from({length:20},(_,c)=>({
 code:String(1000+c),date:`2026-11-${String(d+1).padStart(2,"0")}`,horizon:5,
 baselineReturnPct:1,experimentalReturnPct:2,
}))).flat();
test("sufficient distinct days and codes produce descriptive diagnostics only",()=>{
 const result=assessForwardExperimentUncertainty(rows);
 assert.equal(result.status,"DESCRIPTIVE_DIAGNOSTICS_ONLY");
 assert.equal(result.distinctDates,20);
 assert.equal(result.distinctCodes,20);
 assert.equal(result.equalDateWeightedMeanDifferencePctPoints,1);
 assert.equal(result.improvementProven,false);
});
test("same-day concentration blocks confidence",()=>{
 const result=assessForwardExperimentUncertainty(rows.slice(0,20));
 assert.equal(result.status,"INSUFFICIENT_EVIDENCE");
 assert.ok(result.reasons.includes("INSUFFICIENT_DISTINCT_DATES"));
 assert.ok(result.reasons.includes("DATE_CONCENTRATION"));
});
test("duplicate observations and invalid values fail closed",()=>{
 const result=assessForwardExperimentUncertainty([...rows,rows[0],{...rows[1],experimentalReturnPct:NaN}]);
 assert.equal(result.status,"INSUFFICIENT_EVIDENCE");
 assert.ok(result.reasons.includes("DUPLICATE_PAIRED_ROW"));
 assert.ok(result.reasons.includes("INVALID_PAIRED_ROW"));
});
