import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

// Isolated, temporary CI SQL contract only. Does not call live application
// functions, production databases, or any price provider.
test("isolated PostgreSQL: replay must preserve original observation fields",async(t)=>{
 if(process.env.SIGNALX_RESEARCH_ISOLATED_PG!=="true"){t.skip("isolated PG only");return;}
 const client=new pg.Client({host:"127.0.0.1",port:5432,database:"signalx_research_ci",user:"signalx_ci",password:process.env.SIGNALX_RESEARCH_CI_PASSWORD,ssl:false});
 await client.connect();
 try {
  await client.query("BEGIN");
  await client.query("CREATE TEMP TABLE immutable_observation (trade_date date, code text, pattern_id text, entry_price numeric, direction text, return_5d numeric, PRIMARY KEY(trade_date,code,pattern_id)) ON COMMIT DROP");
  const key=["2026-10-08","9984","pattern002"];
  await client.query("INSERT INTO immutable_observation(trade_date,code,pattern_id,entry_price,direction) VALUES($1,$2,$3,100,'BUY')",key);
  // Candidate fix: conflict must never update the first observation.
  await client.query("INSERT INTO immutable_observation(trade_date,code,pattern_id,entry_price,direction) VALUES($1,$2,$3,120,'SELL') ON CONFLICT(trade_date,code,pattern_id) DO NOTHING",key);
  await client.query("UPDATE immutable_observation SET return_5d=2.5 WHERE trade_date=$1 AND code=$2 AND pattern_id=$3",key);
  const result=await client.query("SELECT entry_price::float8 AS price,direction,return_5d::float8 AS outcome FROM immutable_observation");
  assert.deepEqual(result.rows,[{price:100,direction:"BUY",outcome:2.5}]);
  await client.query("ROLLBACK");
 } finally {await client.end();}
});
