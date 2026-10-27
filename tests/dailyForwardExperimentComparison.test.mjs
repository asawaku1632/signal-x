import test from "node:test";
import assert from "node:assert/strict";
import { compareForwardExperimentOutcomes } from "../app/lib/research/dailyForwardExperimentComparison.mjs";
const plan={status:"DESIGN_ONLY_NOT_EXECUTED",autoApply:false,productionApproval:false,
 holdoutStart:"2026-11-01",holdoutEnd:"2027-01-31"};
const baseline=[{code:"7203",date:"2026-11-10",horizon:5,status:"VERIFIED",priceBasisVerified:true,returnPct:1}];
const experiment=[{...baseline[0],returnPct:2}];
test("paired verified outcomes yield descriptive difference only",()=>{
 const result=compareForwardExperimentOutcomes(plan,baseline,experiment,{minPairedSamples:30});
 assert.equal(result.status,"BLOCKED");
 assert.equal(result.improvementProven,false);
 assert.equal(result.averageDifferencePctPoints,null);
});
test("enough verified paired observations produce descriptive comparison only",()=>{
 const base=Array.from({length:30},(_,i)=>({...baseline[0],code:String(1000+i)}));
 const exp=base.map(row=>({...row,returnPct:row.returnPct+1}));
 const result=compareForwardExperimentOutcomes(plan,base,exp,{minPairedSamples:30});
 assert.equal(result.status,"DESCRIPTIVE_COMPARISON_ONLY");
 assert.equal(result.averageDifferencePctPoints,1);
 assert.equal(result.improvementProven,false);
 assert.equal(result.autoApply,false);
});
test("unmatched keys and duplicate keys fail closed",()=>{
 assert.ok(compareForwardExperimentOutcomes(plan,baseline,[{...experiment[0],code:"9999"}],{minPairedSamples:30}).reasons.includes("UNPAIRED_OBSERVATIONS"));
 assert.ok(compareForwardExperimentOutcomes(plan,[...baseline,...baseline],experiment,{minPairedSamples:30}).reasons.includes("BASELINE_DUPLICATE_KEY"));
});
test("unverified outcomes and out-of-window dates block comparison",()=>{
 assert.ok(compareForwardExperimentOutcomes(plan,baseline,[{...experiment[0],priceBasisVerified:false}],{minPairedSamples:30}).reasons.includes("UNVERIFIED_PAIRED_OUTCOME"));
 const old=[{...baseline[0],date:"2026-10-01"}];
 assert.ok(compareForwardExperimentOutcomes(plan,old,[{...old[0],returnPct:2}],{minPairedSamples:30}).reasons.includes("OUTSIDE_HOLDOUT_WINDOW"));
});
