const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
const src=fs.readFileSync("app/lib/learning/swingResearchReviewSnapshot.ts","utf8");
const gateSrc=fs.readFileSync("app/lib/learning/researchApprovalGate.ts","utf8");
function load(source,imports={}){const m={exports:{}};new vm.Script(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{assert.ok(imports[k]);return imports[k]},Number,Date});return m.exports;}
const gate=load(gateSrc);
test("156 actual SQL aggregated; no claim of provider verification",async()=>{
 let sql="",params;
 const module=load(src,{"@/app/lib/postgres":{default:{query:async(s,p)=>{sql=s;params=p;return {rows:[{recorded:"130",evaluated:"110",distinct_days:"25",completed_months:"4",avg_5d:"1.2",median_5d:"0.9",up_5d:"63"}]}}}},
 "@/app/lib/learning/researchApprovalGate":gate});
 const r=await module.getSwingResearchReviewSnapshot();
 assert.match(sql,/FROM public.swing_universe_observations/);
 assert.deepEqual(Array.from(params),["ai_power_only_v1"]);
 assert.equal(r.evidence.recorded,130);
 assert.equal(r.evidence.evaluated,110);
 assert.equal(r.observedMonths,4);
 assert.equal(r.evidence.completedMonths,0);
 assert.equal(r.evidence.sourceVerified,false);
 assert.equal(r.evidence.licenseVerified,false);
 assert.equal(r.decision.status,"BLOCKED");
 assert.equal(r.decision.automaticActivation,false);
 assert.equal(r.productionApplied,false);
});
test("157 negative evidence stays blocked even with promising result",()=>{
 const r=gate.assessResearchEvidence({researchId:"a",ruleVersion:"b",recorded:300,evaluated:300,distinctTradeDays:60,completedMonths:6,avgReturn5d:7,medianReturn5d:4,positiveRate5d:.99,marketRegimes:[],sourceVerified:false,licenseVerified:false,independentTimestampsVerified:false,holdoutVerified:false});
 assert.equal(r.eligibleForHumanReview,false);
});
test("158 owner-only API denies before database access",()=>{
 const route=fs.readFileSync("app/api/admin/research-review-snapshot/route.ts","utf8");
 assert.ok(route.indexOf("if(!owner.isOwner)")<route.indexOf("getSwingResearchReviewSnapshot()"));
 assert.ok(route.includes("private, no-store"));
 assert.ok(route.includes("status:403"));
});
test("159 dashboard is read-only with no submit or write endpoint",()=>{
 const page=fs.readFileSync("app/admin/research-review/page.tsx","utf8");
 assert.match(page,/採用審査・閲覧専用/);
 assert.match(page,/相場環境/);
 assert.doesNotMatch(page,/method:\s*["']POST|method:\s*["']PUT|<form|onSubmit/);
});
test("160 integration cannot trigger notification/trading changes",()=>{
 assert.doesNotMatch(src,/INSERT INTO|UPDATE public|DELETE FROM|sendLine|triggerNotification/);
 const page=fs.readFileSync("app/admin/research-review/page.tsx","utf8");
 assert.match(page,/本番反映：なし/);
});
