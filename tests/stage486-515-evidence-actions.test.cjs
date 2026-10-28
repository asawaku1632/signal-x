const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(p,imports={}){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>imports[k],Number});return m.exports}
const classifier=load('app/lib/learning/researchEvidenceClassification.ts');
const {planResearchEvidenceActions:plan,summarizeEvidenceActions:summarize,RESEARCH_EVIDENCE_REQUIREMENTS:req}=load('app/lib/learning/researchEvidenceActionPlan.ts',{'@/app/lib/learning/researchEvidenceClassification':classifier});
const base=()=>({id:'590A',hasOutcome:true,calendarIssue:null,sourceVerified:true,licenseVerified:true,independentTimestampVerified:true,forwardVerified:true,isSample:false});
const missing=(key)=>({...base(),[key]:false});
const checks=[
['486 six requirements',()=>assert.equal(req.length,6)],
['487 outcome gap',()=>assert.ok(plan(missing('hasOutcome')).actions.some(a=>a.code==='OUTCOME_PENDING'))],
['488 source gap',()=>assert.ok(plan(missing('sourceVerified')).actions.some(a=>a.code==='SOURCE_UNVERIFIED'))],
['489 license gap',()=>assert.ok(plan(missing('licenseVerified')).actions.some(a=>a.code==='LICENSE_UNVERIFIED'))],
['490 timestamp gap',()=>assert.ok(plan(missing('independentTimestampVerified')).actions.some(a=>a.code==='TIMESTAMP_UNVERIFIED'))],
['491 forward gap',()=>assert.ok(plan(missing('forwardVerified')).actions.some(a=>a.code==='FORWARD_UNVERIFIED'))],
['492 sampling gap',()=>assert.ok(plan({...base(),isSample:true}).actions.some(a=>a.code==='SAMPLE_NOT_EXHAUSTIVE'))],
['493 calendar issue',()=>assert.ok(plan({...base(),calendarIssue:'BAD'}).actions.some(a=>a.code==='CALENDAR_BAD'))],
['494 invalid ID',()=>assert.ok(plan({...base(),id:'not/valid'}).actions.some(a=>a.code==='INVALID_ID'))],
['495 complete no actions',()=>assert.equal(plan(base()).actions.length,0)],
['496 pending state',()=>assert.equal(plan(missing('sourceVerified')).state,'PENDING')],
['497 review state',()=>assert.equal(plan({...base(),calendarIssue:'BAD'}).state,'REVIEW_REQUIRED')],
['498 verified scoped state',()=>assert.equal(plan(base()).state,'VERIFIED_SCOPE')],
['499 no adoption even verified',()=>assert.equal(plan(base()).eligibleForAdoption,false)],
['500 no notification',()=>assert.equal(plan(base()).notificationEnabled,false)],
['501 no production apply',()=>assert.equal(plan(base()).productionApplied,false)],
['502 no independent action for complete',()=>assert.equal(plan(base()).needsIndependentVerification,false)],
['503 action for one gap',()=>assert.equal(plan(missing('sourceVerified')).needsIndependentVerification,true)],
['504 two gaps preserved',()=>assert.equal(plan({...base(),sourceVerified:false,licenseVerified:false}).actions.length,2)],
['505 empty summary',()=>assert.equal(summarize([]).inspected,0)],
['506 one summary',()=>assert.equal(summarize([missing('sourceVerified')]).inspected,1)],
['507 source counts',()=>assert.equal(summarize([missing('sourceVerified'),missing('sourceVerified')]).counts.SOURCE_UNVERIFIED,2)],
['508 mixed source',()=>assert.equal(summarize([base(),missing('sourceVerified')]).counts.SOURCE_UNVERIFIED,1)],
['509 mixed license',()=>assert.equal(summarize([missing('licenseVerified'),base()]).counts.LICENSE_UNVERIFIED,1)],
['510 two reason counts',()=>assert.equal(Object.keys(summarize([{...base(),licenseVerified:false,sourceVerified:false}]).counts).length,2)],
['511 summary no approval',()=>assert.equal(summarize([base()]).adoptionApproved,false)],
['512 no independent attestation inferred',()=>assert.equal(summarize([base()]).allRequirementsIndependentlyAttested,false)],
['513 1000 accepted',()=>assert.equal(summarize(Array.from({length:1000},base)).inspected,1000)],
['514 1001 refused',()=>assert.throws(()=>summarize(Array.from({length:1001},base)),/EVIDENCE_ACTION_LIMIT/)],
['515 no SQL mutations',()=>assert.doesNotMatch(fs.readFileSync('app/lib/learning/researchEvidenceActionPlan.ts','utf8'),/INSERT INTO|UPDATE public|DELETE FROM|pool\.query/)]
];for(const [name,fn] of checks)test(name,fn);
