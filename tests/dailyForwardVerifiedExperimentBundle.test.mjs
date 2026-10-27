import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { runVerifiedForwardExperimentBundle } from "../app/lib/research/dailyForwardVerifiedExperimentBundle.mjs";
const bundle={
 plan:{status:"DESIGN_ONLY_NOT_EXECUTED",autoApply:false,productionApproval:false,holdoutStart:"2026-11-01",holdoutEnd:"2027-01-31"},
 baselineRows:[],experimentalRows:[],pairedRows:[],hypotheticalTrades:[],
};
for(let d=1;d<=20;d++)for(let c=0;c<20;c++){
 const code=String(1000+c),date=`2026-11-${String(d).padStart(2,"0")}`;
 bundle.baselineRows.push({code,date,horizon:5,status:"VERIFIED",priceBasisVerified:true,returnPct:1});
 bundle.experimentalRows.push({code,date,horizon:5,status:"VERIFIED",priceBasisVerified:true,returnPct:2});
 bundle.pairedRows.push({code,date,horizon:5,baselineReturnPct:1,experimentalReturnPct:2});
}
for(let d=1;d<=30;d++){
 const date=`2026-12-${String(d).padStart(2,"0")}`;
 const code=String(1000+(d%20));
 bundle.baselineRows.push({code,date,horizon:5,status:"VERIFIED",priceBasisVerified:true,returnPct:1});
 bundle.experimentalRows.push({code,date,horizon:5,status:"VERIFIED",priceBasisVerified:true,returnPct:2});
 bundle.pairedRows.push({code,date,horizon:5,baselineReturnPct:1,experimentalReturnPct:2});
 bundle.hypotheticalTrades.push({id:String(d),code,signalDate:date,horizon:5,startDate:date,endDate:date,grossReturnPct:1,verified:true,priceBasisVerified:true,executionBasisVerified:true});
}
const encode=(v)=>Buffer.from(JSON.stringify(v));
const digest=(b)=>createHash("sha256").update(b).digest("hex");
test("same verified bundle powers all diagnostics, without production approval",()=>{
 const bytes=encode(bundle);
 const r=runVerifiedForwardExperimentBundle({datasetBytes:bytes,trustedExpectedSha256:digest(bytes)});
 assert.equal(r.status,"ELIGIBLE_FOR_INDEPENDENT_RESEARCH_REVIEW");
 assert.equal(r.verification.matches,true);
 assert.equal(r.improvementProven,false);
 assert.equal(r.autoApply,false);
});
test("tampered bytes fail against independently pinned digest",()=>{
 const bytes=encode(bundle),other=Buffer.from(bytes);other[10]^=1;
 assert.equal(runVerifiedForwardExperimentBundle({datasetBytes:other,trustedExpectedSha256:digest(bytes)}).status,"BLOCKED");
});
test("missing expected digest fails closed",()=>{
 const bytes=encode(bundle);
 assert.equal(runVerifiedForwardExperimentBundle({datasetBytes:bytes}).status,"BLOCKED");
});
test("forged paired differences blocked even if attacker rehashes bundle",()=>{
 const altered=structuredClone(bundle);altered.pairedRows[0].experimentalReturnPct=999;
 const bytes=encode(altered);
 const r=runVerifiedForwardExperimentBundle({datasetBytes:bytes,trustedExpectedSha256:digest(bytes)});
 assert.ok(r.reasons.includes("PAIRED_VALUES_NOT_DERIVED_FROM_SOURCE"));
});
test("invalid JSON is rejected after hash verification",()=>{
 const bytes=Buffer.from("not-json");
 assert.ok(runVerifiedForwardExperimentBundle({datasetBytes:bytes,trustedExpectedSha256:digest(bytes)}).reasons.includes("DATASET_JSON_INVALID"));
});

test("trade with unmatched prediction blocks verified pipeline",()=>{
 const altered=structuredClone(bundle);altered.hypotheticalTrades[0].code="9999";
 const bytes=encode(altered);
 const result=runVerifiedForwardExperimentBundle({datasetBytes:bytes,trustedExpectedSha256:digest(bytes)});
 assert.equal(result.status,"BLOCKED");
 assert.ok(result.reasons.includes("PREDICTION_TRADE_LINKAGE_FAILED"));
});
test("unverified trade execution blocks verified pipeline",()=>{
 const altered=structuredClone(bundle);altered.hypotheticalTrades[0].executionBasisVerified=false;
 const bytes=encode(altered);
 const result=runVerifiedForwardExperimentBundle({datasetBytes:bytes,trustedExpectedSha256:digest(bytes)});
 assert.equal(result.status,"BLOCKED");
});
