import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source=fs.readFileSync("app/lib/research/marketRelativeCaptureReadiness.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};
vm.runInNewContext(js,{exports});
const keys=["approved","trustedServerClock","originalSignalTimestamp","immutableSignalId","sourceProvenanceVerified","providerRightsVerified","marketDataFreshnessVerified","developmentReplayVerified","productionChangeApproved"];
const all=Object.fromEntries(keys.map(k=>[k,true]));
assert.equal(exports.evaluateCaptureReadiness(all).ready,true);
for(const key of keys) {
 const result=exports.evaluateCaptureReadiness({...all,[key]:false});
 assert.equal(result.ready,false);
 assert.ok(result.missing.includes(key));
}
console.log("PASS: 10 capture readiness gate checks");
