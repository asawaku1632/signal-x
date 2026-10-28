const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const gate=fs.readFileSync('app/lib/learning/integratedResearchReview.ts','utf8');
const api=fs.readFileSync('app/api/admin/integrated-research-review/route.ts','utf8');
const ui=fs.readFileSync('app/admin/research-review/page.tsx','utf8');
function load(imports){const m={exports:{}};new vm.Script(ts.transpileModule(gate,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{assert.ok(imports[k],k);return imports[k]},Date});return m.exports;}
const evidence={researchId:'SWING_UNIVERSE_AI_POWER_ONLY',ruleVersion:'ai_power_only_v1',recorded:120,evaluated:90};
function run(rows,fail){let queries=0,args;const fake=load({
 '@/app/lib/learning/swingResearchReviewSnapshot':{getSwingResearchReviewSnapshot:async()=>({evidence})},
 '@/app/lib/postgres':{default:{query:async(sql,p)=>{queries++;args=p;if(fail)throw Error('missing table');return {rows}}}},
 '@/app/lib/learning/researchEvidenceEnvelope':{inspectEvidenceEnvelope:(v)=>({valid:!!v?.valid,digest:v?.digest,issues:[]})},
 '@/app/lib/learning/researchEvidenceReconciliation':{reconcileResearchEvidence:(e,items)=>({evidenceReady:false,issues:['NO_VERIFIED_EVIDENCE'],entries:items.map(r=>({digest:r.digest,valid:r.valid,issues:r.issues}))})}
 });return fake.getIntegratedResearchReview(new Date('2026-10-28T00:00:00Z')).then(result=>({result,queries,args}));}
test('196 owner authorization before data access',()=>assert.ok(api.indexOf('if(!owner.isOwner)')<api.indexOf('getIntegratedResearchReview()')));
test('197 owner API is GET-only and no-store',()=>{assert.match(api,/export async function GET/);assert.doesNotMatch(api,/export async function POST|PUT|DELETE/);assert.match(api,/private, no-store/);});
test('198 parameterized bounded research history',async()=>{const x=await run([]);assert.equal(x.queries,1);assert.deepEqual(Array.from(x.args),[evidence.researchId,evidence.ruleVersion]);assert.match(gate,/LIMIT 50/);});
test('199 no proof produces blocked state',async()=>{const x=await run([]);assert.equal(x.result.status,'BLOCKED');assert.equal(x.result.historyCount,0);});
test('200 valid-appearing proof does not auto-approve',async()=>{const x=await run([{digest:'a',envelope:{valid:true,digest:'a'},recorded_at:new Date()}]);assert.equal(x.result.status,'BLOCKED');assert.equal(x.result.productionApplied,false);});
test('201 invalid stored proof is labeled unsafe',async()=>{const x=await run([{digest:'a',envelope:{valid:false,digest:'a'},recorded_at:new Date()}]);assert.equal(x.result.entries[0].valid,false);});
test('202 bounded response marks possible truncation',async()=>{const x=await run(Array.from({length:50},(_,i)=>({digest:String(i),envelope:{valid:false,digest:String(i)}})));assert.equal(x.result.historyTruncated,true);});
test('203 DB read failure propagates and API returns 503',async()=>{await assert.rejects(()=>run([],true),/missing table/);assert.match(api,/status:503/);});
test('204 UI displays independent evidence and warnings',()=>{assert.match(ui,/統合照合/);assert.match(ui,/integrated\.reasons/);assert.match(ui,/未承認/);});
test('205 no mutation or automatic approval',async()=>{assert.doesNotMatch(gate,/INSERT INTO|UPDATE public|DELETE FROM/);const x=await run([]);assert.equal(x.result.notificationEnabled,false);assert.equal(x.result.approvalRecorded,false);});
