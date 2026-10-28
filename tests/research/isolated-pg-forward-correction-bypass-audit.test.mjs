import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

// Demonstrates why an audited UPDATE statement alone is insufficient:
// any role with unrestricted UPDATE rights can bypass the audit statement.
// This test runs ONLY in rollback-only, isolated PostgreSQL CI.
test("isolated PG: direct update bypass exists without database permissions",async t=>{
 if(process.env.SIGNALX_RESEARCH_ISOLATED_PG!=="true"){t.skip("isolated PG only");return;}
 const db=new pg.Client({host:"127.0.0.1",port:5432,database:"signalx_research_ci",user:"signalx_ci",password:process.env.SIGNALX_RESEARCH_CI_PASSWORD,ssl:false});
 await db.connect();
 try{
  await db.query("BEGIN");
  await db.query("CREATE TEMP TABLE forward_observation (id integer PRIMARY KEY,entry_price numeric,return_5d numeric)");
  await db.query("CREATE TEMP TABLE forward_correction_audit (id integer,old_return_5d numeric,new_return_5d numeric)");
  await db.query("INSERT INTO forward_observation VALUES(1,100,2.5)");
  await db.query("UPDATE forward_observation SET return_5d=-1.5 WHERE id=1");
  const after=(await db.query("SELECT return_5d::float8 result FROM forward_observation")).rows;
  const count=(await db.query("SELECT COUNT(*)::int n FROM forward_correction_audit")).rows[0].n;
  assert.deepEqual(after,[{result:-1.5}]);
  assert.equal(count,0,"a direct UPDATE does not automatically create audit history");
  await db.query("ROLLBACK");
 }finally{await db.end();}
});
