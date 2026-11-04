/**
 * Pure, read-only, SHADOW_NOT_APPROVED Nov2 cohort / Nov4-entry
 * 1/3/5-session retrospective horizon ledger. No API, writes or orders.
 * Requires all intermediary original daily records through the horizon;
 * later dates and unavailable provider source cannot be estimated.
 */
export const MA75_FROZEN_HORIZONS_VERSION='ma75_frozen_first_135_session_outcomes_v1';
export const MA75_FROZEN_SESSIONS=Object.freeze([
 '2026-11-04','2026-11-05','2026-11-06','2026-11-09','2026-11-10'
]);
const HORIZONS=Object.freeze([1,3,5]);
const SIDES=0.001;
const fail=k=>{throw new TypeError('MA75_FROZEN_HORIZONS_'+k)};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=(x,d=4)=>Number(x.toFixed(d));
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const summarize=items=>{
 const completed=items.filter(x=>x.status==='HYPOTHETICAL_HORIZON_ONLY');
 const returns=completed.map(x=>x.netReturnPercent).sort((a,b)=>a-b);
 const n=returns.length;
 const result={cohortCount:items.length,measured:n,
  pending:items.filter(x=>x.status.startsWith('PENDING_')).length,
  quarantined:items.filter(x=>x.status.startsWith('QUARANTINED_')).length,
  meanNetReturnPercent:null,medianNetReturnPercent:null,
  positiveRatePercent:null,meanProfitYen100:null,
  medianWorstLowPercent:null,
  budgetEligibleMeasured:completed.filter(x=>x.budgetEligible===true).length,
  additionalRoundTripFrictionSensitivity:null};
 if(n){
  const adverse=completed.map(x=>x.worstObservedLowPercent).sort((a,b)=>a-b);
  result.meanNetReturnPercent=round(mean(returns));
  result.medianNetReturnPercent=n%2?returns[(n-1)/2]:
   round((returns[n/2-1]+returns[n/2])/2);
  result.positiveRatePercent=round(100*returns.filter(x=>x>0).length/n,2);
  result.meanProfitYen100=round(mean(completed.map(x=>x.profitYen100)),2);
  result.medianWorstLowPercent=n%2?adverse[(n-1)/2]:
   round((adverse[n/2-1]+adverse[n/2])/2);
  result.additionalRoundTripFrictionSensitivity=[
   0,0.1,0.2,0.4
  ].map(extra=>({extraRoundTripPercent:extra,
   meanNetReturnPercentApprox:round(result.meanNetReturnPercent-extra)}));
 }
 return result;
};
const validDayProjection=(date,project)=>{
 if(project?.date!==date||project.completeProviderPagination!==true||
    project.audit?.failures?.length!==0||
    !Array.isArray(project.audit?.rows)||
    project.audit.rows.length!==953||
    !Number.isSafeInteger(project.originalAllListedRows)||
    project.originalAllListedRows<953||
    project.projectedFrozenRows<0||project.projectedFrozenRows>953)
  fail('INVALID_OR_UNVERIFIED_ORIGINAL_DAY_PROJECTION');
 const map=new Map();
 for(const row of project.audit.rows){
  if(typeof row?.code!=='string'||map.has(row.code)||
     row.tradeDate!==date||typeof row.status!=='string')
   fail('INVALID_DUPLICATE_OR_FUTURE_ORIGINAL_ROW');
  map.set(row.code,row);
 }
 if(map.size!==953)fail('MISSING_ORIGINAL_FROZEN_ROWS');
 return map;
};
const validBar=(b,date,code)=>b&&b.tradeDate===date&&b.code===code&&
 [b.open,b.high,b.low,b.close,b.volume].every(finite)&&
 b.open>0&&b.high>0&&b.low>0&&b.close>0&&b.volume>0&&
 b.high>Math.max(b.low,0)&&b.high>=Math.max(b.open,b.close)&&
 b.low<=Math.min(b.open,b.close);
