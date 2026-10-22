import test from "node:test";
import assert from "node:assert/strict";
import {
  gatePhase,selectFrozenCohort,decideAtNineOhFive,compareClosingResults,
  summarizeForwardResearch,MORNING_FINAL_POLICY
} from "../app/lib/research/morningFinalCheck.mjs";

const today="2026-10-20";
const bar=(when,open,high=open,low=open,close=open,volume=1000)=>
  ({time:Date.parse(today+"T"+when+":00+09:00")/1000,open,high,low,close,volume});
const c={code:"7044",name:"ピアラ",score:96.7,rank:1,referencePrice:100};
const market=()=>true;

test("cron phases are restricted to Japanese trading hours and no after-the-fact replay",()=>{
  const at=x=>new Date(today+"T"+x+":00+09:00");
  assert.equal(gatePhase(at("09:07"),"morning",market).ok,false);
  assert.equal(gatePhase(at("09:08"),"morning",market).ok,true);
  assert.equal(gatePhase(at("09:19"),"morning",market).ok,false);
  assert.equal(gatePhase(at("16:45"),"closing",market).ok,false);
  assert.equal(gatePhase(at("17:05"),"closing",market).ok,true);
  assert.equal(gatePhase(at("18:10"),"freeze",market).ok,true);
  assert.equal(gatePhase(at("20:00"),"freeze",market).ok,false);
  assert.equal(gatePhase(at("09:08"),"morning",()=>false).reason,"MARKET_CLOSED");
  assert.throws(()=>gatePhase(at("09:08"),"unknown",market),/INVALID_PHASE/);
});
test("night selection is predetermined: <=5, numeric scores and price valid",()=>{
  const dbSignal={code:c.code,name:c.name,score:c.score,price:100};
  const candidates=selectFrozenCohort([
    {...dbSignal,score:101},dbSignal,{...dbSignal,code:"8306",score:92},
    {...dbSignal,code:"9984",score:99}, {...dbSignal,code:"1111",score:85},
    {...dbSignal,code:"2222",score:85},{...dbSignal,code:"3333",score:88},
    {...dbSignal,code:"4444",score:84}]);
  assert.deepEqual(candidates.map(x=>x.code),["9984","7044","8306","3333","1111"]);
  assert.equal(candidates[0].rank,1);
  assert.equal(MORNING_FINAL_POLICY,"FROZEN_NIGHT_0905_CHECK_V1");
});
test("09:05 uses only 09:00 complete OHLC and 09:05 OPEN; later bars never matter",()=>{
  const a=[bar("09:00",100,101,99.5,100.2,2000),
    bar("09:05",100.5,200,10,200,99999),bar("09:10",1,1000,1,1,99999)];
  const s=decideAtNineOhFive(c,a,today);
  assert.equal(s.label,"BUY_CANDIDATE");
  assert.equal(s.price0905,100.5);
  assert.equal(s.open0900,100);
  assert.equal(s.gapPct,0.5);
  assert.equal(s.volume0900,2000);
});
test("clear skip/caution rules and genuine missing as unavailable",()=>{
  const base=[bar("09:00",100,101,99.5,100,500),bar("09:05",100,100,100,100)];
  assert.equal(decideAtNineOhFive(c,base,today).label,"BUY_CANDIDATE");
  assert.equal(decideAtNineOhFive(c,[base[0],bar("09:05",105,105,105,105)],today).label,"SKIP");
  assert.equal(decideAtNineOhFive(c,[base[0],bar("09:05",103.5)],today).label,"CAUTION");
  assert.equal(decideAtNineOhFive(c,[bar("09:00",100,105,99,100,500),base[1]],today).label,"SKIP");
  assert.equal(decideAtNineOhFive(c,[bar("09:00",100,101,97,100,500),base[1]],today).label,"SKIP");
  assert.equal(decideAtNineOhFive(c,[bar("09:00",100,101,99,100,0),base[1]],today).label,"SKIP");
  assert.equal(decideAtNineOhFive(c,[base[0]],today).label,"UNAVAILABLE");
  assert.equal(decideAtNineOhFive(c,[bar("09:00",100,null,99,100),base[1]],today).label,"UNAVAILABLE");
  assert.equal(decideAtNineOhFive(c,[bar("09:00",100,101,99,100,500),
    {time:Date.parse("2026-10-19T09:05:00+09:00")/1000,open:100}],today).label,"UNAVAILABLE");
});
test("closing comparison requires same previously frozen date, score and reference",()=>{
  const m={code:"7044",label:"BUY_CANDIDATE",price0905:100};
  const result={date:today,code:"7044",priorScore:96.7,priorReferencePrice:100,
    complete:true,closePrice:104};
  const base={tradeDate:today,cohort:[c],morning:[m],closingRun:{
    trade_date:today,status:"COMPLETE",results:[result]}};
  const good=compareClosingResults(base)[0];
  assert.equal(good.complete,true);
  assert.equal(good.pnl100,400);
  assert.equal(good.gatedPnl100,400);
  const wrongScore=compareClosingResults({...base,closingRun:{
    trade_date:today,status:"COMPLETE",results:[{...result,priorScore:96.8}]}})[0];
  assert.equal(wrongScore.complete,false);
  const wrongDate=compareClosingResults({...base,closingRun:{
    trade_date:"2026-10-19",status:"COMPLETE",results:[result]}})[0];
  assert.equal(wrongDate.complete,false);
});
test("skips count zero invested, avoided loss and missed profit separately",()=>{
  const run={trade_date:today,status:"COMPLETE",results:[
    {date:today,code:"7044",priorScore:96.7,priorReferencePrice:100,complete:true,closePrice:95}]};
  const data=compareClosingResults({tradeDate:today,cohort:[c],
    morning:[{code:"7044",label:"SKIP",price0905:100}],closingRun:run});
  assert.equal(data[0].pnl100,-500);
  assert.equal(data[0].gatedPnl100,0);
  assert.equal(data[0].avoidedLoss100,500);
  const profit=compareClosingResults({tradeDate:today,cohort:[c],
    morning:[{code:"7044",label:"CAUTION",price0905:100}],
    closingRun:{...run,results:[{...run.results[0],closePrice:103}]}});
  assert.equal(profit[0].missedProfit100,300);
});
test("not enough forward days hides statistics; invalid/duplicated outcomes excluded",()=>{
  const item={code:"7044",label:"BUY_CANDIDATE",complete:true,
    observedEntry:100,closePrice:105,pnl100:500,gatedPnl100:500,
    avoidedLoss100:0,missedProfit100:0};
  const stats=summarizeForwardResearch([
    {trade_date:today,closing_results:[item,item]}]);
  assert.equal(stats.samples,1);
  assert.equal(stats.sufficient,false);
  assert.equal(stats.labels[0].positiveRate,null);
  assert.equal(stats.allPnl100,null);
});

test("price verification fails closed on invalid candles and does not turn them into skips",()=>{
  const good=[bar("09:00",100,100.8,99.5,100,1000),bar("09:05",100.5)];
  const bad=[
    [],
    [good[0]],
    [good[1]],
    [bar("09:00",100,99,98,100),good[1]],
    [bar("09:00",100,101,99,102),good[1]],
    [bar("09:00",100,101,99,98),good[1]],
    [bar("09:00",100,101,99,100,-1),good[1]],
    [good[0],{...good[1],time:good[1].time+0.5}],
    [good[0],{...good[1],time:good[1].time+60}],
    [good[0],{...good[1],open:0}],
    [bar("09:00",100,101,99,100),bar("09:05",Number.NaN)],
    [bar("09:00",100,101,99,100),{...good[1],time:Date.parse("2026-10-19T09:05:00+09:00")/1000}],
  ];
  for(const candles of bad){
    const result=decideAtNineOhFive(c,candles,today);
    assert.equal(result.label,"UNAVAILABLE");
    assert.equal(result.price0905,null);
  }
  assert.equal(decideAtNineOhFive(c,good,today).label,"BUY_CANDIDATE");
});
