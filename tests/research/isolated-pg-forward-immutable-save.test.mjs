import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { immutablePatternForwardInsertSql, immutablePatternForwardResultUpdateSql } from "../../app/lib/learning/immutablePatternForwardSqlResearch.mjs";

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

test("isolated PostgreSQL: execute proposed SQL and prevent replay of outcomes",async(t)=>{
 if(process.env.SIGNALX_RESEARCH_ISOLATED_PG!=="true"){t.skip("isolated PG only");return;}
 const client=new pg.Client({host:"127.0.0.1",port:5432,database:"signalx_research_ci",user:"signalx_ci",password:process.env.SIGNALX_RESEARCH_CI_PASSWORD,ssl:false});
 await client.connect();
 try {
  await client.query("BEGIN");
  await client.query("CREATE TEMP TABLE pattern_forward_observations(trade_date date,code text,pattern_id text,pattern_name text,direction text,entry_price numeric,confidence numeric,pattern_score numeric,return_5d numeric,outcome_5d_date date,success_5d boolean,updated_at timestamptz DEFAULT now(),PRIMARY KEY(trade_date,code,pattern_id)) ON COMMIT DROP");
  const first=["2026-10-08","9984","pattern002","Double bottom","BUY",100,70,65];
  const replay=["2026-10-08","9984","pattern002","Changed name","SELL",120,90,99];
  assert.equal((await client.query(immutablePatternForwardInsertSql,first)).rowCount,1);
  assert.equal((await client.query(immutablePatternForwardInsertSql,replay)).rowCount,0);
  assert.equal((await client.query(immutablePatternForwardResultUpdateSql,["2026-10-08","9984","pattern002",2.5,"2026-10-16"])).rowCount,1);
  assert.equal((await client.query(immutablePatternForwardResultUpdateSql,["2026-10-08","9984","pattern002",99,"2026-10-19"])).rowCount,0);
  const row=(await client.query("SELECT pattern_name,direction,entry_price::float8 price,confidence::float8 confidence,pattern_score::float8 score,return_5d::float8 result,outcome_5d_date::text result_day,success_5d success FROM pattern_forward_observations")).rows[0];
  assert.deepEqual(row,{pattern_name:"Double bottom",direction:"BUY",price:100,confidence:70,score:65,result:2.5,result_day:"2026-10-16",success:true});
  await client.query("ROLLBACK");
 } finally {await client.end();}
});
