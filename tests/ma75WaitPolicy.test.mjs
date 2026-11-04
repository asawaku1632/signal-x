import test from 'node:test';
import assert from 'node:assert/strict';
import {studyMa75BreakoutRetest} from '../app/lib/research/ma75BreakoutRetest.mjs';
import {auditMa75WaitPolicy} from '../app/lib/research/ma75WaitPolicy.mjs';
const make=(withRetest=true,length=96)=>{
 const c=Array.from({length},(_,i)=>{
   let close=100;
   if(i===75)close=105;
   if(i>75)close=106;
   const op=i===75?100:i===76&&withRetest?101:close;
   return {time:1780000000+i*86400,open:op,close,high:Math.max(op,close)+1,
     low:i===76&&withRetest?99:Math.min(op,close)-.1,volume:1000};
 });
 return {code:'3762',timeframe:'1D',candles:c};
};
const audit=c=>auditMa75WaitPolicy(studyMa75BreakoutRetest([c]),[c]);
test('all matured breakouts count, no-retest means zero-return cash',()=>{
 const r=audit(make(false));
 assert.equal(r.completeOpportunities,1);
 assert.equal(r.waitedInCash,1);
 assert.equal(r.waitedAndTraded,0);
 assert.equal(r.waitAveragePercent,0);
 assert.equal(r.eligibleForProduction,false);
});
test('retest strategy counts a real retest as a traded opportunity',()=>{
 const r=audit(make(true));
 assert.equal(r.completeOpportunities,1);
 assert.equal(r.waitedInCash,0);
 assert.equal(r.waitedAndTraded,1);
 assert.notEqual(r.waitAveragePercent,null);
});
test('short unfinished window remains immature, not 0-percent cash',()=>{
 const r=audit(make(false,85));
 assert.equal(r.completeOpportunities,0);
 assert.equal(r.immature,1);
 assert.equal(r.waitAveragePercent,null);
});
test('duplicate cohort protection',()=>{
 const c=make();
 assert.throws(()=>auditMa75WaitPolicy(studyMa75BreakoutRetest([c]),[c,c]),TypeError);
});

test('future split anywhere in full opportunity window is quarantined',()=>{
 const c=make(false);c.candles[89]={...c.candles[89],close:300,high:301,low:299,open:300};
 const r=audit(c);
 assert.equal(r.completeOpportunities,0);
 assert.equal(r.quarantined,1);
});
