import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateMa75FrozenHorizonLedger,MA75_FROZEN_SESSIONS}
 from '../app/lib/research/ma75FrozenForwardHorizons.mjs';

const SHA='a'.repeat(64);
const group=[
 ...Array.from({length:24},(_,i)=>String(1400+i)),
 '1878','7172','9832'
].sort();
const compound=new Set(['1878','7172','9832']);
const nonRising=new Set(['1419','1420','1421','1422','1423']);
const dates=MA75_FROZEN_SESSIONS;
const close1=105, open1=100;
const net1=Number((100*(close1*.999/(open1*1.001)-1)).toFixed(4));
const pnl1=Number((100*(close1*.999-open1*1.001)).toFixed(2));
function fixture(){
 const first={
  version:'ma75_first_session_forward_observation_v1',
  status:'SHADOW_NOT_APPROVED',
  frozenCohortSha256:SHA,
  originalCodesRetained:27,risingCodesRetained:22,
  compoundCodesRetained:3,
  firstDayObservedSource:true,
  independentValidatedForwardOutcomes:0,
  return3Percent:null,return5Percent:null,
  productionEligible:false,notificationsEligible:false,
  byFrozenCode:group.map(code=>({
   code,risingMA75:!nonRising.has(code),
   compoundWickVolume:compound.has(code),
   status:'HYPOTHETICAL_FIRST_SESSION_ONLY',
   return1Percent:net1,profitYen100:pnl1,
   firstSessionAdverseLowPercent:-5.0949,
   modeledEntryCostYen100:10010,
   modeledBudgetLots:{eligible:true,minLots:10,maxLots:49}
  }))
 };
 const codes=[...group,
  ...Array.from({length:926},(_,i)=>String(2000+i))];
 const projections=Object.fromEntries(dates.map((date,i)=>[
  date,{
   date,completeProviderPagination:true,
   originalAllListedRows:4400,projectedFrozenRows:953,
   audit:{failures:[],rows:codes.map(code=>({
    code,tradeDate:date,status:'DAILY_BAR',
    bar:{
     tradeDate:date,code,
     open:i===0?100:105,high:110,low:95,close:105,volume:1000
    }
   }))}
  }
 ]));
 const receipts=Object.fromEntries(dates.map(date=>[
  date,date+'T08:00:00Z'
 ]));
 return {first,projections,receipts};
}
const report=(f,n=5,overrides={})=>evaluateMa75FrozenHorizonLedger(
 f.first,{
  originalDayProjections:Object.fromEntries(
   dates.slice(0,n).map(date=>[date,f.projections[date]])),
  sourceReceipts:Object.fromEntries(
   dates.slice(0,n).map(date=>[date,f.receipts[date]])),
  asOf:dates.at(n-1)+'T11:00:00Z',
  expectedFreezeSha256:SHA,expectedOriginalCodes:group,...overrides
 });
