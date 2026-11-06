import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {auditYahooOpeningAsOf,OPENING_SOURCE_AUDIT_VERSION} from
  "../app/lib/research/morningOpeningSourceEvidence.mjs";
import {decideAtNineOhFive} from "../app/lib/research/morningFinalCheck.mjs";
import {summarizeMorningCaptureHealth} from "../app/lib/research/morningCaptureHealth.mjs";

const date="2026-11-06";
const at=t=>new Date(date+"T"+t+"+09:00");
const ts=t=>Math.floor(at(t).getTime()/1000);
const times=["09:00:00","09:05:00","09:10:00"].map(ts);
const quote=()=>({
  open:[100,100.5,200], high:[100.8,500,1000], low:[99.5,1,0.01],
  close:[100.4,1,900],volume:[8000,999999,999999],
});
const response=(overrides={})=>({
  chart:{result:[{timestamp:times,meta:{exchangeTimezoneName:"Asia/Tokyo"},
    indicators:{quote:[quote()]}}]},...overrides,
});
const run=(options={})=>auditYahooOpeningAsOf({
  payload:response(),tradeDate:date,
  requestedAt:at("09:08:01"),receivedAt:at("09:08:03"),
  ...options,
});
const candidate={code:"3762",name:"テクマトリックス",rank:1,score:95,
  referencePrice:100};

