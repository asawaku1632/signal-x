import test from "node:test";
import assert from "node:assert/strict";
import {prepareMorningForwardRows,auditVerifiedMorningExports} from "../app/lib/research/morningVerifiedForward.mjs";
const makeInput=(date,code="1234",prior="2026-10-26")=>({
  code,tradeDate:date,previousClose:100,intervalMinutes:5,
  bars:Array.from({length:30},(_,i)=>({
    time:Date.parse(date+"T09:00:00+09:00")/1000+i*300,
    open:100,high:i>8?104:101,low:i===8?90:98,close:100
  })),source:"TEST_FIXTURE",licenseVerified:true,
  timestampSemantics:"BAR_START",exchangeTimezone:"Asia/Tokyo",
  features:{priorReturnPct:-1,priorRangePct:2,priorVolumeRatio:1.2,aiPower:90},
  featureAvailableAt:prior+"T18:00:00+09:00",
  outcomeAvailableAt:date+"T12:00:00+09:00"
});
test("verified exports feed chronological audit without external writes",()=>{
  const rows=[makeInput("2026-10-27"),makeInput("2026-10-28","1234","2026-10-27")];
  const report=auditVerifiedMorningExports(rows,{minSamples:1});
  assert.equal(report.accepted,2);
  assert.equal(report.audit.targets,2);
  assert.equal(report.audit.rebound1pct.evaluated,1);
  assert.equal(report.readyForTrading,false);
});
test("export bridge rejects missing evidence and duplicates",()=>{
  const valid=makeInput("2026-10-27");
  const prepared=prepareMorningForwardRows([
    valid,{...valid},{...valid,code:"5678",licenseVerified:false},
    {...valid,code:"9012",featureAvailableAt:"2026-10-27T09:00:00+09:00"},
    {...valid,code:"3456",outcomeAvailableAt:"2026-10-27T09:00:00+09:00"}
  ]);
  assert.equal(prepared.rows.length,1);
  assert.deepEqual(prepared.excluded,{unverifiedBars:1,missingFeatureProof:1,missingOutcomeProof:1,duplicate:1});
});
