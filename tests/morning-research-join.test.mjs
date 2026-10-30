import test from "node:test";
import assert from "node:assert/strict";
import {joinMorningResearchExports} from "../app/lib/research/morningResearchJoin.mjs";
const feature={code:"9984",tradeDate:"2026-10-27",features:{priorReturnPct:1,priorRangePct:2,priorVolumeRatio:1,aiPower:90},featureAvailableAt:"2026-10-26T15:00:00+09:00"};
test("empty exports fail closed",()=>{
  const r=joinMorningResearchExports([],[]);
  assert.equal(r.accepted,0);
  assert.equal(r.signalEnabled,false);
  assert.equal(r.results?.accepted,0);
});
test("unmatched bar export cannot be joined",()=>{
  const r=joinMorningResearchExports([], [{code:"9984",tradeDate:"2026-10-27"}]);
  assert.equal(r.unmatchedBars,1);
  assert.equal(r.accepted,0);
});
test("duplicate feature keys are excluded",()=>{
  const r=joinMorningResearchExports([feature,feature],[{code:"9984",tradeDate:"2026-10-27"}]);
  assert.equal(r.duplicateKeys,1);
  assert.equal(r.accepted,0);
});
test("daily bars cannot masquerade as intraday outcomes",()=>{
  const r=joinMorningResearchExports([feature],[{code:"9984",tradeDate:"2026-10-27",timeframe:"1D"}]);
  assert.equal(r.accepted,0);
  assert.equal(r.excluded.unverifiedBars,1);
});
test("caller assertion is never independent authentication",()=>{
  const r=joinMorningResearchExports([feature],[],{independentProvenance:true});
  assert.equal(r.independentProvenanceAssertedByCaller,true);
  assert.equal(r.independentlyAuthenticated,false);
  assert.equal(r.bottomTimeDistribution,null);
  assert.equal(r.signalEnabled,false);
});
test("invalid inputs are rejected",()=>{
  assert.throws(()=>joinMorningResearchExports(null,[]));
  assert.throws(()=>joinMorningResearchExports([],null));
});

test("duplicate bar keys are excluded without selecting a preferred copy",()=>{
  const bar={code:"9984",tradeDate:"2026-10-27",timeframe:"1D"};
  const r=joinMorningResearchExports([feature],[bar,{...bar}]);
  assert.equal(r.candidates,0);
  assert.equal(r.duplicateKeys,2);
  assert.equal(r.accepted,0);
  assert.equal(r.signalEnabled,false);
});
test("a valid-looking key cannot bypass required bar provenance",()=>{
  const bar={code:"9984",tradeDate:"2026-10-27",intervalMinutes:5,licenseVerified:true};
  const r=joinMorningResearchExports([feature],[bar]);
  assert.equal(r.candidates,1);
  assert.equal(r.accepted,0);
  assert.equal(r.excluded.unverifiedBars,1);
  assert.equal(r.independentlyAuthenticated,false);
  assert.equal(r.readyForTrading,false);
});

test("complete synthetic morning bars join only with prior-day features and stay shadow-only",()=>{
  const bars=Array.from({length:30},(_,i)=>({
    time:Date.parse("2026-10-27T09:00:00+09:00")/1000+i*300,
    open:100,high:i>8?104:101,low:i===8?90:98,close:100
  }));
  const row={code:"9984",tradeDate:"2026-10-27",previousClose:100,
    intervalMinutes:5,bars,source:"SYNTHETIC_TEST_ONLY",licenseVerified:true,
    timestampSemantics:"BAR_START",exchangeTimezone:"Asia/Tokyo",
    outcomeAvailableAt:"2026-10-27T12:00:00+09:00"};
  const result=joinMorningResearchExports([feature],[row]);
  assert.equal(result.candidates,1);
  assert.equal(result.accepted,1);
  assert.equal(result.results?.accepted,1);
  assert.equal(result.independentlyAuthenticated,false);
  assert.equal(result.bottomTimeDistribution,null);
  assert.equal(result.signalEnabled,false);
  assert.equal(result.readyForTrading,false);
});
