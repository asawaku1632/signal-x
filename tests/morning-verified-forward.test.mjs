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
  assert.equal(prepared.rows.length,0);
  assert.deepEqual(prepared.excluded,{unverifiedBars:1,missingFeatureProof:1,missingOutcomeProof:1,duplicate:2});
});

test("duplicate export order never selects a favorable row",()=>{
  const original=makeInput("2026-10-27");
  const changed={...original,features:{...original.features,aiPower:99}};
  for(const inputs of [[original,changed],[changed,original]]){
    const result=prepareMorningForwardRows(inputs);
    assert.equal(result.rows.length,0);
    assert.equal(result.excluded.duplicate,2);
  }
});
test("timestamps require full offset-aware ISO syntax",()=>{
  const original=makeInput("2026-10-27");
  for(const featureAvailableAt of ["2026-10-26","garbageZ","2026-10-26T18:00:00"]){
    const result=prepareMorningForwardRows([{...original,featureAvailableAt}]);
    assert.equal(result.rows.length,0);
    assert.equal(result.excluded.missingFeatureProof,1);
  }
});

test("source claims are not independent authentication",()=>{
  const prepared=prepareMorningForwardRows([makeInput("2026-10-27")]);
  assert.equal(prepared.rows.length,1);
  assert.equal(prepared.sourceMetadataAssertedByInput,true);
  assert.equal(prepared.independentlyAuthenticated,false);
  assert.equal(prepared.signalEnabled,false);
});
test("outcome timestamps reject missing offsets and dates before the session ends",()=>{
  const original=makeInput("2026-10-27");
  for(const outcomeAvailableAt of [
    "2026-10-27T12:00:00","2026-10-27",
    "2026-10-27T11:29:59+09:00"
  ]){
    const prepared=prepareMorningForwardRows([{...original,outcomeAvailableAt}]);
    assert.equal(prepared.rows.length,0);
    assert.equal(prepared.excluded.missingOutcomeProof,1);
  }
});

test("invalid duplicate cannot silently leave a favorable valid stock-day",()=>{
  const original=makeInput("2026-10-27");
  const invalid={...original,licenseVerified:false};
  for(const inputs of [[original,invalid],[invalid,original]]){
    const prepared=prepareMorningForwardRows(inputs);
    assert.equal(prepared.rows.length,0);
    assert.equal(prepared.excluded.duplicate,2);
    assert.equal(prepared.excluded.unverifiedBars,0);
  }
});

test("duplicate dates use actual ISO date syntax, not escaped regex literals",()=>{
  const input=makeInput("2026-10-27");
  const invalid={...input,licenseVerified:false};
  const result=prepareMorningForwardRows([input,invalid]);
  assert.equal(result.rows.length,0);
  assert.equal(result.excluded.duplicate,2);
});

test("impossible calendar dates and clock values cannot prove feature availability",()=>{
  const original=makeInput("2026-10-27");
  for(const featureAvailableAt of [
    "2026-02-30T18:00:00+09:00",
    "2026-10-26T24:00:00+09:00",
    "2026-10-26T18:60:00+09:00",
    "2026-10-26T18:00:60+09:00",
    "2026-10-26T18:00:00+24:00"
  ]){
    const result=prepareMorningForwardRows([{...original,featureAvailableAt}]);
    assert.equal(result.rows.length,0,featureAvailableAt);
    assert.equal(result.excluded.missingFeatureProof,1,featureAvailableAt);
  }
});

test("very early ISO years do not establish feature availability",()=>{
  const row=makeInput("2026-10-27");
  const report=prepareMorningForwardRows([{...row,featureAvailableAt:"0099-10-26T18:00:00+09:00"}]);
  assert.equal(report.rows.length,0);
  assert.equal(report.excluded.missingFeatureProof,1);
});

test("valid leap-day publication is accepted when earlier than target trade date",()=>{
  const original=makeInput("2026-10-27");
  const result=prepareMorningForwardRows([{
    ...original,featureAvailableAt:"2024-02-29T18:00:00+09:00"
  }]);
  assert.equal(result.rows.length,1);
  assert.equal(result.excluded.missingFeatureProof,0);
});
test("invalid non-leap-day publication is rejected",()=>{
  const original=makeInput("2026-10-27");
  const result=prepareMorningForwardRows([{
    ...original,featureAvailableAt:"2025-02-29T18:00:00+09:00"
  }]);
  assert.equal(result.rows.length,0);
  assert.equal(result.excluded.missingFeatureProof,1);
});
