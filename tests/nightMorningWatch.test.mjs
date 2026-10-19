import test from "node:test";
import assert from "node:assert/strict";
import {
  nightMorningTradingDates,scoreBand,buildNightMorningCandidates,
  summarizeNightMorningEvidence,NIGHT_MORNING_MIN_SAMPLES,NIGHT_MORNING_MIN_DAYS
} from "../app/lib/research/nightMorningWatch.mjs";
import {ENTRY_TIME_SLOTS} from "../app/lib/research/entryTimeShadow.mjs";

const weekday=day=>![0,6].includes(new Date(day+"T00:00:00Z").getUTCDay());
const localTime=dayAndTime=>new Date(dayAndTime+"+09:00");
const stock=(code,score)=>({code,name:code,score,price:100});
function record(date,code,score,pnl,complete=true) {
  return {date,code,priorScore:score,complete,entries:ENTRY_TIME_SLOTS.map(time=>
    ({time,entryPrice:100,pnl100:time==="09:05"?pnl:0}))};
}
test("night cutoff is at 18:00 JST, morning keeps the prior session",()=>{
  assert.deepEqual(nightMorningTradingDates(localTime("2026-10-20T06:12:00"),weekday),
    {sourceDate:"2026-10-19",tradeDate:"2026-10-20"});
  assert.deepEqual(nightMorningTradingDates(localTime("2026-10-20T17:59:00"),weekday),
    {sourceDate:"2026-10-19",tradeDate:"2026-10-20"});
  assert.deepEqual(nightMorningTradingDates(localTime("2026-10-20T18:00:00"),weekday),
    {sourceDate:"2026-10-20",tradeDate:"2026-10-21"});
  assert.deepEqual(nightMorningTradingDates(localTime("2026-10-24T20:00:00"),weekday),
    {sourceDate:"2026-10-23",tradeDate:"2026-10-26"});
});
test("saved prior-day AI selection ignores outcomes and rejects invalid rows",()=>{
  const items=[stock("7203",85),stock("9984",99),stock("8306",92),
    stock("9999",100),stock("1111",88),stock("2222",89),stock("4444",101),
    {...stock("3333",95),price:0}];
  const selected=buildNightMorningCandidates(items);
  assert.deepEqual(selected.map(s=>s.code),["9999","9984","8306","2222","1111"]);
  assert.equal(scoreBand(85),"85–89");
  assert.equal(scoreBand(94),"90–94");
  assert.equal(scoreBand(95),"95–100");
  assert.equal(scoreBand(101),null);
});
test("small cohorts never display a projected win percentage",()=>{
  const summary=summarizeNightMorningEvidence([
    {trade_date:"2026-10-19",results:[record("2026-10-19","1111",92,200)]}
  ],"2026-10-20");
  const band=summary.find(s=>s.band==="90–94");
  assert.equal(band.count,1);
  assert.equal(band.observedPositiveRate,null);
  assert.equal(band.sufficient,false);
});
test("historical evidence uses only prior complete unique stock-days, not future outcomes",()=>{
  assert.equal(NIGHT_MORNING_MIN_SAMPLES,30);
  assert.equal(NIGHT_MORNING_MIN_DAYS,10);
  const runs=[];
  for(let day=1;day<=10;day++){
    const date="2026-10-"+String(day).padStart(2,"0");
    runs.push({trade_date:date,results:Array.from({length:3},(_,i)=>{
      const code=String(1000+(day-1)*3+i);
      return record(date,code,96,(day+i)%3===0?-100:200);
    })});
  }
  runs.push({trade_date:"2026-10-20",results:[record("2026-10-20","9999",96,100000)]});
  runs.push({trade_date:"2026-10-19",results:[record("2026-10-19","1234",91,200,false)]});
  runs.push({trade_date:"2026-10-01",results:[record("2026-10-01","1000",96,999999)]});
  const band=summarizeNightMorningEvidence(runs,"2026-10-20").find(s=>s.band==="95–100");
  assert.equal(band.count,30);
  assert.equal(band.days,10);
  assert.equal(band.sufficient,true);
  assert.equal(band.wins,20);
  assert.ok(Math.abs(band.observedPositiveRate-66.6666666667)<0.001);
});
test("stale source days are not substituted if the selected day's archive is missing",()=>{
  // Pure policy gives an exact source date; database callers must query THAT
  // date. There is intentionally no most-recent-available-day fallback.
  const {sourceDate}=nightMorningTradingDates(localTime("2026-10-20T19:00:00"),weekday);
  assert.equal(sourceDate,"2026-10-20");
  assert.deepEqual(buildNightMorningCandidates([]),[]);
});
