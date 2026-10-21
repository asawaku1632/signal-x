import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(path, requireFn) {
  const js = ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const exports = {};
  vm.runInNewContext(js,{exports,require:requireFn,Date,Number});
  return exports;
}
const validation=load("app/lib/research/marketRelativeProspectiveSnapshot.ts");
const {buildSnapshotInsertPlan}=load("app/lib/research/marketRelativeSnapshotInsertPlan.ts",()=>validation);
const input={signalId:"sig-1",code:"9684",aiPower:93,price:3000,priceObservedAt:"2026-10-21T09:05:00+09:00",signalObservedAt:"2026-10-21T09:05:10+09:00",capturedAt:"2026-10-21T09:05:15+09:00",source:"synthetic",version:"v1"};
let checks=0;
function check(x){assert.ok(x);checks++;}
const plan=buildSnapshotInsertPlan(input);
check(plan.ok===true);
check(plan.sql.includes("ON CONFLICT (signal_id) DO NOTHING"));
check(!plan.sql.includes("DO UPDATE"));
check(plan.params.length===9);
check(plan.params[0]==="sig-1");
check(!plan.sql.includes("sig-1"));
check(buildSnapshotInsertPlan({...input,code:"invalid"}).ok===false);
check(buildSnapshotInsertPlan({...input,aiPower:101}).ok===false);
check(buildSnapshotInsertPlan({...input,price:0}).ok===false);
console.log("PASS: "+checks+" parameterized insert plan checks");
