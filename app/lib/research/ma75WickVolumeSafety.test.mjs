import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMa75PriceHistory as audit,auditMa75SourceAsOf as asof,auditMa75AsOfInputs as ma75} from './ma75WickVolumeSafety.mjs';
const bars=Array.from({length:80},(_,i)=>({time:1700000000+i*86400,open:100,high:105,low:95,close:100,volume:1000}));
const mutate=(i,changes)=>bars.map((b,k)=>k===i?{...b,...changes}:{...b});
test('normal history passes',()=>assert.equal(audit(bars,5,79),'PASS'));
test('price discontinuity quarantined',()=>assert.equal(audit(mutate(40,{open:200,high:210,low:190,close:200}),5,79),'QUARANTINED_PRICE_GAP'));
test('duplicate timestamps rejected',()=>assert.equal(audit(mutate(40,{time:bars[39].time}),5,79),'DUPLICATE_OR_UNSORTED'));
test('invalid OHLC rejected',()=>assert.equal(audit(mutate(40,{high:90}),5,79),'INVALID_OHLCV_OR_TIME'));
test('out of range window rejected',()=>assert.equal(audit(bars,0,80),'INVALID_WINDOW'));
test('self-reported source is not authenticated',()=>assert.equal(asof({source:'yahoo_chart',signalCloseAt:100,entryOpenAt:200,capturedAt:150}),'TIMING_PLAUSIBLE_NOT_AUTHENTICATED'));
test('late capture is offline only',()=>assert.equal(asof({source:'yahoo_chart',signalCloseAt:100,entryOpenAt:200,capturedAt:201}),'LATE_CAPTURE_OFFLINE_ONLY'));
test('premature capture rejected',()=>assert.equal(asof({source:'yahoo_chart',signalCloseAt:100,entryOpenAt:200,capturedAt:99}),'CAPTURE_BEFORE_SIGNAL_CLOSE'));
test('missing source rejected',()=>assert.equal(asof({source:'',signalCloseAt:100,entryOpenAt:200,capturedAt:150}),'PROVENANCE_UNVERIFIED'));

test('extreme opening gap quarantined even if close recovers',()=>assert.equal(audit(mutate(40,{open:200,high:205,low:95,close:100}),5,79),'QUARANTINED_PRICE_GAP'));

test('MA75 as-of matches 75 historical closes',()=>{
 const a=ma75({bars,signalIndex:75,ma75Today:100,ma75Prior:100});
 assert.equal(a.status,'MA75_ASOF_MATCH');assert.equal(a.verified,true);
});
test('MA75 as-of rejects mismatched input',()=>{
 const a=ma75({bars,signalIndex:75,ma75Today:101,ma75Prior:100});
 assert.equal(a.status,'MA75_ASOF_MISMATCH');assert.equal(a.verified,false);
});
test('MA75 as-of is independent of future candles',()=>{
 const changed=bars.map(x=>({...x}));changed[76].close=900;
 assert.deepEqual(ma75({bars:changed,signalIndex:75,ma75Today:100,ma75Prior:100}),
 ma75({bars,signalIndex:75,ma75Today:100,ma75Prior:100}));
});
test('MA75 as-of requires 75 prior closes',()=>{
 assert.equal(ma75({bars,signalIndex:74,ma75Today:100,ma75Prior:100}).verified,false);
});
test('MA75 as-of rejects duplicate timestamps',()=>{
 const changed=mutate(75,{time:bars[74].time});
 assert.equal(ma75({bars:changed,signalIndex:75,ma75Today:100,ma75Prior:100}).status,'DUPLICATE_OR_UNSORTED');
});
