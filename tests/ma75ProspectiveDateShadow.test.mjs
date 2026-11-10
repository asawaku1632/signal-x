import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMa75NextDateCohort,verifyMa75NextDateCohort,
 requireMa75ProspectivePolicy}
 from '../app/lib/research/ma75ProspectiveDateCohort.mjs';
import {evaluateMa75ProspectiveDateOutcomes}
 from '../app/lib/research/ma75ProspectiveDateOutcomes.mjs';
const freeze=JSON.parse(readFileSync(new URL(
 '../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url),'utf8'));
const policy=JSON.parse(readFileSync(new URL(
 '../docs/ma75-prospective-20261111-predeclared-policy.json',import.meta.url),'utf8'));
const oldDates=Array.from({length:69},(_,i)=>new Date(
 Date.parse('2026-08-01T00:00:00Z')+i*86400000).toISOString().slice(0,10));
const dates=[...oldDates,...policy.precedingPostfreezeSessions];
const code1='1301',code2='1332';
function proj(date,{historicalIndex=-1,signal=false,
 outcomeIndex=-1,missing=[]}={}){
 return {
  date,completeProviderPagination:true,originalAllListedRows:4400,
  projectedFrozenRows:953,
  audit:{failures:[],rows:freeze.codes.map(code=>{
   const status=missing.includes(code)?'NO_TRADE':'DAILY_BAR';
   let close=100,open=100,high=106,low=95;
   if(code===code2&&historicalIndex===0)close=125;
   if(signal&&code===code1){close=110;high=112}
   if(signal&&code===code2){close=100.1;high=102}
   if(outcomeIndex>=0&&code===code1){
    open=outcomeIndex===0?109:113;
    close=113+outcomeIndex;high=120;low=106;
   }
   if(outcomeIndex>=0&&code===code2){
    open=outcomeIndex===0?100:102;
    close=102+outcomeIndex;high=110;low=98;
   }
   return {code,tradeDate:date,status,bar:status==='DAILY_BAR'?{
    code,tradeDate:date,open,high,low,close,volume:1000
   }:null};
  })}
 };
}
let cache;
function build(){
 if(cache)return cache;
 const priorProjections=dates.map((date,i)=>proj(date,{historicalIndex:i}));
 const signalProjection=proj(policy.signalSession,{signal:true});
 const lock=buildMa75NextDateCohort(freeze,policy,{
  priorDates:dates,priorProjections,signalProjection,
  sourceSha256:'a'.repeat(64),
  lockedAt:'2026-11-11T09:00:00.000Z',
  signalLastReceiptAt:'2026-11-11T08:00:00.000Z'
 });
 const closes=new Map([[code1,110],[code2,100.1]]);
 cache={lock,closes};
 return cache;
}
const result=(n=0,custom={})=>{
 const {lock,closes}=build();
 const sourceByDate=Object.fromEntries(policy.horizonSessions.slice(0,n)
  .map((date,i)=>[date,proj(date,{outcomeIndex:i})]));
 const receiptByDate=Object.fromEntries(policy.horizonSessions.slice(0,n)
  .map(date=>[date,date+'T08:00:00Z']));
 return evaluateMa75ProspectiveDateOutcomes(lock,policy,{
  sourceByDate,receiptByDate,signalCloseByCode:closes,
  now:n?policy.horizonSessions.at(n-1)+'T10:00:00Z':
   '2026-11-11T11:00:00Z',...custom
 });
};
test('Nov10 predeclaration is fixed and original 953 cohort carries only 11/11 signals',()=>{
 assert.equal(requireMa75ProspectivePolicy(policy).length,64);
 const {lock}=build();
 assert.equal(verifyMa75NextDateCohort(lock,policy),true);
 assert.equal(lock.signalDate,'2026-11-11');
 assert.equal(lock.allBreakouts,2);
 assert.equal(lock.risingBreakouts,1);
 assert.equal(lock.nonRisingBreakouts,1);
 assert.deepEqual(lock.candidates.map(x=>x.code),[code1,code2]);
 assert.equal(lock.priorSourceDates.length,75);
 assert.equal(lock.eligibleForTrading,false);
 assert.equal(lock.returnsReadBeforeLock,false);
 assert.equal(lock.validatedForwardOutcomes,0);
});
test('no 11/12 post-signal provider file => both candidates pending, no fake budget winner',()=>{
 const r=result();
 assert.equal(r.originalBreakouts,2);
 assert.equal(r.horizons.session1.groups.allBreakouts.pending,2);
 assert.equal(r.horizons.session3.groups.allBreakouts.pending,2);
 assert.equal(r.horizons.session5.groups.allBreakouts.pending,2);
 assert.equal(r.horizons.session1.budgetUnassignedCodeCount,2);
 assert.equal(r.horizons.session1.groups.budgetEligibleBreakouts.frozenGroupCount,0);
 assert.equal(r.horizons.session5.groups.allBreakouts.meanNetReturnPercent,null);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.eligibleForTrading,false);
});
test('entry-day open determines budget only then; first-day result cannot settle third/fifth sessions',()=>{
 const r=result(1);
 assert.equal(r.horizons.session1.groups.allBreakouts.measured,2);
 assert.equal(r.horizons.session1.groups.risingBreakouts.measured,1);
 assert.equal(r.horizons.session1.groups.nonRisingBreakouts.measured,1);
 assert.equal(r.horizons.session1.groups.budgetEligibleBreakouts.frozenGroupCount,2);
 assert.equal(r.horizons.session3.groups.allBreakouts.pending,2);
 assert.equal(r.horizons.session5.groups.allBreakouts.pending,2);
 assert.equal(r.horizons.session1.groups.allBreakouts.leaveLargestWinnerOutMeanPercent!==null,true);
 assert.equal(r.horizons.session1.groups.allBreakouts.positiveCount,2);
 assert.equal(r.horizons.session1.groups.allBreakouts.leaveLargestLoserOutMeanPercent!==null,true);
});
test('fifth session results require all 5 originals and show outlier sensitivity',()=>{
 const fully=result(5);
 assert.equal(fully.horizons.session1.groups.allBreakouts.measured,2);
 assert.equal(fully.horizons.session3.groups.allBreakouts.measured,2);
 assert.equal(fully.horizons.session5.groups.allBreakouts.measured,2);
 const summary=fully.horizons.session5.groups.budgetEligibleBreakouts;
 assert.equal(summary.frozenGroupCount,2);
 assert.equal(summary.measured,2);
 assert.equal(summary.positiveCount,2);
 assert.equal(summary.largestWinnerCode,code2);
 assert.equal(summary.largestLoserCode,code1);
 assert.notEqual(summary.leaveLargestWinnerOutMeanPercent,null);
 assert.notEqual(summary.leaveLargestLoserOutMeanPercent,null);
 assert.equal(fully.perFrozenCodeHorizon.length,6);
 assert.equal(fully.actualTradeExecutionVerified,false);
 assert.equal(fully.independentlyValidatedForwardWinRate,null);
 assert.equal(fully.networkRequests,0);
 assert.equal(fully.filesWritten,0);
});
test('missing intermediary trading day never becomes an invented 3- or 5-session result',()=>{
 const r=result(5,{
  sourceByDate:Object.fromEntries([0,2,3,4].map(i=>[
   policy.horizonSessions[i],proj(policy.horizonSessions[i],{outcomeIndex:i})
  ])),
  receiptByDate:Object.fromEntries([0,2,3,4].map(i=>[
   policy.horizonSessions[i],policy.horizonSessions[i]+'T08:00:00Z'
  ]))
 });
 assert.equal(r.horizons.session1.groups.allBreakouts.measured,2);
 assert.equal(r.horizons.session3.groups.allBreakouts.pending,2);
 assert.equal(r.horizons.session5.groups.allBreakouts.pending,2);
 assert.equal(r.horizons.session5.groups.budgetEligibleBreakouts.measured,0);
});
test('tampering lock, wrong preentry timing and future dates fail closed',()=>{
 const {lock,closes}=build();
 const altered={...lock,candidates:[{code:'9999',risingMA75:true}]};
 assert.equal(verifyMa75NextDateCohort(altered,policy),false);
 assert.throws(()=>evaluateMa75ProspectiveDateOutcomes(altered,policy,{
  signalCloseByCode:closes
 }),/MA75_NEXT_OUTCOME_INVALID_OR_MUTATED_NEW_DATE_LOCK/);
 const bad={...policy,budgetMaxYen:1000000};
 assert.throws(()=>requireMa75ProspectivePolicy(bad),
  /MA75_NEXT_COHORT_PREDECLARED_POLICY_CHANGED/);
 assert.throws(()=>evaluateMa75ProspectiveDateOutcomes(lock,policy,{
  sourceByDate:{'2026-11-19':proj('2026-11-19')},
  signalCloseByCode:closes
 }),/MA75_NEXT_OUTCOME_FUTURE_OR_NONPREDECLARED_SOURCE_DATE/);
 assert.throws(()=>evaluateMa75ProspectiveDateOutcomes(lock,policy,{
  sourceByDate:{'2026-11-12':proj('2026-11-12')},
  receiptByDate:{'2026-11-12':'2026-11-12T06:00:00Z'},
  signalCloseByCode:closes,now:'2026-11-12T10:00:00Z'
 }),/MA75_NEXT_OUTCOME_SOURCE_RECEIPT_NOT_AFTER_ITS_CLOSE_OR_LOCK/);
});
test('pure prospective study never fetches, writes data, calls notifications, or edits Nov02 cohort',()=>{
 for(const file of ['ma75ProspectiveDateCohort.mjs','ma75ProspectiveDateOutcomes.mjs']){
  const code=readFileSync(new URL('../app/lib/research/'+file,import.meta.url),'utf8');
  const active=code.split('\n').filter(x=>!x.trim().startsWith('*')&&
   !x.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(active,/\bfetch\s*\(|writeFileSync|readFileSync|process\.env|JQUANTS_API_KEY|notificationSend|tradeOrder/);
 }
 const script=readFileSync(new URL('../scripts/research/ma75-next-signal-local.mjs',import.meta.url),'utf8');
 assert.match(script,/--lock-new-cohort/);
 assert.match(script,/flag:'wx'/);
 assert.doesNotMatch(script,/\bfetch\s*\(|\bcreateClient\s*\(|process\.env\.JQUANTS_API_KEY/);
});
