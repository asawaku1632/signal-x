const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{Pool}=require('pg');
const u=new URL(process.env.SIGNALX_E2E_DATABASE_URL||'');for(const [k,v] of Object.entries({protocol:'postgres:',hostname:'127.0.0.1',port:'5432',username:'test_only',pathname:'/signalx_alpha217_ci'}))assert.equal(u[k],v);
const pool=new Pool({connectionString:u.href,ssl:false});
function load(p,imports={}){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{if(!(k in imports))throw Error(k);return imports[k]},Number});return m.exports}
const classifier=load('app/lib/learning/researchEvidenceClassification.ts');
const fn=load('app/lib/learning/storedEvidenceClassification.ts',{'@/app/lib/postgres':{default:pool},'@/app/lib/learning/swingUniverseAudit':{UNIVERSE_SWING_RULE_VERSION:'ai_power_only_v1'},'@/app/lib/learning/researchEvidenceClassification':classifier}).readStoredResearchEvidenceClassification;
test('stages456-485: thirty real PostgreSQL preview conditions',async()=>{try{
 await pool.query('CREATE TABLE public.swing_universe_observations(trade_date date,code text,rule_version text,return_5d numeric,outcome_5d_date date)');
 const checks=[];
 const add=(name,fn)=>checks.push([name,fn]);
 add('456 empty',async()=>assert.equal((await fn()).sampled,0));
 add('457 empty verified zero',async()=>assert.equal((await fn()).summary.verifiedScope,0));
 add('458 empty never exhaustive',async()=>assert.equal((await fn()).exhaustive,false));
 for(const [name,check] of checks){await check();console.log('PASS '+name)}
 await pool.query("INSERT INTO public.swing_universe_observations VALUES('2026-10-09','590A','ai_power_only_v1',2,'2026-10-19'),('2026-10-09','641A','ai_power_only_v1',null,null),('2026-10-08','642A','ai_power_only_v1',2,'2026-10-16'),('2026-10-09','9999','other',2,'2026-10-19')");
 add('459 rule filter',async()=>assert.equal((await fn()).sampled,3));
 add('460 no verified claim',async()=>assert.equal((await fn()).summary.verifiedScope,0));
 add('461 all pending',async()=>assert.equal((await fn()).summary.pending,3));
 add('462 no automatic review claim',async()=>assert.equal((await fn()).summary.reviewRequired,0));
 add('463 incomplete outcome counted',async()=>assert.equal((await fn()).reasonCounts.OUTCOME_PENDING,1));
 add('464 all source unverified',async()=>assert.equal((await fn()).reasonCounts.SOURCE_UNVERIFIED,3));
 add('465 all license unverified',async()=>assert.equal((await fn()).reasonCounts.LICENSE_UNVERIFIED,3));
 add('466 all time unverified',async()=>assert.equal((await fn()).reasonCounts.TIMESTAMP_UNVERIFIED,3));
 add('467 all forward unverified',async()=>assert.equal((await fn()).reasonCounts.FORWARD_UNVERIFIED,3));
 add('468 sample not exhaustive',async()=>assert.equal((await fn()).reasonCounts.SAMPLE_NOT_EXHAUSTIVE,3));
 add('469 bound one',async()=>assert.equal((await fn(1)).sampled,1));
 add('470 bound two',async()=>assert.equal((await fn(2)).sampled,2));
 add('471 bound three',async()=>assert.equal((await fn(3)).sampled,3));
 add('472 bound 100',async()=>assert.equal((await fn(100)).sampled,3));
 add('473 bound zero',async()=>await assert.rejects(fn(0),/INVALID_EVIDENCE_PREVIEW_LIMIT/));
 add('474 negative bound',async()=>await assert.rejects(fn(-1),/INVALID_EVIDENCE_PREVIEW_LIMIT/));
 add('475 oversize bound',async()=>await assert.rejects(fn(101),/INVALID_EVIDENCE_PREVIEW_LIMIT/));
 add('476 fractional bound',async()=>await assert.rejects(fn(1.5),/INVALID_EVIDENCE_PREVIEW_LIMIT/));
 add('477 NaN bound',async()=>await assert.rejects(fn(NaN),/INVALID_EVIDENCE_PREVIEW_LIMIT/));
 add('478 Infinity bound',async()=>await assert.rejects(fn(Infinity),/INVALID_EVIDENCE_PREVIEW_LIMIT/));
 add('479 owner review only',async()=>assert.equal((await fn()).ownerReviewOnly,true));
 add('480 no notifications',async()=>assert.equal((await fn()).notificationEnabled,false));
 add('481 no production applied',async()=>assert.equal((await fn()).productionApplied,false));
 add('482 independent verification absent',async()=>assert.equal((await fn()).verifiedFromIndependentSources,false));
 add('483 summary adoption prohibited',async()=>assert.equal((await fn()).summary.adoptionApproved,false));
 add('484 no SQL writes',async()=>assert.doesNotMatch(fs.readFileSync('app/lib/learning/storedEvidenceClassification.ts','utf8'),/INSERT INTO|UPDATE public|DELETE FROM/));
 add('485 exact count',async()=>assert.equal((await fn()).summary.total,3));
 assert.equal(checks.length,30);for(const [name,check] of checks.slice(3)){try{await check();console.log('PASS '+name)}catch(e){console.error('FAIL '+name);throw e}}
 }finally{await pool.end()}});
