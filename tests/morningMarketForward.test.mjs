import test from "node:test";
import assert from "node:assert/strict";
import {
  MARKET_FORWARD_POLICY,preopenGate,parsePreopenQuote,marketBands,
  summarizeMorningMarketForward
} from "../app/lib/research/morningMarketForward.mjs";

const jst=(date,hh,mm)=>new Date(Date.parse(date+"T00:00:00+09:00")+
  (hh*60+mm)*60_000);
const bar=(times,closes)=>({chart:{result:[{
  timestamp:times.map(d=>d.getTime()/1000),
  indicators:{quote:[{close:closes}]}}]}});

test("8:40-8:54 JST only, fail closed on holidays and other hours",()=>{
  assert.equal(preopenGate(jst("2026-10-21",8,45),()=>true).ok,true);
  assert.equal(preopenGate(jst("2026-10-21",8,39),()=>true).ok,false);
  assert.equal(preopenGate(jst("2026-10-21",8,55),()=>true).ok,false);
  assert.equal(preopenGate(jst("2026-10-21",8,45),()=>false).reason,"MARKET_CLOSED");
});

test("snapshot refuses future bars and missing/revised records",()=>{
  const t0=new Date("2026-10-19T00:00:00Z");
  const t1=new Date("2026-10-20T00:00:00Z");
  const tFuture=new Date("2026-10-22T00:00:00Z");
  const now=jst("2026-10-21",8,45);
  const q=parsePreopenQuote(bar([t0,t1,tFuture],[100,102,999]),"Asia/Tokyo",now);
  assert.equal(q.price,102); assert.equal(q.changePct,2);
  assert.equal(q.sourceTimestamp,t1.toISOString());
  assert.equal(parsePreopenQuote(bar([t0,t1],[null,102]),"Asia/Tokyo",now),null);
  assert.equal(parsePreopenQuote({}, "Asia/Tokyo",now),null);
});
test("USDJPY up means yen weaker; mixed US never means all up",()=>{
  const q=p=>({state:"REFERENCE",price:100,changePct:p,quoteDate:"2026-10-20",
    sourceTimestamp:"2026-10-20T00:00:00Z"});
  assert.deepEqual(marketBands({dow:q(0.5),nasdaq:q(0.9),usdJpy:q(0.3)}),
    {us:"US_UP",fx:"YEN_WEAKER"});
  assert.deepEqual(marketBands({dow:q(0.5),nasdaq:q(-0.9),usdJpy:q(-0.3)}),
    {us:"US_MIXED",fx:"YEN_STRONGER"});
  assert.equal(marketBands({dow:q(0.5),nasdaq:null,usdJpy:q(0.3)}),null);
});

function fixtures(numDays=10){
  const snapshots=[],runs=[];
  for(let i=0;i<numDays;i++){
    const date="2026-10-"+String(i+1).padStart(2,"0"),
      t=jst(date,8,45).toISOString(),morning=jst(date,9,8).toISOString(),
      closing=jst(date,17,5).toISOString();
    const quote=(price,changePct)=>({state:"REFERENCE",price,changePct,
      quoteDate:"2026-09-30",sourceTimestamp:"2026-09-30T22:00:00Z"});
    const cohort=[],morning_observations=[],closing_results=[];
    for(const code of ["1001","1002","1003"]){
      cohort.push({code,referencePrice:1000});
      morning_observations.push({code,open0900:975,price0905:982,
        label:"BUY_CANDIDATE"});
      closing_results.push({code,complete:true,label:"BUY_CANDIDATE",
        observedEntry:982,closePrice:994,pnl100:1200});
    }
    snapshots.push({trade_date:date,policy_version:MARKET_FORWARD_POLICY,
      state:"COMPLETE",captured_at:t,quotes:{
        dow:quote(40_000,0.6),nasdaq:quote(20_000,1.2),usdJpy:quote(150,0.3)}});
    runs.push({trade_date:date,cohort,morning_observations,closing_results,
      morning_saved_at:morning,closing_saved_at:closing});
  }
  return {snapshots,runs};
}
test("forward join requires stored preopen + 9:05 + closing same stock",()=>{
  const {snapshots,runs}=fixtures();
  const summary=summarizeMorningMarketForward(snapshots,runs);
  assert.equal(summary.capturedDays,10);
  assert.equal(summary.pairs,30);
  assert.equal(summary.days,10);
  assert.equal(summary.sufficient,true);
  const combo=summary.groups.find(g=>g.type==="combo");
  assert.equal(combo.samples,30);
  assert.equal(combo.winRate,100);
  assert.equal(combo.averagePnl100,1200);
  assert.match(combo.label,/円安方向/);
});
test("no 09:05 data, post-open snapshots, and unconfirmed outcomes never count",()=>{
  const {snapshots,runs}=fixtures(1);
  runs[0].closing_results[0].complete=false;
  runs[0].closing_results[1].observedEntry=975;
  snapshots[0].captured_at=jst("2026-10-01",9,15).toISOString();
  assert.equal(summarizeMorningMarketForward(snapshots,runs).pairs,0);
  snapshots[0].captured_at=jst("2026-10-01",8,45).toISOString();
  assert.equal(summarizeMorningMarketForward(snapshots,runs).pairs,1);
  assert.equal(summarizeMorningMarketForward(snapshots,runs).groups[0].winRate,null);
});
test("future revised reference timestamps are excluded",()=>{
  const {snapshots,runs}=fixtures(1);
  snapshots[0].quotes.nasdaq.state="UNAVAILABLE";
  assert.equal(summarizeMorningMarketForward(snapshots,runs).pairs,0);
});

test("persisted quote later than its preopen capture cannot leak into results",()=>{
  const {snapshots,runs}=fixtures(1);
  snapshots[0].quotes.dow.sourceTimestamp=jst("2026-10-01",9,10).toISOString();
  assert.equal(summarizeMorningMarketForward(snapshots,runs).pairs,0);
  snapshots[0].quotes.dow.sourceTimestamp="2026-09-30T22:00:00Z";
  snapshots[0].quotes.nasdaq.quoteDate="2026-10-02";
  assert.equal(summarizeMorningMarketForward(snapshots,runs).pairs,0);
});
