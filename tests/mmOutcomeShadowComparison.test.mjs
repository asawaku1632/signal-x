import test from "node:test";
import assert from "node:assert/strict";
import { compareMmOutcomeShadow as compare } from "../app/lib/research/mmOutcomeShadowComparison.mjs";

const sessions = ["2026-09-18","2026-09-24","2026-09-25","2026-09-28","2026-09-29","2026-09-30"];
const stock = new Map(sessions.map((date,i)=>[date,100+i*2]));
stock.set("2026-09-21",100);
stock.set("2026-09-22",100);
const index = new Map(sessions.map((date,i)=>[date,2000+i*10]));
const fixture = () => ({
  observations:[{code:"3762",tradeDate:"2026-09-18",storedResult1d:0,storedResult3d:2,storedResult5d:6}],
  exchangeSessions:sessions,calendarVerified:true,calendarComplete:true,
  stockClosesByCode:new Map([["3762",stock]]),indexCloses:index,asOfDate:"2026-10-01",
});

test("compare legacy offset returns without rewriting original observations",()=>{
  const input=fixture();
  const before=JSON.stringify(input.observations);
  const result=compare(input);
  assert.equal(result.status,"RESEARCH_ONLY");
  assert.equal(result.rows[0].horizons[5].sessionDate,"2026-09-30");
  assert.equal(result.rows[0].horizons[5].storedReturn,6);
  assert.ok(Math.abs(result.rows[0].horizons[5].shadowReturn-10)<1e-9);
  assert.ok(Math.abs(result.rows[0].horizons[5].delta-4)<1e-9);
  assert.equal(JSON.stringify(input.observations),before);
});
test("reject unverified calendar without presenting corrected results",()=>{
  const result=compare({...fixture(),calendarVerified:false});
  assert.equal(result.status,"BLOCKED");
  assert.deepEqual(result.rows,[]);
});
test("withhold result if exact TOPIX close missing",()=>{
  const i=new Map(index);
  i.delete("2026-09-30");
  const result=compare({...fixture(),indexCloses:i});
  assert.equal(result.rows[0].horizons[5].status,"STOCK_ONLY");
  assert.ok(Math.abs(result.rows[0].horizons[5].delta-4)<1e-9);
  assert.equal(result.rows[0].horizons[5].excessReturn,null);
});
test("future fifth session remains pending",()=>{
  const result=compare({...fixture(),asOfDate:"2026-09-29"});
  assert.equal(result.rows[0].horizons[5].status,"PENDING");
});

test("missing all TOPIX still allows verified stock-only comparison",()=>{
  const result=compare({...fixture(),indexCloses:new Map()});
  assert.equal(result.rows[0].horizons[5].status,"STOCK_ONLY");
  assert.ok(Math.abs(result.rows[0].horizons[5].shadowReturn-10)<1e-9);
  assert.equal(result.rows[0].horizons[5].benchmarkReturn,null);
});
