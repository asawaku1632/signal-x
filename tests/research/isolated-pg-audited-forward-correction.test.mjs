import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { auditedForwardCorrectionSql } from "../../app/lib/learning/auditedForwardCorrectionSqlResearch.mjs";
test("isolated PG: correction preserves input and writes before-after audit atomically",async t=>{
 if(process.env.SIGNALX_RESEARCH_ISOLATED_PG!=="true"){t.skip("isolated PG only");return;}
 const db=new pg.Client({host:"127.0.0.1",port:5432,database:"signalx_research_ci",user:"signalx_ci",password:process.env.SIGNALX_RESEARCH_CI_PASSWORD,ssl:false});
 await db.connect();
 try{
 await db.query("BEGIN");
 await db.query("CREATE TEMP TABLE pattern_forward_observations(trade_date date,code text,pattern_id text,direction text,entry_price numeric,return_5d numeric,outcome_5d_date date,success_5d boolean,updated_at timestamptz DEFAULT now(),PRIMARY KEY(trade_date,code,pattern_id)) ON COMMIT DROP");
 await db.query("CREATE TEMP TABLE pattern_forward_correction_audit(trade_date date,code text,pattern_id text,old_return_5d numeric,old_outcome_5d_date date,old_success_5d boolean,new_return_5d numeric,new_outcome_5d_date date,new_success_5d boolean,correction_reason text,actor_id text) ON COMMIT DROP");
 await db.query("INSERT INTO pattern_forward_observations(trade_date,code,pattern_id,direction,entry_price,return_5d,outcome_5d_date,success_5d) VALUES('2026-10-08','9984','pattern002','BUY',100,2.5,'2026-10-16',true)");
 const args=["2026-10-08","9984","pattern002",-1.5,"2026-10-16","Verified incorrect result price","research-admin"];
 assert.equal((await db.query(auditedForwardCorrectionSql,args)).rowCount,1);
 assert.equal((await db.query(auditedForwardCorrectionSql,args)).rowCount,0);
 assert.equal((await db.query(auditedForwardCorrectionSql,[...args.slice(0,5),"bad","x"])).rowCount,0);
 const rows=(await db.query("SELECT entry_price::float8 price,direction,return_5d::float8 result,success_5d success FROM pattern_forward_observations")).rows;
 assert.deepEqual(rows,[{price:100,direction:"BUY",result:-1.5,success:false}]);
 const audits=(await db.query("SELECT old_return_5d::float8 old_value,new_return_5d::float8 new_value,correction_reason,actor_id FROM pattern_forward_correction_audit")).rows;
 assert.deepEqual(audits,[{old_value:2.5,new_value:-1.5,correction_reason:"Verified incorrect result price",actor_id:"research-admin"}]);
 await db.query("ROLLBACK");
 }finally{await db.end();}
});
