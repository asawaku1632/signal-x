const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const src=fs.readFileSync('app/lib/learning/swingObservationIntegrity.ts','utf8');
const rule={UNIVERSE_SWING_RULE_VERSION:'ai_power_only_v1'};
let response,called;
const pool={query:async(sql,params)=>{called={sql,params};return {rows:[response]};}};
const m={exports:{}};
new vm.Script(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{if(k==='@/app/lib/postgres')return {default:pool};if(k==='@/app/lib/learning/swingUniverseAudit')return rule;throw Error(k)},Number,Object});
const run=m.exports.readSwingObservationIntegrity;
const clean=()=>({total:'200',evaluated:'120',missing_outcome_date:'0',outcome_without_return:'0',non_future_outcome:'0',bad_entry_price:'0',invalid_return:'0',distinct_days:'30',earliest_day:'2026-08-01',latest_day:'2026-10-27'});
test('236 actual table is read-only parameterized and scoped',async()=>{response=clean();const r=await run();assert.match(called.sql,/FROM public.swing_universe_observations WHERE rule_version=\$1/);assert.equal(Array.from(called.params)[0],'ai_power_only_v1');assert.doesNotMatch(called.sql,/\b(?:UPDATE|INSERT|DELETE)\b/);assert.equal(r.metrics.total,200);});
test('237 verified count tracked without conferring provenance',async()=>{response=clean();const r=await run();assert.equal(r.metrics.evaluated,120);assert.equal(r.sourceVerified,false);assert.equal(r.licenseVerified,false);assert.equal(r.adoptionApproved,false);});
const cases=[
['238 absent 5d outcome date','missing_outcome_date','RETURN_WITHOUT_TARGET_DATE'],
['239 outcome date without return','outcome_without_return','TARGET_DATE_WITHOUT_RETURN'],
['240 outcome date not in future','non_future_outcome','TARGET_DATE_NOT_AFTER_SIGNAL'],
['241 invalid entry price','bad_entry_price','INVALID_ENTRY_PRICE'],
['242 invalid 5d return','invalid_return','OUT_OF_RANGE_RETURN']
];
for(const [name,field,issue] of cases)test(name,async()=>{response=clean();response[field]='2';const r=await run();assert.ok(r.issues.includes(issue));assert.equal(r.adoptionApproved,false);});
test('243 impossible evaluated count is rejected',async()=>{response=clean();response.evaluated='300';const r=await run();assert.ok(r.issues.includes('EVALUATED_EXCEEDS_TOTAL'));});
test('244 missing or invalid counts fail closed',async()=>{response=clean();response.distinct_days='invalid';const r=await run();assert.ok(r.issues.includes('INVALID_AGGREGATION'));});
test('245 research management integration is read-only and owner scoped',()=>{const integrated=fs.readFileSync('app/lib/learning/integratedResearchReview.ts','utf8');const screen=fs.readFileSync('app/admin/research-review/page.tsx','utf8');const api=fs.readFileSync('app/api/admin/integrated-research-review/route.ts','utf8');assert.match(integrated,/readSwingObservationIntegrity/);assert.match(screen,/observationIntegrity/);assert.ok(api.indexOf('if(!owner.isOwner)')<api.indexOf('getIntegratedResearchReview()'));});