const group=rows=>({
 allBreakouts:summarize(rows),
 risingBreakouts:summarize(rows.filter(x=>x.risingMA75===true)),
 compoundBreakouts:summarize(rows.filter(x=>x.compoundWickVolume===true)),
 risingAndCompound:summarize(rows.filter(x=>x.risingMA75&&x.compoundWickVolume))
});
export function evaluateMa75FrozenHorizonLedger(first,{
 originalDayProjections={},sourceReceipts={},asOf='2026-11-04T00:00:00.000Z',
 expectedOriginalCodes,expectedFreezeSha256
}={}){
 if(!first||first.version!=='ma75_first_session_forward_observation_v1'||
    first.status!=='SHADOW_NOT_APPROVED'||
    first.originalCodesRetained!==27||
    first.risingCodesRetained!==22||
    first.compoundCodesRetained!==3||
    first.frozenCohortSha256!==expectedFreezeSha256||
    typeof expectedFreezeSha256!=='string'||
    !/^[0-9a-f]{64}$/.test(expectedFreezeSha256)||
    !Array.isArray(first.byFrozenCode)||first.byFrozenCode.length!==27||
    first.return3Percent!==null||first.return5Percent!==null||
    first.independentValidatedForwardOutcomes!==0||
    first.productionEligible!==false||first.notificationsEligible!==false)
  fail('FIRST_SESSION_ORIGINAL_COHORT_INVALID');
 const codes=new Set(),comp=[];
 for(const row of first.byFrozenCode){
  if(typeof row?.code!=='string'||codes.has(row.code)||
     typeof row.risingMA75!=='boolean'||
     typeof row.compoundWickVolume!=='boolean'||
     !/^(HYPOTHETICAL_FIRST_SESSION_ONLY|PENDING_[A-Z_]+|QUARANTINED_[A-Z_]+)$/.test(row.status))
   fail('DUPLICATED_OR_INVALID_FIRST_SESSION_ROW');
  codes.add(row.code);
  if(row.compoundWickVolume)comp.push(row.code);
 }
 const expectedCodes=Array.isArray(expectedOriginalCodes)?
  [...expectedOriginalCodes].sort():null;
 const currentCodes=[...codes].sort();
 if(!expectedCodes||expectedCodes.length!==27||
    new Set(expectedCodes).size!==27||
    expectedCodes.some((code,i)=>code!==currentCodes[i]))
  fail('FROZEN_GROUP_MEMBERSHIP_CHANGED');
 if(first.byFrozenCode.filter(x=>x.risingMA75).length!==22||
    comp.sort().join(',')!=='1878,7172,9832'||
    comp.some(code=>!first.byFrozenCode.find(x=>x.code===code)?.risingMA75))
  fail('FROZEN_GROUP_MEMBERSHIP_CHANGED');
 const instant=Date.parse(asOf);
 if(!Number.isFinite(instant))fail('INVALID_EVALUATION_CLOCK');
 const allowed=new Set(MA75_FROZEN_SESSIONS);
 if(Object.keys(originalDayProjections).some(date=>!allowed.has(date))||
    Object.keys(sourceReceipts).some(date=>!allowed.has(date)))
  fail('NON_PREDECLARED_OR_FUTURE_DAY');
 const maps=new Map();
 for(const date of MA75_FROZEN_SESSIONS){
  const day=originalDayProjections[date];
  if(day===undefined||day===null)continue;
  const receipt=Date.parse(sourceReceipts[date]);
  if(!Number.isFinite(receipt)||
     receipt<Date.parse(date+'T07:30:00Z')||receipt>instant||
     instant<Date.parse(date+'T07:30:00Z'))
   fail('RECEIPT_OUTSIDE_POSTCLOSE_OR_ASOF');
  maps.set(date,validDayProjection(date,day));
 }
 // The first-session reader already reconciles the original Nov4 source
 // and the Nov2 freeze. This ledger must see exactly that same Nov4 source
 // before settling any later horizon.
 if(first.firstDayObservedSource&&!maps.has('2026-11-04'))
  fail('MISSING_RECONCILED_FIRST_SESSION_SOURCE');
 const rows=[],overview={};
 for(const horizon of HORIZONS){
  const days=MA75_FROZEN_SESSIONS.slice(0,horizon);
  const records=[];
  for(const initial of first.byFrozenCode){
   let status='PENDING_REQUIRED_ORIGINAL_DAYS',reason=status;
   let net=null,pnl=null,low=null,priceBudget=null;
   const entry=initial.modeledEntryCostYen100;
   if(initial.status!=='HYPOTHETICAL_FIRST_SESSION_ONLY'){
    status=initial.status.startsWith('PENDING_')?
     'PENDING_FIRST_SESSION_ORIGINAL':'QUARANTINED_FIRST_SESSION_ORIGINAL';
    reason=status;
   }else if(!finite(entry)||entry<=0||
     !finite(initial.return1Percent)||
     !finite(initial.profitYen100)){
    fail('INVALID_FIRST_SESSION_ENTRY_PRICE');
   }else{
    const bars=[],missing=[];
    let invalid=null,prevClose=null;
    for(const date of days){
     const map=maps.get(date);
     if(!map){missing.push(date);continue}
     const row=map.get(initial.code);
     if(!row||row.status!=='DAILY_BAR'){
      if(row?.status==='NO_TRADE'||row?.status==='MISSING_PROVIDER_ROW')
       missing.push(date);
      else invalid='QUARANTINED_'+(row?.status??'MISSING_CODE');
      continue;
     }
     const b=row.bar;
     if(!validBar(b,date,initial.code)){
      invalid='QUARANTINED_INVALID_ORIGINAL_OHLCV';continue;
     }
     if(prevClose!==null&&
       (Math.abs(b.open/prevClose-1)>0.45||
        Math.abs(b.close/prevClose-1)>0.45)){
      invalid='QUARANTINED_UNVERIFIED_INTERSESSION_PRICE_GAP';
     }
     prevClose=b.close;
     bars.push(b);
    }
    if(invalid){
     status=invalid;reason=invalid;
    }else if(missing.length){
     status='PENDING_REQUIRED_ORIGINAL_DAYS';reason=status;
    }else if(bars.length!==horizon){
     status='QUARANTINED_SOURCE_SEQUENCE_INCOMPLETE';reason=status;
    }else{
     const day1=bars[0];
     const entryOpen=entry/(100*(1+SIDES));
     const check=100*(day1.close*(1-SIDES)/
       (entryOpen*(1+SIDES))-1);
     if(Math.abs(check-initial.return1Percent)>0.00012||
       Math.abs((100*(day1.close*(1-SIDES)-entryOpen*(1+SIDES)))-
        initial.profitYen100)>0.025){
      fail('FIRST_SESSION_SOURCE_OR_RETURN_CHANGED');
     }
     net=round(100*(bars.at(-1).close*(1-SIDES)/
       (entryOpen*(1+SIDES))-1));
     pnl=round(100*(bars.at(-1).close*(1-SIDES)-
       entryOpen*(1+SIDES)),2);
     low=round(100*(Math.min(...bars.map(x=>x.low))/
       (entryOpen*(1+SIDES))-1));
     priceBudget=initial.modeledBudgetLots?.eligible??false;
     status='HYPOTHETICAL_HORIZON_ONLY';reason=null;
    }
   }
   records.push({
    code:initial.code,horizonSessions:horizon,exitSession:days.at(-1),
    risingMA75:initial.risingMA75,
    compoundWickVolume:initial.compoundWickVolume,
    status,reason,netReturnPercent:net,profitYen100:pnl,
    worstObservedLowPercent:low,budgetEligible:priceBudget,
    actualBrokerFillVerified:false,
    independentSourceProvenanceVerified:false
   });
  }
  const groups=group(records);
  if(groups.allBreakouts.cohortCount!==27||
     groups.risingBreakouts.cohortCount!==22||
     groups.compoundBreakouts.cohortCount!==3||
     groups.risingAndCompound.cohortCount!==3||
     groups.allBreakouts.pending+groups.allBreakouts.quarantined+
       groups.allBreakouts.measured!==27)
   fail('FROZEN_DENOMINATOR_ACCOUNTING_FAILURE');
  rows.push(...records);overview['session'+horizon]={
   outcomeDate:days.at(-1),groups,
   sourceDatesRequired:[...days],
   completeOriginalSourcesPresent:days.every(date=>maps.has(date))
  };
 }
 return {
  version:MA75_FROZEN_HORIZONS_VERSION,status:'SHADOW_NOT_APPROVED',
  signalDate:'2026-11-02',entrySessionDate:'2026-11-04',
  originalCohortSha256:first.frozenCohortSha256,
  originalAllBreakouts:27,originalRisingBreakouts:22,
  originalWickVolumeComposite:3,
  originalForwardMembershipUntouched:true,
  inputOriginalDays:[...maps.keys()],
  horizons:overview,perFrozenCodeHorizon:rows,
  costAssumptionPerSideFraction:SIDES,
  additionalRoundTripCostApproximation:true,
  sourceTimingIndependentlyVerified:false,exchangeCalendarIndependentlyVerified:false,
  officialCorporateActionsIndependentlyVerified:false,
  modelIsRetrospectiveNotTradeable:true,
  independentValidatedForwardOutcomes:0,
  validatedForwardWinRate:null,
  eligibleForTrading:false,eligibleForNotifications:false,
  eligibleForAIPowerScoring:false,eligibleForProduction:false,
  filesWritten:0,networkRequests:0
 };
}
