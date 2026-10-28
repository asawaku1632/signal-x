import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

// Isolated PostgreSQL only. Exercises column-level permissions; no real DB roles.
test("isolated PG: restricted role cannot overwrite inputs or results",async t=>{
 if(process.env.SIGNALX_RESEARCH_ISOLATED_PG!=="true"){t.skip("isolated PG only");return;}
 const db=new pg.Client({host:"127.0.0.1",port:5432,database:"signalx_research_ci",user:"signalx_ci",password:process.env.SIGNALX_RESEARCH_CI_PASSWORD,ssl:false});
 await db.connect();
 try{
  await db.query("BEGIN");
  await db.query("CREATE TEMP TABLE protected_forward(id integer PRIMARY KEY,entry_price numeric,return_5d numeric)");
  await db.query("INSERT INTO protected_forward VALUES(1,100,2.5)");
  await db.query("CREATE ROLE signalx_restricted_test NOLOGIN");
  await db.query("GRANT SELECT ON protected_forward TO signalx_restricted_test");
  await db.query("SAVEPOINT unauthorized_write");
  await db.query("SET LOCAL ROLE signalx_restricted_test");
  await assert.rejects(db.query("UPDATE protected_forward SET return_5d=-1 WHERE id=1"),e=>e.code==="42501");
  await db.query("ROLLBACK TO SAVEPOINT unauthorized_write");
  const rows=(await db.query("SELECT entry_price::float8 price,return_5d::float8 result FROM protected_forward")).rows;
  assert.deepEqual(rows,[{price:100,result:2.5}]);
 }finally{
  await db.query("ROLLBACK").catch(()=>{});
  await db.end();
 }
});
