import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMa75Nov19RegimeLock,verifyMa75Nov19RegimeLock,
 evaluateMa75Nov19RegimeOutcomes,checkMa75Nov19RegimePolicy}
 from '../app/lib/research/ma75ProspectiveRegimeNov19.mjs';
import {runMa75Nov19Local} from '../scripts/research/ma75-regime-20261119-local.mjs';
const freeze=JSON.parse(readFileSync(new URL('../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url)));
const policy=JSON.parse(readFileSync(new URL('../docs/ma75-regime-20261119-predeclared-policy.json',import.meta.url)));
const dates=[...Array.from({length:74},(_,i)=>new Date(Date.parse('2026-08-01T00:00:00Z')+i*86400000).toISOString().slice(0,10)),'2026-11-18'];
const first=freeze.codes[0],second=freeze.codes[1];
const stamp='2026-11-19T09:00:00.000Z',receipt='2026-11-19T08:00:00.000Z';
function projection(date,{oldest=false,signal=false,missing=[]}={}){
 return {date,completeProviderPagination:true,originalAllListedRows:4449,
  audit:{failures:[],rows:freeze.codes.map(code=>{
    const status=missing.includes(code)?'NO_TRADE':'DAILY_BAR';
    const close=signal&&(code===first||code===second)?110:
     oldest&&code===second?125:100;
    return {code,tradeDate:date,status,bar:status==='DAILY_BAR'?{
     code,tradeDate:date,open:close,high:close+1,low:close-1,
     close,volume:1000}:null};
  })}};
}
let cached=null;
function fix(){
 if(cached)return cached;
 const history=dates.map((date,i)=>projection(date,{oldest:i===0}));
 const signal=projection(policy.signalDate,{signal:true});
 const data={priorDates:dates,priorProjections:history,
  signalProjection:signal,originalsSha256:'a'.repeat(64),
  lockedAt:stamp,signalReceiptAt:receipt};
 const lock=buildMa75Nov19RegimeLock(freeze,policy,data);
 cached={history,signal,data,lock};return cached;
}
test('predeclared Nov19 policy and dry run have no write or network',()=>{
 assert.equal(checkMa75Nov19RegimePolicy(policy).length,64);
 const p=runMa75Nov19Local(['--plan']);
 assert.equal(p.status,'SHADOW_NOT_APPROVED');
 assert.equal(p.filesWritten,0);
 assert.equal(p.networkRequests,0);
 assert.equal(p.lockAlreadyExists,false);
 assert.deepEqual(p.futureSessions,['2026-11-20','2026-11-24','2026-11-25','2026-11-26','2026-11-27']);
});
test('seal genuine new as-of cohort, one up and one non-up SMA, no return leakage',()=>{
 const {lock}=fix();
 assert.equal(verifyMa75Nov19RegimeLock(lock,policy),true);
 assert.equal(lock.allBreakouts,2);
 assert.equal(lock.risingBreakouts,1);
 assert.equal(lock.nonRisingBreakouts,1);
 assert.equal(lock.market.regime,'SIDEWAYS');
 assert.equal(lock.market.validCodes,953);
 assert.equal(lock.candidates.length,2);
 assert.deepEqual(lock.candidates.map(x=>x.code),[first,second]);
 assert.equal(lock.returnsReadBeforeLock,false);
 assert.equal(lock.eligibleForTrading,false);
});
test('late lock, altered original, mutated policy cannot be accepted',()=>{
 const {lock,data}=fix();
 assert.throws(()=>buildMa75Nov19RegimeLock(freeze,policy,
  {...data,lockedAt:'2026-11-20T00:00:00.000Z'}),/PREENTRY_WINDOW/);
 assert.equal(verifyMa75Nov19RegimeLock({...lock,allBreakouts:6},policy),false);
 assert.equal(verifyMa75Nov19RegimeLock(lock,{...policy,regimeThresholdUpPercent:2}),false);
 assert.equal(verifyMa75Nov19RegimeLock(lock,{...policy,claimValidatedEdge:true}),false);
});
test('missing future days stay pending, not invented profit',()=>{
 const {lock,signal}=fix();
 const a=evaluateMa75Nov19RegimeOutcomes(freeze,policy,lock,{
  signalProjection:signal,now:'2026-11-19T10:00:00Z'});
 assert.equal(a.horizons.session5.groups.all.pending,2);
 assert.equal(a.horizons.session5.groups.all.mean,null);
 assert.equal(a.horizons.session1.peer.pending,951);
 assert.equal(a.horizons.session5.signalMinusPeerPoints,null);
 assert.equal(a.eligibleForProduction,false);
});
test('one day completes only horizon 1; 5-session path requires all five files',()=>{
 const {lock,signal}=fix();
 const sourceByDate={};
 for(let i=0;i<5;i++){
  const date=policy.futureSessions[i];
  sourceByDate[date]={projection:projection(date),receivedAt:date+'T08:00:00Z'};
 }
 const base={signalProjection:signal,now:'2026-11-27T10:00:00Z'};
 const one=evaluateMa75Nov19RegimeOutcomes(freeze,policy,lock,{
  ...base,sourceByDate:{[policy.futureSessions[0]]:sourceByDate[policy.futureSessions[0]]}});
 assert.equal(one.horizons.session1.groups.all.measured,2);
 assert.equal(one.horizons.session3.groups.all.pending,2);
 assert.equal(one.horizons.session5.groups.all.pending,2);
 const all=evaluateMa75Nov19RegimeOutcomes(freeze,policy,lock,{...base,sourceByDate});
 assert.equal(all.horizons.session5.groups.all.measured,2);
 assert.equal(all.horizons.session5.peer.measured,951);
 assert.equal(all.horizons.session5.groups.rising.measured,1);
 assert.equal(all.horizons.session5.groups.nonRising.measured,1);
 assert.equal(all.horizons.session5.groups.all.pending,0);
 assert.equal(all.horizons.session5.groups.all.quarantined,0);
 assert.equal(typeof all.horizons.session5.signalMinusPeerPoints,'number');
 assert.equal(all.filesWritten,0);
 assert.equal(all.networkRequests,0);
});
test('rejected wrong-day future, future receipts and unfinished research',()=>{
 const {lock,signal}=fix();
 const base={signalProjection:signal,now:'2026-11-27T10:00:00Z'};
 assert.throws(()=>evaluateMa75Nov19RegimeOutcomes(freeze,policy,lock,{
  ...base,sourceByDate:{'2026-11-23':{projection:projection('2026-11-23'),receivedAt:'2026-11-23T08:00:00Z'}}
 }),/NONPREDECLARED_FUTURE_DAY/);
 assert.throws(()=>evaluateMa75Nov19RegimeOutcomes(freeze,policy,lock,{
  ...base,now:'2026-11-20T10:00:00Z',sourceByDate:{
   '2026-11-20':{projection:projection('2026-11-20'),receivedAt:'2026-11-21T08:00:00Z'}
  }}),/FUTURE_SOURCE_TIMESTAMP_UNTRUSTED/);
});
test('source modules are offline only; never run capture or production actions',()=>{
 for(const name of ['app/lib/research/ma75ProspectiveRegimeNov19.mjs',
  'scripts/research/ma75-regime-20261119-local.mjs']){
  const code=readFileSync(new URL('../'+name,import.meta.url),'utf8');
  assert.doesNotMatch(code,/\bfetch\s*\(|notificationSend|tradeOrder|createClient\s*\(/);
 }
});

test('incomplete non-signal peers stay disclosed; coverage-qualified comparison uses measured only',()=>{
 const {lock,signal}=fix();
 const make=(missing)=>Object.fromEntries(policy.futureSessions.map(date=>
  [date,{projection:projection(date,{missing}),receivedAt:date+'T08:00:00Z'}]));
 const base={signalProjection:signal,now:'2026-11-27T10:00:00Z'};
 const partial=evaluateMa75Nov19RegimeOutcomes(freeze,policy,lock,{
  ...base,sourceByDate:make(freeze.codes.slice(10,40))});
 assert.equal(partial.horizons.session5.groups.all.measured,2);
 assert.equal(partial.horizons.session5.peer.measured,921);
 assert.equal(partial.horizons.session5.peer.pending,30);
 assert.equal(partial.horizons.session5.peerExcludedOrUnsettled,30);
 assert.equal(typeof partial.horizons.session5.signalMinusPeerPoints,'number');
 const sparse=evaluateMa75Nov19RegimeOutcomes(freeze,policy,lock,{
  ...base,sourceByDate:make(freeze.codes.slice(10,310))});
 assert.equal(sparse.horizons.session5.peer.measured,651);
 assert.equal(sparse.horizons.session5.signalMinusPeerPoints,null);
});
