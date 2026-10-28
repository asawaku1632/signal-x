const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync('app/lib/learning/researchCrossAudit.ts','utf8'),m={exports:{}};
new vm.Script(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText).runInNewContext({module:m,exports:m.exports,Number});
const run=m.exports.crossAuditResearchAdoption;
const good=()=>({researchId:'r',ruleVersion:'v',reviewResearchId:'r',reviewRuleVersion:'v',recorded:160,evaluated:120,validEvidenceRows:1,invalidEvidenceRows:0,historyTruncated:false,historyComplete:true,independentProvenanceVerified:true,licenseVerified:true,holdoutVerified:true,regimeVerified:true,reviewerApproved:true,reviewDigestMatches:true,approvalStillValid:true,previousGateBlocked:false,notificationEnabled:false,productionApplied:false});
const cases=[
 ['216 scope divergence','reviewRuleVersion','incorrect','CROSS_SCOPE_MISMATCH'],
 ['217 invalid counts','evaluated',300,'CROSS_INVALID_COUNTS'],
 ['218 conflicting evidence','validEvidenceRows',2,'CROSS_EVIDENCE_AMBIGUOUS_OR_INVALID'],
 ['219 incomplete history','historyTruncated',true,'CROSS_HISTORY_INCOMPLETE'],
 ['220 provenance','independentProvenanceVerified',false,'CROSS_PROVENANCE_UNVERIFIED'],
 ['221 license','licenseVerified',false,'CROSS_LICENSE_UNVERIFIED'],
 ['222 holdout','holdoutVerified',false,'CROSS_HOLDOUT_UNVERIFIED'],
 ['223 regime','regimeVerified',false,'CROSS_REGIME_UNVERIFIED'],
 ['224 reviewer','reviewDigestMatches',false,'CROSS_REVIEW_NOT_VALID'],
 ['225 prior block','previousGateBlocked',true,'CROSS_PREVIOUS_GATE_BLOCKED']
];
for(const [name,key,value,reason] of cases)test(name,()=>{const input=good();input[key]=value;const result=run(input);assert.ok(result.issues.includes(reason));assert.equal(result.status,'BLOCKED');assert.equal(result.productionApplied,false);assert.equal(result.notificationEnabled,false);});
test('even all checks passing only allows separate human release review',()=>{const result=run(good());assert.equal(result.checksPassed,true);assert.equal(result.automaticActivation,false);assert.equal(result.status,'BLOCKED');});
test('unexpected activation blocked',()=>{const x=good();x.notificationEnabled=true;assert.ok(run(x).issues.includes('CROSS_UNEXPECTED_ACTIVATION'));});
