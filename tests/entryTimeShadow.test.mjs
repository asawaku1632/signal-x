import test from "node:test";
import assert from "node:assert/strict";
import {ENTRY_TIME_SLOTS, selectPriorDayCandidates, evaluateEntryTimes, summarizeEntryTimes, jstParts, compareEarlyVsWait, summarizeEntryRisk} from "../app/lib/research/entryTimeShadow.mjs";

const bar=(day,time,open,close=open)=>{
  const ms=Date.parse(day+"T"+time+":00+09:00");
  return {time:ms/1000,open,close};
};
const slots=[...ENTRY_TIME_SLOTS];
test("JST exchange bar timestamps preserve wall-clock times",()=>{
  assert.deepEqual(jstParts(bar("2026-10-14","11:00",3155).time*1000),
    {date:"2026-10-14",hhmm:"11:00",minute:660});
});
test("prior-night candidates are deterministically top score, never hindsight price",()=>{
  const rows=[{code:"3762",name:"A",score:91,price:3195},{code:"6758",name:"B",score:96,price:3900},
    {code:"9984",name:"C",score:84,price:5500},{code:"8306",name:"D",score:97,price:1000}];
  assert.deepEqual(selectPriorDayCandidates(rows).map(x=>x.code),["8306","6758","3762"]);
});
test("same prior-night stock uses six entry opens and identical closing reference",()=>{
  const tradeDate="2026-10-14";
  const bars=[...slots.map((slot,index)=>bar(tradeDate,slot,3100+index*10)),
    bar(tradeDate,"15:25",3210,3220),bar("2026-10-13","11:00",10000)];
  const a=evaluateEntryTimes(tradeDate,{code:"3762",name:"A",rank:1,score:95,referencePrice:3000},bars);
  assert.equal(a.complete,true);
  assert.deepEqual(a.entries.map(x=>x.entryPrice),[3100,3110,3120,3130,3140,3150]);
  assert.ok(a.entries.every(x=>x.closePrice===3220));
  assert.equal(a.entries[0].pnl100,12000);
});
test("missing 11:00 is missing, never borrowed from previous or later bar",()=>{
  const bars=slots.filter(s=>s!=="11:00").map(s=>bar("2026-10-14",s,3100));
  bars.push(bar("2026-10-14","15:25",3150,3155));
  const a=evaluateEntryTimes("2026-10-14",{code:"3762",name:"A",rank:1,score:95,referencePrice:3000},bars);
  assert.equal(a.complete,false);
  assert.equal(a.entries.find(e=>e.time==="11:00").entryPrice,null);
  assert.equal(summarizeEntryTimes([a])[0].samples,0);
});
test("no 15:25/15:30 final bar means no scored outcomes",()=>{
  const a=evaluateEntryTimes("2026-10-14",{code:"3762",name:"A",rank:1,score:95,referencePrice:3000},
    slots.map(s=>bar("2026-10-14",s,3100)));
  assert.equal(a.closePrice,null);
  assert.equal(a.entries[0].returnPct,null);
});
test("explicit 15:30 auction close has priority over preceding 15:25",()=>{
  const date="2026-10-14";
  const a=evaluateEntryTimes(date,{code:"3762",name:"A",rank:1,score:95,referencePrice:3000},
    [...slots.map(s=>bar(date,s,3100)),bar(date,"15:25",3090,3090),bar(date,"15:30",3200,3200)]);
  assert.equal(a.closePrice,3200);
});
test("sample consistency across time slots, losses and skipped bars separate",()=>{
  const make=(code,p)=>evaluateEntryTimes("2026-10-14",{code,name:code,rank:1,score:95,referencePrice:3100},
    [...slots.map(s=>bar("2026-10-14",s,p)),bar("2026-10-14","15:25",3100,3100)]);
  const study=summarizeEntryTimes([make("3762",3000),make("6758",3200),evaluateEntryTimes("2026-10-14",
    {code:"8306",name:"X",rank:3,score:94,referencePrice:2000},[])]);
  assert.ok(study.every(s=>s.samples===2));
  assert.ok(study.every(s=>s.winRate===50));
  assert.ok(study.every(s=>s.worstReturn<0));
});

