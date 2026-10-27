import test from "node:test";
import assert from "node:assert/strict";
import { runForwardResearchExperimentPipeline } from "../app/lib/research/dailyForwardExperimentPipeline.mjs";
const hash="a".repeat(64);
const plan={status:"DESIGN_ONLY_NOT_EXECUTED",autoApply:false,productionApproval:false,
 holdoutStart:"2026-11-01",holdoutEnd:"2027-01-31"};
const baselineRows=[],experimentalRows=[],pairedRows=[],hypotheticalTrades=[];
for(let day=1;day<=20;day++) for(let stock=0;stock<20;stock++){
 const date=`2026-11-${String(day).padStart(2,"0")}`;
 const code=String(1000+stock);
 baselineRows.push({code,date,horizon:5,status:"VERIFIED",priceBasisVerified:true,returnPct:1});
 experimentalRows.push({code,date,horizon:5,status:"VERIFIED",priceBasisVerified:true,returnPct:2});
 pairedRows.push({code,date,horizon:5,baselineReturnPct:1,experimentalReturnPct:2});
}
for(let day=1;day<=30;day++){
 const date=`2026-12-${String(day).padStart(2,"0")}`;
 hypotheticalTrades.push({id:`T${day}`,startDate:date,endDate:date,grossReturnPct:1,verified:true});
}
const input={plan,baselineRows,experimentalRows,pairedRows,hypotheticalTrades,
 datasetSha256:hash,pairedDatasetSha256:hash,tradeDatasetSha256:hash,
 minPairedSamples:100,minDistinctDates:20,minDistinctCodes:20,minTrades:30};
test("integrated synthetic diagnostics permit independent research review only",()=>{
 const result=runForwardResearchExperimentPipeline(input);
 assert.equal(result.status,"ELIGIBLE_FOR_INDEPENDENT_RESEARCH_REVIEW");
 assert.equal(result.comparison.status,"DESCRIPTIVE_COMPARISON_ONLY");
 assert.equal(result.uncertainty.status,"DESCRIPTIVE_DIAGNOSTICS_ONLY");
 assert.equal(result.risk.status,"DESCRIPTIVE_RISK_ONLY");
 assert.equal(result.improvementProven,false);
 assert.equal(result.autoApply,false);
});
test("different or missing dataset metadata blocks integration",()=>{
 assert.equal(runForwardResearchExperimentPipeline({...input,tradeDatasetSha256:"b".repeat(64)}).status,"BLOCKED");
 assert.equal(runForwardResearchExperimentPipeline({...input,datasetSha256:null}).status,"BLOCKED");
});
test("unverified outcome holds research despite matching metadata",()=>{
 const changed=experimentalRows.map(r=>({...r}));changed[0].priceBasisVerified=false;
 const result=runForwardResearchExperimentPipeline({...input,experimentalRows:changed});
 assert.equal(result.status,"HOLD_FOR_MORE_RESEARCH");
});
