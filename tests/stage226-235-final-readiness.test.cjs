const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
function load(path,imports={}){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{assert.ok(imports[k],k);return imports[k]},Number});return m.exports}
const cross=load('app/lib/learning/researchCrossAudit.ts');
const fn=load('app/lib/learning/finalResearchReadiness.ts',{'@/app/lib/learning/researchCrossAudit':cross}).summarizeFinalResearchReadiness;
const e=()=>({researchId:'r',ruleVersion:'v',recorded:130,evaluated:110,distinctTradeDays:25,completedMonths:3,avgReturn5d:1,medianReturn5d:.5,positiveRate5d:.6,marketRegimes:[],sourceVerified:false,licenseVerified:false,independentTimestampsVerified:false,holdoutVerified:false});
const cases=[
 ['226 no evidence',[],false,true,'CROSS_EVIDENCE_AMBIGUOUS_OR_INVALID'],
 ['227 valid-looking proof not sufficient',[{valid:true}],false,true,'CROSS_HISTORY_INCOMPLETE'],
 ['228 invalid proof',[{valid:false}],false,true,'CROSS_EVIDENCE_AMBIGUOUS_OR_INVALID'],
 ['229 multiple proofs',[{valid:true},{valid:true}],false,true,'CROSS_EVIDENCE_AMBIGUOUS_OR_INVALID'],
 ['230 truncated proof history',[{valid:true}],true,true,'CROSS_HISTORY_INCOMPLETE'],
 ['231 no license attestation',[{valid:true}],false,false,'CROSS_LICENSE_UNVERIFIED'],
 ['232 no provenance attestation',[{valid:true}],false,false,'CROSS_PROVENANCE_UNVERIFIED'],
 ['233 no holdout attestation',[{valid:true}],false,false,'CROSS_HOLDOUT_UNVERIFIED'],
 ['234 reviewer not approved',[{valid:true}],false,false,'CROSS_REVIEW_NOT_VALID'],
 ['235 earlier gate blocked',[{valid:true}],false,true,'CROSS_PREVIOUS_GATE_BLOCKED']
];
for(const [name,entries,truncated,blocked,issue] of cases)test(name,()=>{const r=fn(e(),entries,truncated,blocked);assert.equal(r.status,'BLOCKED');assert.ok(r.issues.includes(issue));assert.equal(r.automaticActivation,false);assert.equal(r.productionApplied,false);assert.equal(r.notificationEnabled,false)});
test('owner route stays guarded; production mutation absent',()=>{const route=fs.readFileSync('app/api/admin/integrated-research-review/route.ts','utf8');assert.ok(route.indexOf('if(!owner.isOwner)')<route.indexOf('getIntegratedResearchReview()'));const src=fs.readFileSync('app/lib/learning/finalResearchReadiness.ts','utf8');assert.doesNotMatch(src,/INSERT INTO|UPDATE public|DELETE FROM|pool\.query/);const page=fs.readFileSync('app/admin/research-review/page.tsx','utf8');assert.match(page,/integrated.finalReadiness/);});
