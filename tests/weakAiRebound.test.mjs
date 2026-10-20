import test from "node:test";
import assert from "node:assert/strict";
import {
  WEAK_REBOUND_VERSION,WEAK_REBOUND_HORIZONS,chooseWeakCohort,aiBucket,
  phaseGate,evaluateWeakEntry,summarizeWeakOutcomes
} from "../app/lib/research/weakAiRebound.mjs";
const date="2026-10-21";
const stock={code:"7044",name:"ピアラ",rank:1,score:35,bucket:"20–39",referencePrice:100};
const bar=(hhmm,open=100,close=open,low=Math.min(open,close)-1,high=Math.max(open,close)+1)=>({
  time:Date.parse(date+"T"+hhmm+":00+09:00")/1000,open,close,low,high
});
function candles(){
 const result=[];
 for(const [from,to] of [[9*60,11*60+25],[12*60+30,15*60+25]]){
   for(let m=from;m<=to;m+=5){
     const at=String(Math.floor(m/60)).padStart(2,"0")+":"+
       String(m%60).padStart(2,"0");
     result.push(bar(at));
   }
 }
 const last=result.find(b=>b.time===bar("15:25").time);
 last.close=104;last.high=105;
 return result;
}
const universe=Array.from({length:950},(_,i)=>({
 code:String(1000+i),name:"TEST "+(1000+i),score:i%55,price:100+i
}));
test("deterministic prior-night research cohort, no hindsight and bucket representation",()=>{
  const a=chooseWeakCohort(universe,"2026-10-20");
  assert.equal(a.length,5);
  assert.deepEqual(a,chooseWeakCohort(universe,"2026-10-20"));
  assert.deepEqual(a.map(x=>x.rank),[1,2,3,4,5]);
  assert.deepEqual(a.map(x=>x.bucket).sort(),["0–19","20–39","20–39","40–54","40–54"].sort());
  assert.equal(new Set(a.map(x=>x.code)).size,5);
  assert.ok(a.every(x=>x.score<55 && x.referencePrice>0));
  assert.equal(aiBucket(55),null);
  assert.equal(aiBucket(54),"40–54");
  assert.equal(aiBucket(0),"0–19");
  assert.equal(WEAK_REBOUND_VERSION,"WEAK_AI_LT55_RANDOMIZED_STRATA_5_V1");
});
test("no partial/low-coverage daily universe may masquerade as market evidence",()=>{
 assert.throws(()=>chooseWeakCohort(universe.slice(0,799),"2026-10-20"),/INSUFFICIENT_DAILY_COVERAGE/);
 const invalid=universe.map((r,i)=>i<200?{...r,price:0}:r);
 assert.throws(()=>chooseWeakCohort(invalid,"2026-10-20"),/INSUFFICIENT_VALID_UNIVERSE/);
 assert.throws(()=>chooseWeakCohort(universe,"2026-10-20-no"),/INVALID_SOURCE_DATE/);
});
test("no 55+ score can enter even when many ordinary stocks exist",()=>{
 const adjusted=universe.map((row,i)=>({...row,score:i<8?40:90}));
 const chosen=chooseWeakCohort(adjusted,"2026-10-20");
 assert.equal(chosen.length,5);
 assert.ok(chosen.every(x=>x.score===40));
});
test("freeze / 16:55 5minute archive / 17:35 exact-day outcome windows",()=>{
 const now=hhmm=>new Date("2026-10-20T"+hhmm+":00+09:00");
 const trading=()=>true;
 assert.equal(phaseGate(now("18:24"),"freeze",trading).ok,false);
 assert.equal(phaseGate(now("18:25"),"freeze",trading).ok,true);
 assert.equal(phaseGate(now("16:55"),"entry",trading).ok,true);
 assert.equal(phaseGate(now("17:20"),"entry",trading).ok,false);
 assert.equal(phaseGate(now("17:35"),"outcomes",trading).ok,true);
 assert.equal(phaseGate(now("17:34"),"outcomes",trading).ok,false);
 assert.equal(phaseGate(now("18:25"),"freeze",()=>false).ok,false);
 assert.throws(()=>phaseGate(now("17:35"),"unknown",trading),/INVALID_PHASE/);
});
test("09:10 entry reference, saved afternoon close and adverse excursion",()=>{
 const result=evaluateWeakEntry(date,stock,candles());
 assert.equal(result.code,"7044");
 assert.equal(result.status,"COMPLETE");
 assert.equal(result.entryPrice,100);
 assert.equal(result.closePrice,104);
 assert.equal(result.sameDayReturn,4);
 assert.equal(result.maxAdversePct,-1);
 assert.equal(result.open5RangePct,2);
});
test("missing 9:10 or 9:00/09:05 never counted as losses or zero profits",()=>{
 for(const missing of ["09:10","09:00","09:05","12:45"]){
   const time=bar(missing).time;
   const study=evaluateWeakEntry(date,stock,candles().filter(b=>b.time!==time));
   assert.equal(study.status,"UNAVAILABLE");
   assert.equal(study.entryPrice,null);
 }
});
test("future-day 5m bar cannot leak into entry observation",()=>{
 const bars=candles();
 bars.unshift({...bar("09:10",999),time:Date.parse("2026-10-20T09:10:00+09:00")/1000});
 assert.equal(evaluateWeakEntry(date,stock,bars).entryPrice,100);
});
test("large repricing requires review rather than a misleading realized return",()=>{
 const prior={...stock,referencePrice:50};
 const result=evaluateWeakEntry(date,prior,candles());
 assert.equal(result.status,"UNAVAILABLE");
 assert.equal(result.reason,"EXTREME_PRICE_GAP_REVIEW");
});
test("future 1/3/5/10 period counts use only non-null returns and do not infer 0",()=>{
 const samples=[{entry_date:date,entry_price:"100",return_1d:"5",return_3d:null,
   return_5d:"-5",return_10d:null},
  {entry_date:date,entry_price:null,return_1d:null,return_3d:null,
   return_5d:null,return_10d:null}];
 const outcomes=summarizeWeakOutcomes(samples);
 assert.deepEqual(WEAK_REBOUND_HORIZONS,[1,3,5,10]);
 assert.deepEqual(outcomes.map(x=>x.checked),[1,0,1,0]);
 assert.equal(outcomes[0].up,1);
 assert.equal(outcomes[2].minus3,1);
 assert.equal(outcomes[0].positiveRate,null);
 assert.equal(outcomes[2].worstPct,null);
});
test("even with 60 verified observations, fewer than 20 unique sessions hides profitability claims",()=>{
 const set=Array.from({length:60},(_,i)=>({entry_date:"2026-10-"+String(1+i%10).padStart(2,"0"),
 entry_price:100,return_1d:i%2===0?4:-4}));
 assert.equal(summarizeWeakOutcomes(set)[0].checked,60);
 assert.equal(summarizeWeakOutcomes(set)[0].positiveRate,null);
 const dates=Array.from({length:60},(_,i)=>({entry_date:"2026-10-"+String(1+Math.floor(i/3)).padStart(2,"0"),
 entry_price:100,return_1d:i%2===0?4:-4}));
 const ready=summarizeWeakOutcomes(dates)[0];
 assert.equal(ready.distinctDates,20);
 assert.equal(ready.positiveRate,50);
 assert.equal(ready.averagePct,0);
});
