import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyForwardResearchReport } from "../app/lib/research/dailyForwardResearchPipeline.mjs";

test("integrates legacy saved snapshots with independent daily OHLC but refuses unverified returns", () => {
  const dates = Array.from({length:21},(_,i)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10));
  const original = {id:"p1",code:"1234",date:dates[0],score:90,price:100,result:"WIN"};
  const daily = [5,10,20].map((i)=>({code:"1234",date:dates[i],close:110,priceBasisVerified:true,corporateActionUnresolved:false}));
  const result = buildDailyForwardResearchReport({snapshotRows:[original],licensedDailyRows:daily,verifiedSessions:dates});
  assert.equal(result.mode,"OFFLINE_RESEARCH_ONLY");
  assert.deepEqual(result.rows.map(x=>x.status),Array(3).fill("PRICE_BASIS_UNVERIFIED"));
  assert.ok(result.summary.every(x=>x.verified===0 && x.positiveRate===null));
  assert.equal(original.result,"WIN");
});
test("zero input never creates synthetic performance",()=>{
  const result=buildDailyForwardResearchReport({snapshotRows:[],licensedDailyRows:[],verifiedSessions:[]});
  assert.equal(result.rows.length,0);
  assert.ok(result.summary.every(x=>x.positiveRate===null));
});