test("9:05 versus 11:00 uses same complete stocks and same exit, excluding incomplete candidates",()=>{
 const date="2026-10-14";
 const make=(code,pEarly,pLate)=>{
   const candles=slots.map(s=>bar(date,s,s==="09:05"?pEarly:s==="11:00"?pLate:100));
   candles.push(bar(date,"15:25",100,100));
   return evaluateEntryTimes(date,{code,name:code,rank:1,score:95,referencePrice:100},candles);
 };
 const incomplete=evaluateEntryTimes(date,{code:"3333",name:"missing",rank:3,score:95,referencePrice:100},
   [bar(date,"09:05",90),bar(date,"11:00",110),bar(date,"15:25",100,100)]);
 const s=compareEarlyVsWait([make("1111",95,105),make("2222",105,95),incomplete]);
 assert.equal(s.samples,2);assert.equal(s.days,1);
 assert.equal(s.earlyWins,1);assert.equal(s.lateWins,1);
 assert.equal(s.earlyOnlyWins,1);assert.equal(s.lateOnlyWins,1);
 assert.equal(s.waitCheaper,1);assert.equal(s.earlyCheaper,1);
 assert.equal(s.avgEarlyAdvantage100,0);
 assert.throws(()=>compareEarlyVsWait([incomplete],"11:00","09:05"),/INVALID_TIME_PAIR/);
});
test("full observed 5m lows capture severe interim losses despite profitable closing price",()=>{
 const date="2026-10-14", full=[];
 for (const [start,end] of [[9*60,11*60+25],[12*60+30,15*60+25]]){
  for(let min=start;min<=end;min+=5){
    const time=String(Math.floor(min/60)).padStart(2,"0")+":"+String(min%60).padStart(2,"0");
    const candle=bar(date,time,100,time==="15:25"?105:100);
    candle.low=time==="09:40"?75:time==="11:00"?98:99;
    full.push(candle);
  }
 }
 const r=evaluateEntryTimes(date,{code:"3762",name:"stock",rank:1,score:95,referencePrice:100},full);
 assert.equal(r.complete,true);
 const early=r.entries.find(e=>e.time==="09:05");
 const late=r.entries.find(e=>e.time==="11:00");
 assert.equal(early.pnl100,500);assert.equal(late.pnl100,500);
 assert.equal(early.maxAdversePnl100,-2500);
 assert.equal(late.maxAdversePnl100,-200);
 assert.equal(early.riskBarsObserved,early.riskBarsRequired);
 assert.ok(early.riskBarsRequired>late.riskBarsRequired);
 assert.equal(summarizeEntryRisk([r]).find(x=>x.time==="09:05").samples,1);
});
test("missing a 5m low leaves intraday risk unknown, not zero or an optimistic bound",()=>{
 const date="2026-10-14", candles=[];
 for (const [start,end] of [[9*60,11*60+25],[12*60+30,15*60+25]]){
  for(let min=start;min<=end;min+=5){
   const time=String(Math.floor(min/60)).padStart(2,"0")+":"+String(min%60).padStart(2,"0");
   const candle=bar(date,time,100,time==="15:25"?105:100);
   candle.low=time==="10:05"?null:99;
   candles.push(candle);
  }
 }
 const r=evaluateEntryTimes(date,{code:"3762",name:"stock",rank:1,score:95,referencePrice:100},candles);
 assert.equal(r.complete,true);
 assert.equal(r.entries.find(x=>x.time==="09:05").maxAdversePnl100,null);
 assert.equal(r.entries.find(x=>x.time==="11:00").maxAdversePnl100,-100);
 assert.equal(summarizeEntryRisk([r])[0].samples,0);
});
