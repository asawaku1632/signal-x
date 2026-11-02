/**
 * RESEARCH ONLY. Compute first post-freeze SMA75 breakout classifications
 * from 75 original archived completed trading sessions plus ONE *already
 * captured* next session. No API, file writes, snapshots, order, scoring,
 * notifications, claimed on-time execution or 5-session outcome.
 *
 * All features use available bars <= signal-date close, but original local
 * receipt timestamps and provider entitlement are NOT independently certified.
 * Even a matching code is a shadow observation, not an actionable buy.
 */
import {validateMa75FrozenUniverse} from './ma75FrozenUniverse.mjs';
export const MA75_FIRST_FORWARD_DAY_VERSION='ma75_first_forward_day_shadow_v1';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const fmt=x=>Number(x.toFixed(4));
const mean=x=>x.reduce((a,b)=>a+b,0)/x.length;
const day=x=>typeof x==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
  new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const fail=code=>{throw new TypeError('MA75_FIRST_FORWARD_'+code)};
const statusRows=(projection,freeze,expectedDate)=>{
 if(projection?.date!==expectedDate||
    projection.completeProviderPagination!==true||
    !Array.isArray(projection.audit?.rows)||
    projection.audit.rows.length!==freeze.codes.length||
    projection.audit.failures?.length!==0)
  fail('INVALID_PROJECTED_DAY');
 const rows=new Map();
 for(const r of projection.audit.rows){
  if(typeof r?.code!=='string'||rows.has(r.code)||!freeze.codes.includes(r.code)||
     typeof r.status!=='string'||r.tradeDate!==expectedDate)
   fail('INVALID_FROZEN_DAY_ROWS');
  if(r.status==='DAILY_BAR'&&
    (!r.bar||r.bar.tradeDate!==expectedDate||r.bar.code!==r.code||
     ![r.bar.open,r.bar.high,r.bar.low,r.bar.close,r.bar.volume].every(finite)||
     r.bar.close<=0||r.bar.volume<=0))
   fail('INVALID_POSITIVE_BAR');
  rows.set(r.code,r);
 }
 if(rows.size!==freeze.codes.length)fail('MISSING_FROZEN_ROWS');
 return rows;
};
export function reviewMa75FirstForwardDay(freeze,{
 priorDates,priorProjections,currentDate,currentProjection
}={}){
 validateMa75FrozenUniverse(freeze);
 if(currentDate!==freeze.firstEligibleSignalDate||
    !Array.isArray(priorDates)||priorDates.length!==75||
    !Array.isArray(priorProjections)||priorProjections.length!==75||
    priorDates.some((d,i)=>!day(d)||(i>0&&d<=priorDates[i-1])||d>=currentDate))
   fail('REQUIRE_FIRST_FROZEN_DATE_AND_SEVENTY_FIVE_ORDERED_PRIOR_SESSIONS');
 const matrix=priorDates.map((date,i)=>statusRows(priorProjections[i],freeze,date));
 const current=statusRows(currentProjection,freeze,currentDate);
 const reasons={},list=[],breakouts=[],rising=[];
 let fullHistory=0,missingHistory=0,missingToday=0,nonBreakout=0,flatOrFalling=0,
  discontinuity=0,ready=0;
 const issue=(code,reason)=>{
  reasons[reason]=(reasons[reason]??0)+1;
  list.push({code,status:'NOT_EVALUABLE',reason});
 };
 for(const code of freeze.codes){
  const historical=matrix.map(dayMap=>dayMap.get(code));
  const bad=historical.find(r=>r.status!=='DAILY_BAR');
  if(bad){
   missingHistory++;
   issue(code,'PRIOR_75_'+bad.status);
   continue;
  }
  fullHistory++;
  const today=current.get(code);
  if(today.status!=='DAILY_BAR'){
   missingToday++;
   issue(code,'CURRENT_'+today.status);
   continue;
  }
  const history=historical.map(r=>r.bar);
  const last=history.at(-1),todayBar=today.bar;
  if(history.some((r,i)=>i>0&&Math.abs(r.close/history[i-1].close-1)>0.45)||
    Math.abs(todayBar.close/last.close-1)>0.45){
   discontinuity++;
   issue(code,'UNVERIFIED_PRICE_DISCONTINUITY');
   continue;
  }
  ready++;
  const previousMA=mean(history.map(r=>r.close));
  const currentMA=mean([...history.slice(1).map(r=>r.close),todayBar.close]);
  const priorVolume=history.slice(-20).map(r=>r.volume);
  const volumeRatio=priorVolume.every(x=>x>0)?todayBar.volume/mean(priorVolume):null;
  if(!(last.close<=previousMA&&todayBar.close>currentMA)){
   nonBreakout++;
   continue;
  }
  const rise=currentMA>previousMA;
  const evidence={code,tradeDate:currentDate,
   sma75Rising:rise,
   historicalVolumeRatio:volumeRatio===null?null:fmt(volumeRatio),
   status:'CLOSE_TIME_SHADOW_PATTERN_ONLY'};
  breakouts.push(evidence);
  if(rise)rising.push(evidence);
  else flatOrFalling++;
 }
 if(list.length+ready!==freeze.codes.length||
    ready!==breakouts.length+nonBreakout||
    breakouts.length!==rising.length+flatOrFalling)
  fail('COUNT_RECONCILIATION');
 return {
  version:MA75_FIRST_FORWARD_DAY_VERSION,
  status:'OFFLINE_SHADOW_PATTERN_REVIEW_ONLY',
  requestedSignalDate:currentDate,
  historicalWarmupFirst:priorDates[0],
  historicalWarmupLast:priorDates.at(-1),
  warmupSessions:75,
  fixedFrozenCodes:freeze.codes.length,
  codesWithCompletePrior75:fullHistory,
  blockedPrior75:missingHistory,
  blockedCurrentDayAmongCompletePrior75:missingToday,
  quarantinedPriceDiscontinuity:discontinuity,
  analyzableCodeCount:ready,
  nonBreakout:nonBreakout,
  allBreakoutShadowCount:breakouts.length,
  risingMa75BreakoutShadowCount:rising.length,
  breakoutWithoutRisingCount:flatOrFalling,
  allBreakoutShadowPatterns:breakouts,
  shadowPatterns:rising,
  reasonCounts:reasons,
  incompleteAndQuarantined:list,
  observedFromReplayedCapturedFiles:true,
  classifiedBeforeAnyOutcomeBars:true,
  snapshotAsOfNextOpenIndependentlyAuthenticated:false,
  independentOfficialSessionCalendarVerified:false,
  providerRightsIndependentlyVerified:false,
  corporateActionsIndependentlyVerified:false,
  return5Percent:null,
  validatedForwardWinRate:null,
  independentForwardOutcomes:0,
  allBreakoutGroupsIncludeUnprofitableCandidates:true,
  eligibleForProduction:false,eligibleForNotifications:false,
  eligibleForTrading:false,eligibleForAIPowerScoring:false,
  note:'Captured daily bars allow an offline pattern calculation, not proof they were available by a tradeable decision time. Do not place orders from this shadow list.'
 };
}
