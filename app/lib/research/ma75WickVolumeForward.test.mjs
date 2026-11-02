import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMa75WickVolume, auditMa75FillAndBudget } from './ma75WickVolumeForward.mjs';
const bars=Array.from({length:82},(_,i)=>({
 time: 1700000000+i*86400,open:100,high:103,low:98,close:100,volume:100
}));
bars[75]={...bars[75],open:105,high:120,low:100,close:110,volume:200};
test('qualifying wick and volume use signal day and prior 20 bars only',()=>{
 const a=classifyMa75WickVolume({bars,signalIndex:75,ma75Today:105,ma75Prior:101});
 assert.equal(a.eligible,true);
 assert.equal(a.status,'SHADOW_ONLY');
});
test('future data cannot change signal classification',()=>{
 const first=classifyMa75WickVolume({bars,signalIndex:75,ma75Today:105,ma75Prior:101});
 const changed=bars.map(x=>({...x}));changed[76].close=999;
 assert.deepEqual(classifyMa75WickVolume({bars:changed,signalIndex:75,ma75Today:105,ma75Prior:101}),first);
});
test('flat execution window is unverified',()=>{
 const changed=bars.map(x=>({...x}));changed[76]={...changed[76],open:100,high:100,low:100,close:100};
 const a=auditMa75FillAndBudget({bars:changed,signalIndex:75});
 assert.equal(a.status,'FILL_UNVERIFIED');
 assert.equal(a.fillVerified,false);
});
test('multiple 100-share lots can satisfy budget',()=>{
 const a=auditMa75FillAndBudget({bars,signalIndex:75});
 assert.equal(a.status,'HYPOTHETICAL_ONLY');
 assert.equal(a.budgetEligible,true);
 assert.equal(a.minLots,10);
 assert.equal(a.maxLots,49);
});
test('pending outcomes are not treated as returns',()=>{
 assert.equal(auditMa75FillAndBudget({bars:bars.slice(0,76),signalIndex:75}).status,'PENDING');
});

test('price discontinuity in outcome is quarantined',()=>{
 const changed=bars.map(x=>({...x}));
 changed[77]={...changed[77],open:200,high:205,low:195,close:200};
 assert.equal(auditMa75FillAndBudget({bars:changed,signalIndex:75}).status,'QUARANTINED_PRICE_GAP');
});
test('duplicate signal history timestamp is rejected',()=>{
 const changed=bars.map(x=>({...x}));changed[75].time=changed[74].time;
 assert.equal(classifyMa75WickVolume({bars:changed,signalIndex:75,ma75Today:105,ma75Prior:101}).status,'DUPLICATE_OR_UNSORTED');
});
