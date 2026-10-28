const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
const {Pool}=require('pg');
function load(path,imports={}){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{assert.ok(imports[k],k);return imports[k]},Date,Number});return m.exports;}
async function main(){
 const raw=process.env.SIGNALX_E2E_DATABASE_URL||'',url=new URL(raw);
 assert.equal(url.protocol,'postgres:');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'5432');
 assert.equal(url.username,'test_only');assert.equal(url.pathname,'/signalx_alpha217_ci');assert.equal(url.search,'');assert.equal(url.hash,'');
 const pool=new Pool({connectionString:raw,ssl:false});
 try{
  const id=(await pool.query('SELECT current_database() db,current_user role')).rows[0];
  assert.equal(id.db,'signalx_alpha217_ci');assert.equal(id.role,'test_only');
  const schema=load('tests/fixtures/stage176-evidence-schema.ts');
  await pool.query(schema.ISOLATED_EVIDENCE_DDL);
  const ledger=load('app/lib/learning/researchEvidenceLedger.ts',{'node:crypto':crypto});
  const env=load('app/lib/learning/researchEvidenceEnvelope.ts',{'@/app/lib/learning/researchEvidenceLedger':ledger});
  const now='2026-10-28T00:00:00Z';
  const proofs=['SOURCE','LICENSE','TIMESTAMP','HOLDOUT','REGIME'].map((kind,i)=>({kind,researchId:'research-test',ruleVersion:'v1',artifactDigest:String(i+1).repeat(64),verifiedBy:'isolated-auditor',verifiedAt:'2026-10-27T00:00:00Z',expiresAt:null}));
  const envelope=env.createEvidenceEnvelope('research-test','v1',proofs,now);
  // Stage 176: Save once into a real disposable DB. Never write a live connection.
  const save=async e=>pool.query('INSERT INTO public.research_evidence_envelopes(research_id,rule_version,digest,envelope) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT (research_id,rule_version,digest) DO NOTHING RETURNING id',[e.researchId,e.ruleVersion,e.digest,JSON.stringify(e)]);
  assert.equal((await save(envelope)).rowCount,1);
  // Stage 177: duplicate is idempotent, history is kept.
  assert.equal((await save(envelope)).rowCount,0);
  const loaded=await pool.query('SELECT * FROM public.research_evidence_envelopes WHERE research_id=$1 AND rule_version=$2',['research-test','v1']);
  assert.equal(loaded.rows.length,1);
  assert.equal(env.inspectEvidenceEnvelope(loaded.rows[0].envelope,now).valid,true);
  // Stage 178: changing a proof but retaining the old digest must fail verification.
  const corrupted=JSON.parse(JSON.stringify(loaded.rows[0].envelope));
  corrupted.proofs[0].verifiedBy='changed';
  const validity=env.inspectEvidenceEnvelope(corrupted,now);
  assert.equal(validity.valid,false);assert.ok(validity.issues.includes('DIGEST_MISMATCH'));
  // Stage 179: history must not be replaced by conflicting insertions.
  const different=env.createEvidenceEnvelope('research-test','v1',proofs.map((p,i)=>i===0?{...p,verifiedBy:'another-auditor'}:p),now);
  assert.equal((await save(different)).rowCount,1);
  assert.equal(Number((await pool.query('SELECT count(*)::int n FROM public.research_evidence_envelopes')).rows[0].n),2);
  const rls=await pool.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.research_evidence_envelopes'::regclass");
  assert.equal(rls.rows[0].relrowsecurity,true);
  // Stage 180: no mutation route, and public role has no read permission.
  const grants=await pool.query("SELECT has_table_privilege('public','public.research_evidence_envelopes','SELECT') as allowed");
  assert.equal(grants.rows[0].allowed,false);
  console.log('PASS stages176-180: isolated DB save=1, repeat=0, readback verified, tamper denied, append history=2, RLS on, PUBLIC SELECT denied');
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
