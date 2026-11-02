import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  MORNING_PROBE_POLICY,MORNING_PROBE_SLOTS,probeSlotAt,
  nextHypotheticalBarAfter,evaluateMorningProbe,summarizeMorningProbes
} from "../../app/lib/research/morningProbeShadow.mjs";
import {isTseTradingDate} from "../../app/lib/technicalObservation/tseMarketCalendar.ts";

const day="2026-11-04";
const at=(t)=>new Date(day+"T"+t+":00+09:00");
const candle=(slot,override={})=>({
  time:Math.floor(Date.parse(day+"T"+slot+":00+09:00")/1000),
  open:100,high:102,low:99,close:101,volume:20000,...override,
});
const series=(slots)=>slots.map(slot=>candle(slot));
const make=(params={})=>({
  tradeDate:day,code:"5333",
  requestedAt:at("09:15"),receivedAt:at("09:15"),
  bars:series(["09:00","09:05","09:10"]),...params,
});
test("2026-11-03 is a JPX holiday; 11/04 is a trading session",()=>{
  assert.equal(isTseTradingDate("2026-11-03"),false);
  assert.equal(isTseTradingDate(day),true);
});
test("manual slots are precisely 09:15, 09:20, 09:25, 09:30",()=>{
  assert.deepEqual([...MORNING_PROBE_SLOTS],["09:15","09:20","09:25","09:30"]);
  assert.equal(probeSlotAt(at("09:14")).allowed,false);
  assert.equal(probeSlotAt(at("09:15")).slot,"09:15");
  assert.equal(probeSlotAt(at("09:19")).slot,"09:15");
  assert.equal(probeSlotAt(at("09:20")).slot,"09:20");
  assert.equal(probeSlotAt(at("09:25")).slot,"09:25");
  assert.equal(probeSlotAt(at("09:30")).slot,"09:30");
  assert.equal(probeSlotAt(at("09:35")).allowed,false);
});
test("one observed quote yields only a strictly later hypothetical bar",()=>{
  assert.equal(nextHypotheticalBarAfter(at("09:15")),"09:20");
  assert.equal(nextHypotheticalBarAfter(at("09:19")),"09:20");
  assert.equal(nextHypotheticalBarAfter(at("09:20")),"09:25");
  assert.equal(nextHypotheticalBarAfter(at("09:25")),"09:30");
  assert.equal(nextHypotheticalBarAfter(at("09:30")),"09:35");
  assert.throws(()=>nextHypotheticalBarAfter(at("09:05")),/OUTSIDE_MORNING_PROBE_WINDOW/);
});
test("09:15 observation only includes all CLOSED 09:00/09:05/09:10 candles",()=>{
  const result=evaluateMorningProbe(make());
  assert.equal(result.policy,MORNING_PROBE_POLICY);
  assert.equal(result.status,"AVAILABLE_AS_OF_RECEIPT");
  assert.equal(result.completedBars,3);
  assert.deepEqual(result.observedBars.map(x=>x.slot),["09:00","09:05","09:10"]);
  assert.equal(result.earliestFutureReferenceSlot,"09:20");
  assert.equal(result.sourceStatus,"INDICATIVE_ONLY");
});
test("provisional 09:15 candle cannot enter a 09:15 decision",()=>{
  const a=evaluateMorningProbe(make());
  const b=evaluateMorningProbe(make({bars:[...series(["09:00","09:05","09:10"]),
    candle("09:15",{open:999999,high:999999,close:999999,low:999999,volume:99999})]}));
  assert.deepEqual(a.observedBars,b.observedBars);
  assert.equal(a.status,b.status);
});
test("future-day bars cannot contaminate the previous session",()=>{
  const b=candle("09:10");
  const output=evaluateMorningProbe(make({bars:[candle("09:00"),candle("09:05"),
    {...b,time:Math.floor(Date.parse("2026-11-05T09:10:00+09:00")/1000)}]}));
  assert.equal(output.status,"MISSING_COMPLETED_BARS");
  assert.deepEqual(output.missingSlots,["09:10"]);
});
test("missing 09:05 5-minute OHLC remains missing even after a later quote",()=>{
  const output=evaluateMorningProbe(make({bars:[candle("09:00"),candle("09:10")]}));
  assert.equal(output.status,"MISSING_COMPLETED_BARS");
  assert.deepEqual(output.missingSlots,["09:05"]);
});
test("09:20 requires 09:15 completed bar too, not merely 09:00/05",()=>{
  const partial=evaluateMorningProbe(make({
    requestedAt:at("09:20"),receivedAt:at("09:20"),
    bars:series(["09:00","09:05","09:10"])
  }));
  assert.deepEqual(partial.missingSlots,["09:15"]);
  const complete=evaluateMorningProbe(make({
    requestedAt:at("09:20"),receivedAt:at("09:20"),
    bars:series(["09:00","09:05","09:10","09:15"])
  }));
  assert.equal(complete.status,"AVAILABLE_AS_OF_RECEIPT");
  assert.equal(complete.earliestFutureReferenceSlot,"09:25");
});
test("09:25 and 09:30 each require the progressively completed bars",()=>{
  for(const [slot,required,next] of [["09:25",5,"09:30"],["09:30",6,"09:35"]]){
    const slots=["09:00","09:05","09:10","09:15","09:20","09:25"].slice(0,required);
    const result=evaluateMorningProbe(make({
      requestedAt:at(slot),receivedAt:at(slot),bars:series(slots)
    }));
    assert.equal(result.status,"AVAILABLE_AS_OF_RECEIPT");
    assert.equal(result.completedBars,required);
    assert.equal(result.earliestFutureReferenceSlot,next);
  }
});
test("missing volume/high/low or illogical OHLC cannot be called available",()=>{
  for(const mod of [{volume:null},{high:97},{low:103},{open:null},{close:0}]){
    const output=evaluateMorningProbe(make({bars:[
      candle("09:00"),candle("09:05",mod),candle("09:10")
    ]}));
    assert.equal(output.status,"MISSING_COMPLETED_BARS");
    assert.deepEqual(output.missingSlots,["09:05"]);
  }
});
test("duplicate saved 09:05 bar is ambiguous even when prices agree",()=>{
  const result=evaluateMorningProbe(make({bars:[
    ...series(["09:00","09:05","09:10"]),candle("09:05")
  ]}));
  assert.equal(result.status,"INCONSISTENT_UPSTREAM_BARS");
});
test("unknown exchange timezone is not accepted as TSE 5-minute data",()=>{
  const result=evaluateMorningProbe(make({exchangeTimezone:"America/New_York"}));
  assert.equal(result.status,"UNVERIFIED_EXCHANGE_TIMEZONE");
});
test("fetch crossing from 09:19 to 09:20 does not claim an earlier observation",()=>{
  const result=evaluateMorningProbe(make({
    requestedAt:at("09:19"),receivedAt:at("09:20"),
  }));
  assert.equal(result.status,"OUTSIDE_SLOT_OR_ROLLOVER");
});
test("observation before request or in a closed session is rejected",()=>{
  assert.throws(()=>evaluateMorningProbe(make({
    requestedAt:at("09:20"),receivedAt:at("09:15")
  })),/INVALID_PROBE_TIMESTAMPS/);
  const r=evaluateMorningProbe(make({requestedAt:at("09:08"),receivedAt:at("09:08")}));
  assert.equal(r.status,"OUTSIDE_SLOT_OR_ROLLOVER");
});
test("alpha-coded JPX symbols 590A, 641A and 642A may be probed",()=>{
  for(const code of ["590A","641A","642A"]){
    const r=evaluateMorningProbe(make({code}));
    assert.equal(r.code,code);
    assert.equal(r.status,"AVAILABLE_AS_OF_RECEIPT");
  }
});
test("aggregation reports observation coverage, never win or buy probability",()=>{
  const r=evaluateMorningProbe(make());
  const missing=evaluateMorningProbe(make({code:"8316",bars:[]}));
  const summary=summarizeMorningProbes([r,missing,r]);
  assert.equal(summary.bySlot[0].checks,2);
  assert.equal(summary.bySlot[0].available,1);
  assert.equal(summary.bySlot[0].missing,1);
  assert.equal(summary.excluded,1);
  assert.equal(summary.performanceEvidence,"NONE_NO_CONFIRMED_FILLS");
});
test("owner-only probe route is manual and cannot mutate research history",()=>{
  const route=readFileSync("app/api/admin/morning-probe-shadow/route.ts","utf8");
  const vercel=readFileSync("vercel.json","utf8");
  assert.match(route,/getLearningOwnerSession/);
  assert.match(route,/isTseTradingDate/);
  assert.match(route,/morning_final_check_runs/);
  assert.match(route,/const MAX_CODES=5/);
  assert.match(route,/cache:"no-store"/);
  assert.doesNotMatch(route,/INSERT INTO|UPDATE public|DELETE FROM/);
  assert.doesNotMatch(vercel,/morning-probe-shadow/);
});
