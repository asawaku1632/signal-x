import test from "node:test";
import assert from "node:assert/strict";
import {ENTRY_TIME_SLOTS, selectPriorDayCandidates, evaluateEntryTimes, summarizeEntryTimes, jstParts} from "../app/lib/research/entryTimeShadow.mjs";

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
test("sample consistency across time slots, losses and skipped bars separate",()=>{
  const make=(code,p)=>evaluateEntryTimes("2026-10-14",{code,name:code,rank:1,score:95,referencePrice:3100},
    [...slots.map(s=>bar("2026-10-14",s,p)),bar("2026-10-14","15:25",3100,3100)]);
  const study=summarizeEntryTimes([make("3762",3000),make("6758",3200),evaluateEntryTimes("2026-10-14",
    {code:"8306",name:"X",rank:3,score:94,referencePrice:2000},[])]);
  assert.ok(study.every(s=>s.samples===2));
  assert.ok(study.every(s=>s.winRate===50));
  assert.ok(study.every(s=>s.worstReturn<0));
});