test('Nov4 only: preserves full 27/22/3 and never invents 3- and 5-session outcomes',()=>{
 const f=fixture(),r=report(f,1);
 assert.equal(r.status,'SHADOW_NOT_APPROVED');
 assert.equal(r.horizons.session1.groups.allBreakouts.measured,27);
 assert.equal(r.horizons.session1.groups.risingBreakouts.measured,22);
 assert.equal(r.horizons.session1.groups.compoundBreakouts.measured,3);
 assert.equal(r.horizons.session1.groups.risingAndCompound.measured,3);
 assert.equal(r.horizons.session3.groups.allBreakouts.pending,27);
 assert.equal(r.horizons.session5.groups.allBreakouts.pending,27);
 assert.equal(r.horizons.session3.groups.compoundBreakouts.measured,0);
 assert.equal(r.horizons.session5.groups.compoundBreakouts.meanNetReturnPercent,null);
 assert.equal(r.horizons.session1.groups.allBreakouts.meanNetReturnPercent,net1);
 assert.equal(r.perFrozenCodeHorizon.length,81);
 assert.equal(r.inputOriginalDays.length,1);
 assert.equal(r.independentValidatedForwardOutcomes,0);
 assert.equal(r.eligibleForTrading,false);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.eligibleForAIPowerScoring,false);
 assert.equal(r.filesWritten,0);
 assert.equal(r.networkRequests,0);
});
test('third session requires both Nov5 and Nov6; fifth requires Nov9 and Nov10 too',()=>{
 const f=fixture();
 const r=report(f,3);
 assert.equal(r.horizons.session1.groups.allBreakouts.measured,27);
 assert.equal(r.horizons.session3.groups.allBreakouts.measured,27);
 assert.equal(r.horizons.session3.groups.compoundBreakouts.measured,3);
 assert.equal(r.horizons.session5.groups.allBreakouts.measured,0);
 assert.equal(r.horizons.session5.groups.allBreakouts.pending,27);
 assert.deepEqual(r.horizons.session5.sourceDatesRequired,dates);
 assert.equal(r.horizons.session3.completeOriginalSourcesPresent,true);
 const whole=report(f,5);
 assert.equal(whole.horizons.session5.groups.allBreakouts.measured,27);
 assert.equal(whole.horizons.session5.groups.risingBreakouts.measured,22);
 assert.equal(whole.horizons.session5.groups.compoundBreakouts.measured,3);
 assert.equal(whole.horizons.session5.groups.allBreakouts.meanNetReturnPercent,net1);
 assert.deepEqual(whole.horizons.session5.groups.allBreakouts.additionalRoundTripFrictionSensitivity,
  [0,0.1,0.2,0.4].map(x=>({
   extraRoundTripPercent:x,meanNetReturnPercentApprox:Number((net1-x).toFixed(4))
  })));
 assert.equal(whole.horizons.session5.groups.allBreakouts.budgetEligibleMeasured,27);
 assert.equal(whole.modelIsRetrospectiveNotTradeable,true);
});
test('a missing intermediary source never turns a 5-day result into a fabricated return',()=>{
 const f=fixture();
 const {projections,receipts}=f;
 const incomplete=Object.fromEntries(dates.filter(d=>d!=='2026-11-05')
  .map(d=>[d,projections[d]]));
 const partialReceipts=Object.fromEntries(dates.filter(d=>d!=='2026-11-05')
  .map(d=>[d,receipts[d]]));
 const result=report(f,5,{originalDayProjections:incomplete,
  sourceReceipts:partialReceipts});
 assert.equal(result.horizons.session3.groups.allBreakouts.pending,27);
 assert.equal(result.horizons.session5.groups.allBreakouts.pending,27);
 assert.equal(result.horizons.session5.groups.allBreakouts.meanNetReturnPercent,null);
 assert.equal(result.perFrozenCodeHorizon.some(x=>x.horizonSessions===5&&
  x.netReturnPercent!==null),false);
});
test('corporate action, no trade, and anomalous >45% price jump quarantine or postpone without deleting IDs',()=>{
 const f=fixture();
 const rows=f.projections['2026-11-05'].audit.rows;
 const c1=rows.find(x=>x.code==='1878');
 c1.status='CORPORATE_ACTION_REVIEW';c1.bar=null;
 const c2=rows.find(x=>x.code==='7172');
 c2.status='NO_TRADE';c2.bar=null;
 const c3=rows.find(x=>x.code==='9832');
 c3.bar={...c3.bar,open:180,high:185,low:99,close:105};
 const r=report(f,5);
 assert.equal(r.horizons.session1.groups.compoundBreakouts.measured,3);
 assert.equal(r.horizons.session3.groups.compoundBreakouts.measured,0);
 assert.equal(r.horizons.session3.groups.compoundBreakouts.pending,1);
 assert.equal(r.horizons.session3.groups.compoundBreakouts.quarantined,2);
 assert.equal(r.horizons.session5.groups.allBreakouts.cohortCount,27);
 const recs=r.perFrozenCodeHorizon.filter(x=>x.horizonSessions===3);
 assert.equal(recs.find(x=>x.code==='1878').status,
  'QUARANTINED_CORPORATE_ACTION_REVIEW');
 assert.equal(recs.find(x=>x.code==='7172').status,
  'PENDING_REQUIRED_ORIGINAL_DAYS');
 assert.equal(recs.find(x=>x.code==='9832').status,
  'QUARANTINED_UNVERIFIED_INTERSESSION_PRICE_GAP');
 assert.equal(recs.find(x=>x.code==='1878').netReturnPercent,null);
});
test('cannot mix future dates, mistimed vendor receipts, duplicated source codes or amended first-day outcome',()=>{
 const f=fixture();
 assert.throws(()=>report(f,1,{
  originalDayProjections:{...f.projections,
   '2026-11-11':f.projections['2026-11-10']}
 }),/MA75_FROZEN_HORIZONS_NON_PREDECLARED_OR_FUTURE_DAY/);
 assert.throws(()=>report(f,2,{asOf:'2026-11-04T08:00:00Z'}),
  /MA75_FROZEN_HORIZONS_RECEIPT_OUTSIDE_POSTCLOSE_OR_ASOF/);
 const dup=fixture(),rows=dup.projections['2026-11-04'].audit.rows;
 rows[952]={...rows[0]};
 assert.throws(()=>report(dup,1),
  /MA75_FROZEN_HORIZONS_INVALID_DUPLICATE_OR_FUTURE_ORIGINAL_ROW/);
 const changed=fixture();
 changed.projections['2026-11-04'].audit.rows.find(x=>x.code==='1878').bar.close=99;
 assert.throws(()=>report(changed,1),
  /MA75_FROZEN_HORIZONS_FIRST_SESSION_SOURCE_OR_RETURN_CHANGED/);
 const member=fixture();
 member.first.byFrozenCode[0].code='9999';
 assert.throws(()=>report(member,1),
  /MA75_FROZEN_HORIZONS_FROZEN_GROUP_MEMBERSHIP_CHANGED/);
});
test('pure horizon code never invokes provider, sends notifications, or writes a snapshot',()=>{
 const raw=readFileSync(new URL(
  '../app/lib/research/ma75FrozenForwardHorizons.mjs',import.meta.url),'utf8');
 const executable=raw.split('\n').filter(s=>!s.trim().startsWith('*')&&
  !s.trim().startsWith('//')).join('\n');
 assert.doesNotMatch(executable,/\bfetch\s*\(|readFileSync|writeFileSync|process\.env|JQUANTS_API_KEY|broker|notificationSend/);
 assert.match(raw,/SHADOW_NOT_APPROVED/);
 assert.match(raw,/validatedForwardWinRate:null/);
});
