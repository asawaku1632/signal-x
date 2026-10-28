import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

// CI-only experiment with a temporary table, transactional role and function.
// No production or shared database privileges are touched.
test("isolated PG: restricted role can use audited correction function but not direct UPDATE",async t=>{
 if(process.env.SIGNALX_RESEARCH_ISOLATED_PG!=="true"){t.skip("isolated PG only");return;}
 const db=new pg.Client({host:"127.0.0.1",port:5432,database:"signalx_research_ci",user:"signalx_ci",password:process.env.SIGNALX_RESEARCH_CI_PASSWORD,ssl:false});
 await db.connect();
 try{
  await db.query("BEGIN");
  await db.query("CREATE ROLE signalx_correction_ci_role NOLOGIN");
  await db.query("CREATE SCHEMA signalx_ci_authz");
  await db.query("CREATE TABLE signalx_ci_authz.forward_ci(id int PRIMARY KEY,entry_price numeric NOT NULL,return_5d numeric)");
  await db.query("CREATE TABLE signalx_ci_authz.audit_ci(id int,old_result numeric,new_result numeric,reason text)");
  await db.query("INSERT INTO signalx_ci_authz.forward_ci VALUES(1,100,2.5)");
  // SECURITY DEFINER is intentionally limited to this temporary test schema.
  await db.query(`CREATE FUNCTION signalx_ci_authz.correct_ci(p_id int,p_new numeric,p_reason text)
  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=signalx_ci_authz,pg_temp AS $$
  DECLARE prior numeric;
  BEGIN
    IF length(trim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'reason required'; END IF;
    SELECT return_5d INTO prior FROM signalx_ci_authz.forward_ci WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    IF prior IS NOT DISTINCT FROM p_new THEN RETURN false; END IF;
    INSERT INTO signalx_ci_authz.audit_ci VALUES(p_id,prior,p_new,p_reason);
    UPDATE signalx_ci_authz.forward_ci SET return_5d=p_new WHERE id=p_id;
    RETURN true;
  END $$`);
  await db.query("REVOKE ALL ON FUNCTION signalx_ci_authz.correct_ci(int,numeric,text) FROM PUBLIC");
  await db.query("GRANT EXECUTE ON FUNCTION signalx_ci_authz.correct_ci(int,numeric,text) TO signalx_correction_ci_role");
  await db.query("GRANT USAGE ON SCHEMA signalx_ci_authz TO signalx_correction_ci_role");
  await db.query("GRANT SELECT ON signalx_ci_authz.forward_ci TO signalx_correction_ci_role");
  await db.query("SAVEPOINT access_check");
  await db.query("SET LOCAL ROLE signalx_correction_ci_role");
  await assert.rejects(db.query("UPDATE signalx_ci_authz.forward_ci SET return_5d=99 WHERE id=1"),e=>e.code==="42501");
  await db.query("ROLLBACK TO SAVEPOINT access_check");
  await db.query("SET LOCAL ROLE signalx_correction_ci_role");
  assert.equal((await db.query("SELECT signalx_ci_authz.correct_ci(1,-1.5,'Verified corrected market result') ok")).rows[0].ok,true);
  await db.query("RESET ROLE");
  const row=(await db.query("SELECT entry_price::float8 price,return_5d::float8 result FROM signalx_ci_authz.forward_ci")).rows[0];
  assert.deepEqual(row,{price:100,result:-1.5});
  assert.equal((await db.query("SELECT count(*)::int n FROM signalx_ci_authz.audit_ci")).rows[0].n,1);
  await db.query("ROLLBACK");
 } finally {await db.query("ROLLBACK").catch(()=>{});await db.end();}
});
