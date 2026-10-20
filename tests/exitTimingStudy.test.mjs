import test from "node:test";
import assert from "node:assert/strict";
import {
 evaluateExitTimeStudy,morningGateAvailable,pairExitResearch,summarizeExitResearch,
 EXIT_TIMES,EXIT_TIME_COMPARE_VERSION
} from "../app/lib/research/exitTimingStudy.mjs";

const date="2026-10-21";
const candidate={code:"7044",name:"ピアラ",rank:1,score:96.7,referencePrice:100};
const bar=(time,open=100,close=open,low=Math.min(open,close)-1,high=Math.max(open,close)+1)=>({
  time:Date.parse(date+"T"+time+":00+09:00")/1000,open,close,low,high
});
function fullBars(){
 const items=[];
 for(const [from,to] of [[9*60,11*60+25],[12*60+30,15*60+25]]){
   for(let minute=from;minute<=to;minute+=5){
     const hh=String(Math.floor(minute/60)).padStart(2,"0")+":"+
       String(minute%60).padStart(2,"0");
     items.push(bar(hh));
   }
 }
 return items;
}
function fullEvidence(){
 const b=fullBars();
 for(const [slot,close] of [["09:25",102],["09:55",101],["11:25",98],["15:25",105]]){
   const v=b.find(x=>x.time===bar(slot).time);
   v.close=close;v.high=Math.max(v.open,close)+1;
   v.low=Math.min(v.open,close)-1;
 }
 return b;
}
test("four exit prices use 09:10 entry OPEN and exact prior 5m candle closes",()=>{
 const r=evaluateExitTimeStudy(date,candidate,fullEvidence());
 assert.equal(r.version,EXIT_TIME_COMPARE_VERSION);
 assert.equal(r.entryPrice,100);
 assert.equal(r.complete,true);
 assert.deepEqual(r.results.map(x=>x.time),EXIT_TIMES);
 assert.deepEqual(r.results.map(x=>x.exitPrice),[102,101,98,105]);
 assert.deepEqual(r.results.map(x=>x.pnl100),[200,100,-200,500]);
 assert.equal(r.results[0].maxAdversePct,-1);
 assert.equal(r.results[2].maxAdversePct,-3);
});
test("09:30 exit must read 09:25 CLOSE, not 09:30 candle's future close",()=>{
 const b=fullEvidence();b.find(x=>x.time===bar("09:30").time).close=900;
 assert.equal(evaluateExitTimeStudy(date,candidate,b).results[0].exitPrice,102);
});
test("15:30 auction is separate from 15:25 close",()=>{
 const b=fullEvidence();b.push(bar("15:30",120,119,118,121));
 assert.equal(evaluateExitTimeStudy(date,candidate,b).results[3].exitPrice,119);
});
test("no missing middle bar is silently skipped or filled",()=>{
 const b=fullEvidence().filter(x=>x.time!==bar("09:20").time);
 const r=evaluateExitTimeStudy(date,candidate,b);
 assert.equal(r.complete,false);
 assert.equal(r.results[0].complete,false);
});
test("no 09:10 open means none of the exit results are comparable",()=>{
 const b=fullEvidence().filter(x=>x.time!==bar("09:10").time);
 const r=evaluateExitTimeStudy(date,candidate,b);
 assert.equal(r.entryPrice,null);
 assert.ok(r.results.every(x=>x.complete===false));
});
test("later-day bars and previous-day bars never contaminate the date",()=>{
 const b=fullEvidence();
 const wrong={...bar("09:10",900),time:Date.parse("2026-10-20T09:10:00+09:00")/1000};
 b.unshift(wrong);
 assert.equal(evaluateExitTimeStudy(date,candidate,b).entryPrice,100);
});
test("morning gate must have been saved before 09:10 JST, including timezone",()=>{
 assert.equal(morningGateAvailable(date,"2026-10-21T00:09:42Z"),true);
 assert.equal(morningGateAvailable(date,"2026-10-21T09:10:00+09:00"),false);
 assert.equal(morningGateAvailable(date,"2026-10-21T00:10:01Z"),false);
 assert.equal(morningGateAvailable(date,"2026-10-21T09:03:00+09:00"),true);
 assert.equal(morningGateAvailable(date,null),false);
});
function row(){
 return {date,code:"7044",rank:1,priorScore:96.7,priorReferencePrice:100,
   exitTimeStudy:evaluateExitTimeStudy(date,candidate,fullEvidence())};
}
function pair(morningSavedAt="2026-10-21T09:09:50+09:00",closingRow=row()){
 const m=[{trade_date:date,prior_date:"2026-10-20",cohort:[candidate],
   morning_saved_at:morningSavedAt,
   morning_observations:[{code:"7044",label:"BUY_CANDIDATE"}]}];
 const c=[{trade_date:date,prior_date:"2026-10-20",status:"COMPLETE",results:[closingRow]}];
 return pairExitResearch(m,c,"2026-10-22");
}
test("only actual prior-night freeze, matched cohort, morning decision and exit archive qualify",()=>{
 assert.equal(pair().matched.length,1);
 assert.equal(pair("2026-10-21T09:11:00+09:00").matched.length,0);
 assert.equal(pair(undefined,{...row(),priorScore:98}).matched.length,0);
 assert.equal(pair(undefined,{...row(),rank:2}).matched.length,0);
 assert.equal(pair(undefined,{...row(),exitTimeStudy:{complete:false}}).matched.length,0);
});
test("incomplete current-day result cannot be pulled into a past-only leaderboard",()=>{
 const m=[{trade_date:date,prior_date:"2026-10-20",cohort:[candidate],
   morning_saved_at:"2026-10-21T09:09:00+09:00",
   morning_observations:[{code:"7044",label:"BUY_CANDIDATE"}]}];
 const c=[{trade_date:date,prior_date:"2026-10-20",status:"COMPLETE",results:[row()]}];
 assert.equal(pairExitResearch(m,c,date).matched.length,0);
 assert.equal(pairExitResearch(m,c,"2026-10-22").matched.length,1);
});
test("short evidence hides apparent winning exit time and exposes counts only",()=>{
 const {matched}=pair();
 const stats=summarizeExitResearch(matched);
 assert.equal(stats.count,1);
 assert.equal(stats.days,1);
 assert.equal(stats.sufficient,false);
 assert.deepEqual(stats.all.map(x=>x.count),[1,1,1,1]);
 assert.ok(stats.all.every(x=>x.positiveRate===null && x.avgPnl100===null));
 assert.equal(stats.morningOnly,0);
});
test("morning-only rise then closing loss is detected on same stock-day",()=>{
 const full=fullEvidence();
 full.find(x=>x.time===bar("15:25").time).close=98;
 const study=evaluateExitTimeStudy(date,candidate,full);
 assert.equal(study.complete,true);
 const stats=summarizeExitResearch([{date,code:"7044",label:"BUY_CANDIDATE",
  entryPrice:100,exits:study.results}]);
 assert.equal(stats.morningOnly,1);
 assert.equal(stats.nearHighThenLoss,1);
});