test("09:08 source audit uses a sealed first bar and only 09:05 OPEN",()=>{
  const output=run();
  assert.equal(output.evidence.version,OPENING_SOURCE_AUDIT_VERSION);
  assert.equal(output.evidence.status,"AVAILABLE_AS_OF_RECEIPT");
  assert.deepEqual(output.evidence.observedSlots,["09:00","09:05"]);
  assert.equal(output.bars.length,2);
  assert.equal(output.bars[0].volume,8000);
  assert.equal(output.bars[1].open,100.5);
  assert.equal(output.bars[1].close,null);
  assert.equal(output.bars[1].high,null);
  assert.equal(output.bars[1].volume,null);
  assert.equal(output.evidence.executableFillVerified,false);
  assert.equal(output.evidence.officialSourceVerified,false);
  assert.equal(decideAtNineOhFive(candidate,output.bars,date,at("09:08:03")).label,"BUY_CANDIDATE");
});
test("future data in 09:05 high/low/close, 09:10 OHLCV never change current decision",()=>{
  const payload=response();
  payload.chart.result[0].indicators.quote[0].high[1]=999999;
  payload.chart.result[0].indicators.quote[0].low[1]=0;
  payload.chart.result[0].indicators.quote[0].close[1]=0;
  payload.chart.result[0].indicators.quote[0].volume[1]=99999999;
  payload.chart.result[0].indicators.quote[0].open[2]=0;
  const output=run({payload});
  assert.equal(output.bars.length,2);
  assert.equal(output.bars[1].close,null);
  assert.equal(decideAtNineOhFive(candidate,output.bars,date,at("09:08:03")).label,"BUY_CANDIDATE");
});
test("when Yahoo hasn't published 09:05 yet, missing is NOT a skip or buy",()=>{
  const payload=response();
  payload.chart.result[0].timestamp=[times[0]];
  for(const k of Object.keys(payload.chart.result[0].indicators.quote[0])){
    payload.chart.result[0].indicators.quote[0][k]=
      payload.chart.result[0].indicators.quote[0][k].slice(0,1);
  }
  const output=run({payload});
  assert.equal(output.evidence.reason,"MISSING_0905_BAR");
  assert.deepEqual(output.evidence.missingSlots,["09:05"]);
  assert.deepEqual(output.bars,[]);
  assert.equal(decideAtNineOhFive(candidate,output.bars,date,at("09:08:03")).label,"UNAVAILABLE");
});
test("missing 09:00 and both bars have distinct reasons",()=>{
  const q=quote();
  const one=run({payload:{chart:{result:[{
    timestamp:[times[1]],meta:{exchangeTimezoneName:"Asia/Tokyo"},
    indicators:{quote:[Object.fromEntries(Object.entries(q).map(([k,v])=>[k,[v[1]]]))]}
  }]}}});
  assert.equal(one.evidence.reason,"MISSING_0900_BAR");
  const none=run({payload:{chart:{result:[{
    timestamp:[],meta:{exchangeTimezoneName:"Asia/Tokyo"},indicators:{quote:[quote()]}
  }]}}});
  assert.equal(none.evidence.reason,"MISSING_BOTH_OPENING_SLOTS");
});
test("garbled 09:00 OHLCV cannot become a BUY_CANDIDATE",()=>{
  const payload=response();
  payload.chart.result[0].indicators.quote[0].volume[0]=null;
  assert.equal(run({payload}).evidence.reason,"INVALID_0900_OHLCV");
  const payload2=response();
  payload2.chart.result[0].indicators.quote[0].high[0]=99;
  assert.equal(run({payload:payload2}).evidence.reason,"INVALID_0900_OHLCV");
  const payload3=response();
  payload3.chart.result[0].indicators.quote[0].open[1]=null;
  assert.equal(run({payload:payload3}).evidence.reason,"INVALID_0905_OPEN");
});
test("duplicate opening bar is ambiguous, never first or latest wins",()=>{
  const payload=response();
  payload.chart.result[0].timestamp=[times[0],times[0],times[1]];
  assert.equal(run({payload}).evidence.reason,"DUPLICATE_OPENING_SLOTS");
});
test("wrong market timezone is quarantined",()=>{
  const payload=response();
  payload.chart.result[0].meta.exchangeTimezoneName="America/New_York";
  const out=run({payload});
  assert.equal(out.evidence.reason,"UNVERIFIED_EXCHANGE_TIMEZONE");
  assert.equal(out.evidence.status,"UNAVAILABLE");
});
test("after 09:19 cannot retroactively record a 09:08 buying signal",()=>{
  const tooLate=run({receivedAt:at("09:19:02")});
  assert.equal(tooLate.evidence.reason,"OUTSIDE_0908_CAPTURE_WINDOW");
  const early=run({requestedAt:at("09:07:59")});
  assert.equal(early.evidence.reason,"OUTSIDE_0908_CAPTURE_WINDOW");
  const nextDate=run({receivedAt:new Date("2026-11-07T09:08:03+09:00")});
  assert.equal(nextDate.evidence.status,"UNAVAILABLE");
});
test("reversed/invalid timestamps and malformed JSON fail closed",()=>{
  assert.equal(run({requestedAt:at("09:08:10"),receivedAt:at("09:08:03")}).evidence.status,"UNAVAILABLE");
  assert.equal(run({payload:null}).evidence.reason,"UNVERIFIED_EXCHANGE_TIMEZONE");
  assert.equal(run({requestedAt:"2026-11-06T09:08:01",receivedAt:at("09:08:03")}).evidence.status,"UNAVAILABLE");
  assert.throws(()=>run({tradeDate:"2026-11-31"}),/INVALID_TRADE_DATE/);
});
test("a quote with a prior trading-day 09:05 must not be backfilled",()=>{
  const payload=response();
  payload.chart.result[0].timestamp=[ts("09:00:00"),Math.floor(Date.parse("2026-11-05T09:05:00+09:00")/1000)];
  assert.equal(run({payload}).evidence.reason,"MISSING_0905_BAR");
});
test("production runner persists reason and exact source request/receipt without retries or retro edit",()=>{
  const source=readFileSync("app/lib/research/morningFinalCheckRunner.ts","utf8");
  assert.match(source,/auditYahooOpeningAsOf\(\{payload,tradeDate,requestedAt,receivedAt\}\)/);
  assert.match(source,/quoteEvidence:evidence/);
  assert.match(source,/quoteReason:usable\?null:\(evidence.reason\?\?"CLASSIFIER_REJECTED"\)/);
  assert.match(source,/morning_state='PENDING'/);
  assert.match(source,/MORNING_ALREADY_CLAIMED/);
  assert.doesNotMatch(source,/UPDATE public\.daily_stock_results|INSERT INTO public\.paper_trades|sendLine/);
  assert.match(source,/YAHOO_TIMEOUT_MS=8000/);
});

test("dashboard counts both legacy and new precise missing opening slots",()=>{
  const observations=[
    {code:"1001",label:"UNAVAILABLE",quoteReason:"MISSING_CANDLES"},
    {code:"1002",label:"UNAVAILABLE",quoteReason:"MISSING_0900_BAR"},
    {code:"1003",label:"UNAVAILABLE",quoteReason:"MISSING_0905_BAR"},
    {code:"1004",label:"UNAVAILABLE",quoteReason:"MISSING_BOTH_OPENING_SLOTS"},
    {code:"1005",label:"UNAVAILABLE",quoteReason:"INVALID_0900_OHLCV"},
  ];
  const summary=summarizeMorningCaptureHealth([{
    trade_date:"2026-11-06",morning_observations:observations,
  }]);
  assert.equal(summary.slots,5);
  assert.equal(summary.available,0);
  assert.equal(summary.unavailable,5);
  assert.equal(summary.missing,4);
  assert.equal(summary.status,"NO_USABLE_MORNING_DECISIONS");
  assert.equal(summary.reasons.length,5);
});
