/**
 * SHADOW ONLY. Pre-entry frozen 953-stock MARKET PROXY, not TOPIX.
 * "As of signal" uses only six completed daily sessions through signal.
 * All later price changes are DESCRIPTIVE, not an as-of trading input.
 */
export const MARKET_PROXY_REGIME_V1=Object.freeze({
 version:'ma75_frozen953_regime_v1',
 symbolPopulation:953,
 trailingSessions:5,
 upThresholdPercent:1,
 downThresholdPercent:-1,
 minValidProxyCodes:800,
 suspiciousGapFraction:0.45,
 modeledBuyFriction:0.001,
 modeledSellFriction:0.001,
 status:'SHADOW_NOT_APPROVED'
});
const fail=x=>{throw new TypeError('MA75_FROZEN953_REGIME_'+x)};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const rd=x=>Number(x.toFixed(4));
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const pct=(a,b)=>100*(b/a-1);
const dateOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
function summary(values){
 if(!values.length)return {measured:0,mean:null,median:null,
  positiveCount:0,positivePercent:null,withoutBest:null,withoutWorst:null};
 const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2),total=values.reduce((x,y)=>x+y,0);
 return {measured:values.length,mean:rd(total/values.length),
  median:rd(s.length%2?s[m]:(s[m-1]+s[m])/2),
  positiveCount:values.filter(x=>x>0).length,
  positivePercent:rd(100*values.filter(x=>x>0).length/values.length),
  withoutBest:s.length>1?rd((total-s.at(-1))/(s.length-1)):null,
  withoutWorst:s.length>1?rd((total-s[0])/(s.length-1)):null};
}
function readDateMaps({projectedByDate,asOfDates,outcomeDates,frozenCodes}){
 if(!Array.isArray(frozenCodes)||frozenCodes.length!==953||
    frozenCodes.some((c,i)=>typeof c!=='string'||(i>0&&c<=frozenCodes[i-1])))
  fail('INVALID_FROZEN_UNIVERSE');
 const out=new Map(), allowed=[...asOfDates,...outcomeDates],seen=new Set();
 if(allowed.length!==11||new Set(allowed).size!==11||
    allowed.some((d,i)=>!dateOK(d)||(i>0&&d<=allowed[i-1])))
  fail('INVALID_DATED_SESSIONS');
 if(!projectedByDate||typeof projectedByDate!=='object'||
    Object.keys(projectedByDate).some(d=>!allowed.includes(d)))
  fail('EXTRA_OR_WRONG_SOURCE_DATE');
 const frozenSet=new Set(frozenCodes);
 for(const date of allowed){
  const obj=projectedByDate[date];
  if(obj?.date!==date||obj.completeProviderPagination!==true||
     obj.audit?.failures?.length!==0||obj.audit?.rows?.length!==953||
     obj.originalAllListedRows<953)
   fail('MISSING_OR_INCOMPLETE_ORIGINAL_DAY_'+date);
  const m=new Map();
  for(const r of obj.audit.rows){
   if(!frozenSet.has(r?.code)||m.has(r.code)||r.tradeDate!==date)
    fail('MUTATED_OR_DUPLICATE_FROZEN_CODE');
   m.set(r.code,r);
  }
  if(m.size!==953)fail('WRONG_FROZEN_CODE_COUNT');
  out.set(date,m);seen.add(date);
 }
 return out;
}
function barValid(row,date,code){
 const b=row?.bar;
 return row?.code===code&&row.tradeDate===date&&row.status==='DAILY_BAR'&&
  b?.code===code&&b.tradeDate===date&&
  [b.open,b.high,b.low,b.close,b.volume].every(finite)&&
  b.open>0&&b.high>0&&b.low>0&&b.close>0&&b.volume>0&&
  b.high>=Math.max(b.open,b.close,b.low)&&b.low<=Math.min(b.open,b.close,b.high);
}
function getPath(code,dates,maps){
 const out=[];let lastClose=null;
 for(const d of dates){
  const r=maps.get(d).get(code);
  if(!barValid(r,d,code))return null;
  const b=r.bar;
  if(lastClose!==null&&
     (Math.abs(b.open/lastClose-1)>MARKET_PROXY_REGIME_V1.suspiciousGapFraction||
      Math.abs(b.close/lastClose-1)>MARKET_PROXY_REGIME_V1.suspiciousGapFraction))
   return null;
  out.push(b);lastClose=b.close;
 }
 return out;
}
function normalizedCohort(cohort,signalDate,expectedLockSha,expectedCount,expectedRising){
 if(cohort?.signalDate!==signalDate||cohort.status!=='SHADOW_NOT_APPROVED'||
    cohort.eligibleForTrading!==false||
    cohort.eligibleForProduction!==false||
    cohort.eligibleForNotifications!==false||
    !Array.isArray(cohort.perFrozenCodeHorizon))fail('INVALID_COHORT');
 const old=signalDate==='2026-11-02';
 const actualSha=old?cohort.originalCohortSha256:cohort.ownerLocalLockSha256;
 const n=old?cohort.originalAllBreakouts:cohort.originalBreakouts;
 const rising=old?cohort.originalRisingBreakouts:cohort.originalRisingBreakouts;
 if(actualSha!==expectedLockSha||n!==expectedCount||
    rising!==expectedRising||cohort.perFrozenCodeHorizon.length!==3*n)
  fail('FROZEN_IDENTITY_CHANGED');
 const codes=new Set(),groups=new Map();
 for(const h of [1,3,5]){
  const rows=cohort.perFrozenCodeHorizon.filter(x=>x.horizonSessions===h);
  if(rows.length!==n||rows.some(x=>
    x.status!==(old?'HYPOTHETICAL_HORIZON_ONLY':'HYPOTHETICAL_OUTCOME_ONLY')||
    !finite(x.netReturnPercent)||typeof x.risingMA75!=='boolean'||
    typeof x.budgetEligible!=='boolean'))
   fail('INCOMPLETE_HORIZON_'+h);
  const byCode=new Map();
  for(const r of rows){
   if(byCode.has(r.code)||!/^[0-9]{3}[0-9A-Z]$/.test(r.code))
    fail('DUPLICATE_COHORT_CODE');
   byCode.set(r.code,r);codes.add(r.code);
  }
  if(byCode.size!==n)fail('WRONG_COHORT_DENOMINATOR');
  groups.set(h,byCode);
 }
 if(codes.size!==n||[...codes].filter(c=>groups.get(1).get(c).risingMA75).length!==rising)
  fail('CHANGED_COHORT_MEMBERSHIP');
 for(const code of codes){
  const first=groups.get(1).get(code);
  for(const h of [3,5]){
   const r=groups.get(h).get(code);
   if(!r||r.risingMA75!==first.risingMA75||r.budgetEligible!==first.budgetEligible)
    fail('COHORT_MEMBERSHIP_DRIFT');
  }
 }
 return {codes,groups,n,rising,sha:actualSha};
}
export function evaluateFrozen953RegimeComparison({
 signalDate,asOfDates,outcomeDates,projectedByDate,frozenCodes,
 cohort,expectedLockSha,expectedCount,expectedRising
}){
 if(!['2026-11-02','2026-11-11'].includes(signalDate)||
    asOfDates?.length!==6||asOfDates.at(-1)!==signalDate||
    outcomeDates?.length!==5||outcomeDates[0]<=signalDate)
  fail('INVALID_SIGNAL_DATES');
 const fixed=normalizedCohort(cohort,signalDate,expectedLockSha,expectedCount,expectedRising);
 const maps=readDateMaps({projectedByDate,asOfDates,outcomeDates,frozenCodes});
 if([...fixed.codes].some(x=>!frozenCodes.includes(x)))
  fail('SIGNAL_OUTSIDE_FIXED_UNIVERSE');
 // Every listed code is counted; invalid six-session paths are explicitly excluded.
 const asOfValid=[];
 for(const code of frozenCodes){
  const rows=getPath(code,asOfDates,maps);
  if(rows)asOfValid.push(pct(rows[0].close,rows.at(-1).close));
 }
 const tr=summary(asOfValid);
 const enough=asOfValid.length>=MARKET_PROXY_REGIME_V1.minValidProxyCodes;
 const regime=!enough?'UNKNOWN':tr.median>=1?'UP':
  tr.median<=-1?'DOWN':'SIDEWAYS';
 const horizons={};
 for(const h of [1,3,5]){
  const values=[],eligibleValues=[],exclusions={invalidOrMissing:0,signalCodesExcluded:fixed.n,
   budgetIneligible:0},end=outcomeDates.slice(0,h);
  for(const code of frozenCodes){
   if(fixed.codes.has(code))continue;
   const bars=getPath(code,end,maps);
   if(!bars){exclusions.invalidOrMissing++;continue}
   const p=bars[0].open;
   const amount=p*100*(1+MARKET_PROXY_REGIME_V1.modeledBuyFriction);
   const budget=Math.max(1,Math.ceil(100000/amount))<=Math.floor(500000/amount);
   const modeled=rd(pct(p*(1+MARKET_PROXY_REGIME_V1.modeledBuyFriction),
    bars.at(-1).close*(1-MARKET_PROXY_REGIME_V1.modeledSellFriction)));
   values.push(modeled);
   if(budget)eligibleValues.push(modeled);else exclusions.budgetIneligible++;
  }
  const measured=fixed.groups.get(h);
  const all=[...measured.values()];
  const compare=(rows,peers)=>({signals:summary(rows.map(r=>r.netReturnPercent)),
   nonSignalPeer:peers,
   differenceInMeansPoints:peers.mean===null?null:
    rd(mean(rows.map(r=>r.netReturnPercent))-peers.mean)});
  const peer=summary(values),peerBudget=summary(eligibleValues);
  horizons['session'+h]={
   exitSession:end.at(-1),all:compare(all,peer),
   rising:compare(all.filter(r=>r.risingMA75),peer),
   nonRising:compare(all.filter(r=>!r.risingMA75),peer),
   budgetEligible:compare(all.filter(r=>r.budgetEligible),peerBudget),
   peer: {nonSignalOnly:true,allFixedPopulation:953,counts:exclusions,
    all:peer,budgetEligible:peerBudget}
  };
 }
 return {version:MARKET_PROXY_REGIME_V1.version,status:'SHADOW_NOT_APPROVED',
  signalDate,marketProxy:'FROZEN_953_STOCK_EQUALLY_WEIGHTED_MEDIAN_TRAILING_5_SESSION_RETURN_NOT_TOPIX',
  priorFiveSessionRegime:regime,priorFiveSessionMedianPercent:tr.median,
  priorFiveSessionMeanPercent:tr.mean,
  priorFivePositivePercent:tr.positivePercent,
  preSignalProxyValidCodes:tr.measured,preSignalProxyInvalidCodes:953-tr.measured,
  preSignalThresholds:{up:1,down:-1,minimumValid:800},
  asOfPriceDates:[...asOfDates],frozenOriginalCandidates:fixed.n,
  originalRisingCandidates:fixed.rising,originalCohortSha256:fixed.sha,
  horizons,regimeEvidenceIndependentlyAsOfCertified:false,
  thisMarketProxyIsNotActualTopix:true,
  marketProxySelectionIsAppObservedNotAllListed:true,
  horizonRegimeCannotBeUsedAtSignalTime:true,
  returnsAreHypotheticalNotBrokerFills:true,
  validatedEdge:false,eligibleForTrading:false,
  eligibleForNotifications:false,eligibleForProduction:false,
  filesWritten:0,networkRequests:0};
}
export function summarizeFrozen953Regimes(dates){
 if(!Array.isArray(dates)||!dates.length)fail('NO_STUDY_DATES');
 const seen=new Set();
 for(const a of dates){
  if(a?.version!==MARKET_PROXY_REGIME_V1.version||
     seen.has(a.signalDate)||!['UP','DOWN','SIDEWAYS','UNKNOWN'].includes(a.priorFiveSessionRegime))
   fail('INVALID_OR_DUPLICATE_DATE_RESULT');
  seen.add(a.signalDate);
 }
 const byRegime={};
 for(const label of ['UP','DOWN','SIDEWAYS','UNKNOWN']){
  const subset=dates.filter(x=>x.priorFiveSessionRegime===label);
  byRegime[label]={independentSignalDates:subset.length,signalDates:subset.map(x=>x.signalDate),
   session5MeanAcrossDates:subset.length?rd(mean(subset.map(x=>x.horizons.session5.all.signals.mean))):null,
   session5PeerMeanAcrossDates:subset.length?rd(mean(subset.map(x=>x.horizons.session5.peer.all.mean))):null,
   session5MeanExcessAcrossDates:subset.length?rd(mean(subset.map(x=>
    x.horizons.session5.all.differenceInMeansPoints))):null};
 }
 return {status:'SHADOW_NOT_APPROVED',version:MARKET_PROXY_REGIME_V1.version,
  classifiedBy:'TRAILING_FIVE_SESSION_FROZEN_953_PRICE_MEDIAN_AS_OF_SIGNAL',
  marketRegimes:byRegime,
  signalDateCount:dates.length,needsIndependentSignalDatesPerRegime:10,
  notValidatedWithOnlyTwoDates:true,eligibleForTrading:false,
  eligibleForNotifications:false,eligibleForProduction:false,
  filesWritten:0,networkRequests:0};
}
