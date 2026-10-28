const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto'),{Pool}=require('pg');
function load(path,imports={}){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{assert.ok(imports[k],k);return imports[k]},Date,Number});return m.exports;}
async function main(){
 const raw=process.env.SIGNALX_E2E_DATABASE_URL||'',u=new URL(raw);
 for(const [key,value] of [['protocol','postgres:'],['hostname','127.0.0.1'],['port','5432'],['username','test_only'],['pathname','/signalx_alpha217_ci'],['search',''],['hash','']])assert.equal(u[key],value);
 const pool=new Pool({connectionString:raw,ssl:false});
 try{
  const id=(await pool.query('SELECT current_database() db,current_user role')).rows[0];assert.equal(id.db,'signalx_alpha217_ci');assert.equal(id.role,'test_only');
  await pool.query(load('tests/fixtures/stage176-evidence-schema.ts').ISOLATED_EVIDENCE_DDL);
  await pool.query(load('tests/fixtures/stage181-immutable-schema.ts').IMMUTABLE_EVIDENCE_DDL);
  const ledger=load('app/lib/learning/researchEvidenceLedger.ts',{'node:crypto':crypto});
  const envelope=load('app/lib/learning/researchEvidenceEnvelope.ts',{'@/app/lib/learning/researchEvidenceLedger':ledger});
  const proofs=['SOURCE','LICENSE','TIMESTAMP','HOLDOUT','REGIME'].map((kind,i)=>({kind,researchId:'r',ruleVersion:'v',artifactDigest:String(i+1).repeat(64),verifiedBy:'auditor',verifiedAt:'2026-10-27T00:00:00Z',expiresAt:null}));
  const e=envelope.createEvidenceEnvelope('r','v',proofs,'2026-10-28T00:00:00Z');
  const insert=await pool.query('INSERT INTO public.research_evidence_envelopes(research_id,rule_version,digest,envelope) VALUES($1,$2,$3,$4::jsonb) RETURNING id',['r','v',e.digest,JSON.stringify(e)]);assert.equal(insert.rowCount,1);
  const key=insert.rows[0].id;
  await assert.rejects(pool.query('UPDATE public.research_evidence_envelopes SET digest=$1 WHERE id=$2',['f'.repeat(64),key]),/EVIDENCE_IMMUTABLE/);
  await assert.rejects(pool.query('DELETE FROM public.research_evidence_envelopes WHERE id=$1',[key]),/EVIDENCE_IMMUTABLE/);
  const rows=await pool.query('SELECT envelope,digest FROM public.research_evidence_envelopes WHERE research_id=$1 AND rule_version=$2 ORDER BY id DESC LIMIT 10',['r','v']);
  assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].digest,e.digest);
  assert.equal(envelope.inspectEvidenceEnvelope(rows.rows[0].envelope,'2026-10-28T00:00:00Z').valid,true);
  assert.equal((await pool.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',['public.research_evidence_envelopes'])).rows[0].relrowsecurity,true);
  console.log('PASS stages181-185: update rejected, delete rejected, history preserved, readback/digest verified, RLS enabled');
 }finally{await pool.end();}
}main().catch(e=>{console.error(e);process.exitCode=1});
