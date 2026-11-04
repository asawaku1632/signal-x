import test from 'node:test';
import assert from 'node:assert/strict';
import {createMa75ForwardManifest} from '../app/lib/research/ma75ForwardProtocol.mjs';
import {replayMa75ForwardBars} from '../app/lib/research/ma75ForwardReplay.mjs';
const manifest=()=>createMa75ForwardManifest({
 frozenAt:'2026-10-31T11:00:00+09:00',firstSignalDate:'2026-11-02',
 cohortCodes:['3762','9984'],selectionPolicy:'Freeze liquid Japanese stocks independent of chart view history',
 source:{provider:'J-Quants',usageRights:'UNVERIFIED',corporateActions:'UNVERIFIED',timestampProvenance:'UNVERIFIED'},
});
const fixture=()=>{
 const start=Date.parse('2026-07-01T00:00:00Z')/1000;
 const candles=Array.from({length:76},(_,i)=>({time:start+i*86400,open:100,high:101,low:99,close:100,volume:1000}));
 const last=75;
 candles[last]={...candles[last],time:Date.parse('2026-11-02T00:00:00Z')/1000,close:105,high:106,volume:2000};
 return {code:'3762',tradeDate:'2026-11-02',timeframe:'1D',candles,
   barClosedAt:'2026-11-02T06:30:00Z',barCapturedAt:'2026-11-02T06:40:00Z',
   featuresCapturedAt:'2026-11-02T06:42:00Z',signalRecordedAt:'2026-11-02T07:00:00Z',
   nextOpenAt:'2026-11-04T00:00:00Z',sourceProvider:'J-Quants'};
};
test('recompute SMA75 and volume from completed bars, never produce future outcome',()=>{
 const r=replayMa75ForwardBars(manifest(),[fixture()]);
 assert.equal(r.accepted,1);
 assert.equal(r.candidates[0].sma75Rising,true);
 assert.equal(r.candidates[0].volumeRatio,2);
 assert.equal(r.candidates[0].variantMatches.BREAKOUT_BOTH,true);
 assert.equal(r.completedFutureOutcomes,0);
 assert.equal(r.outOfSampleWinRate,null);
 assert.equal(r.eligibleForProduction,false);
});
test('future bar supplied with the current signal must be rejected',()=>{
 const sample=fixture();sample.candles.push({...sample.candles.at(-1),time:Date.parse('2026-11-04T00:00:00Z')/1000});
 const r=replayMa75ForwardBars(manifest(),[sample]);
 assert.equal(r.accepted,0);
 assert.equal(r.excluded[0].reason,'MISSING_OR_FUTURE_LAST_BAR');
});
test('historical chosen cohort, duplicate date, invalid split and non-daily rejected',()=>{
 const r=replayMa75ForwardBars(manifest(),[fixture(),fixture()]);
 assert.equal(r.accepted,1);assert.equal(r.excluded[0].reason,'DUPLICATE_CODE_DAY');
 assert.equal(replayMa75ForwardBars(manifest(),[{...fixture(),code:'0000'}]).excluded[0].reason,'NOT_FROZEN_COHORT');
 const split=fixture();split.candles[75]={...split.candles[75],open:300,high:301,low:299,close:300};
 assert.equal(replayMa75ForwardBars(manifest(),[split]).excluded[0].reason,'SPLIT_OR_DISCONTINUITY_UNVERIFIED');
 assert.equal(replayMa75ForwardBars(manifest(),[{...fixture(),timeframe:'5m'}]).excluded[0].reason,'INSUFFICIENT_DAILY_BARS');
});
test('replay rejects late capture and non-breakout instead of fabricating signals',()=>{
 const late={...fixture(),barCapturedAt:'2026-11-18T06:30:00Z',featuresCapturedAt:'2026-11-18T06:40:00Z',signalRecordedAt:'2026-11-18T07:00:00Z'};
 assert.equal(replayMa75ForwardBars(manifest(),[late]).excluded[0].reason,'LOOKAHEAD_OR_LATE_CAPTURE');
 const notCross=fixture();notCross.candles[75]={...notCross.candles[75],close:100,high:101};
 assert.equal(replayMa75ForwardBars(manifest(),[notCross]).excluded[0].reason,'NOT_SMA75_BREAKOUT');
});
