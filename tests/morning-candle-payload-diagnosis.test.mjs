import test from "node:test";
import assert from "node:assert/strict";
import {diagnoseOpeningChartPayload as diagnose, diagnoseOpeningBarClock} from "../app/lib/research/morningCandlePayloadDiagnosis.mjs";
const good={chart:{result:[{timestamp:[1,2],indicators:{quote:[{open:[1,2],high:[2,3],low:[1,2],close:[2,3],volume:[10,20]}]}}]}};
test("metadata checker distinguishes missing chart payload sections",()=>{
 assert.equal(diagnose(null).kind,"INVALID_JSON_SHAPE");
 assert.equal(diagnose({},429).kind,"HTTP_ERROR");
 assert.equal(diagnose({chart:{error:{code:"X"}}}).kind,"CHART_API_ERROR");
 assert.equal(diagnose({chart:{result:[]}}).kind,"MISSING_CHART_RESULT");
 assert.equal(diagnose({chart:{result:[{}]}}).kind,"MISSING_TIMESTAMP_ARRAY");
 assert.equal(diagnose({chart:{result:[{timestamp:[]}]}}).kind,"MISSING_QUOTE_OBJECT");
});
test("malformed and empty arrays remain diagnostically distinct",()=>{
 const base=good.chart.result[0];
 assert.equal(diagnose({chart:{result:[{...base,timestamp:[1]}]}}).kind,"ARRAY_LENGTH_MISMATCH");
 assert.equal(diagnose({chart:{result:[{...base,indicators:{quote:[{...base.indicators.quote[0],volume:null}]}}]}}).kind,"MISSING_QUOTE_FIELDS");
 assert.equal(diagnose({chart:{result:[{timestamp:[],indicators:{quote:[{open:[],high:[],low:[],close:[],volume:[]}]}}]}}).kind,"EMPTY_TIMESTAMPS");
});
test("well shaped bars are not claimed to be independently verified",()=>{
 const r=diagnose(good);
 assert.equal(r.kind,"STRUCTURALLY_PRESENT");
 assert.equal(r.barCount,2);
 assert.equal(r.hasFiveMinuteData,true);
 assert.match(r.note,/neither valid 09:00/);
});

test("opening clock requires same-day 09:00 and 09:05 bar starts",()=>{
 const date="2026-10-30";
 const ts=t=>Math.floor(Date.parse(date+"T"+t+"+09:00")/1000);
 const payload=times=>({chart:{result:[{timestamp:times}]}});
 const missing=diagnoseOpeningBarClock(payload([ts("09:00:00")]),date);
 assert.equal(missing.has0900,true);assert.equal(missing.has0905,false);
 assert.equal(missing.hasOpeningPair,false);
 const good=diagnoseOpeningBarClock(payload([ts("09:00:00"),ts("09:05:00")]),date);
 assert.equal(good.hasOpeningPair,true);assert.equal(good.sourceAuthenticated,false);
 assert.equal(diagnoseOpeningBarClock(payload([ts("09:00:00"),ts("09:05:00")]),"2026-10-29").hasOpeningPair,false);
 assert.equal(diagnoseOpeningBarClock({},date).kind,"NO_BAR_TIMESTAMPS");
});

test("opening bar clock rejects impossible calendar dates instead of silently matching nothing",()=>{
 for(const day of ["2026-02-30","2026-13-01","2026-00-12","not-a-date"])
  assert.throws(()=>diagnoseOpeningBarClock({},day),/INVALID_TRADE_DATE/);
 assert.equal(diagnoseOpeningBarClock({},"2026-02-28").kind,"NO_BAR_TIMESTAMPS");
});
