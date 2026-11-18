/**
 * Owner-local, forward-only MA75 Nov19 cohort/regime freeze and hypothetical
 * 1/3/5 session settlement. NO IO, API, scoring, trading or notifications.
 * The prior Nov02/Nov11 studies are not touched by this module.
 */
import {createHash} from 'node:crypto';
import {validateMa75FrozenUniverse} from './ma75FrozenUniverse.mjs';
import {reviewMa75FirstForwardDay} from './ma75FirstForwardDayShadow.mjs';

const fail=s=>{throw new TypeError('MA75_1119_'+s)};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const isSha=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const num=x=>typeof x==='number'&&Number.isFinite(x);
const round=x=>Number(x.toFixed(4));
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const dates=['2026-11-20','2026-11-24','2026-11-25','2026-11-26','2026-11-27'];
const offsets=[1,3,5];
const groupNames=['all','rising','nonRising','budget','budgetRising','budgetNonRising'];

export function checkMa75Nov19RegimePolicy(p){
 if(p?.version!=='ma75_regime_future_one_date_policy_v1'||
  p.status!=='SHADOW_NOT_APPROVED'||p.declaredOn!=='2026-11-18'||
  p.signalDate!=='2026-11-19'||
  p.sourceFirstPermittedUtc!=='2026-11-19T07:30:00Z'||
  p.lockDeadlineUtc!=='2026-11-20T00:00:00Z'||
  p.lockPath!=='research-private/ma75-2026-11-19-regime-lock.json'||
  p.originalFrozenUniverse!=='docs/ma75-forward-cohort-freeze-20261031.json'||
  p.universeSize!==953||p.priorSessions!==75||
  p.signalRule!=='previousClose <= previousSMA75 AND signalClose > signalSMA75'||
  p.risingRule!=='currentSMA75 > previousSMA75'||
  p.marketProxy!=='FROZEN_953_STOCK_EQUALLY_WEIGHTED_MEDIAN_TRAILING_5_SESSION_RETURN_NOT_TOPIX'||
  p.regimeThresholdUpPercent!==1||p.regimeThresholdDownPercent!==-1||
  p.regimeMinimumValidCodes!==800||p.budgetMinYen!==100000||
  p.budgetMaxYen!==500000||p.buyFriction!==.001||p.sellFriction!==.001||
  JSON.stringify(p.futureSessions)!==JSON.stringify(dates)||
  JSON.stringify(p.horizons)!==JSON.stringify(offsets)||
  !p.nextSignalIsNotAutomaticallyCaptured||
  !p.requireOwnerManualLockBeforeFollowingOpen||
  !p.requireAll953AndHistorical75||!p.onlyReadExistingLicensedData||
  !p.noProviderAPI||!p.noCloudScheduledJobs||!p.noRawDataInGitHub||
  !p.noProductionWrites||!p.noTrading||!p.noNotifications||
  !p.noAIPowerScoring||p.claimValidatedEdge!==false||
  p.futureConditionsPredeclaredAfterPriorTwoStudyDates!==true||
  typeof p.calendarNotes!=='string'||
  !p.calendarNotes.includes('2026-11-23'))fail('POLICY_MUTATED');
 return hash(p);
}
function barValid(row,date,code){
 const b=row?.bar;
 return row?.code===code&&row.tradeDate===date&&row.status==='DAILY_BAR'&&
  b?.code===code&&b.tradeDate===date&&
  [b.open,b.high,b.low,b.close,b.volume].every(num)&&
  b.open>0&&b.high>0&&b.low>0&&b.close>0&&b.volume>0&&
  b.high>=Math.max(b.open,b.close,b.low)&&b.low<=Math.min(b.open,b.close,b.high);
}
function mapProjected(freeze,day,projection){
 if(projection?.date!==day||projection.completeProviderPagination!==true||
  projection.originalAllListedRows<953||
  projection.audit?.rows?.length!==953||projection.audit?.failures?.length!==0)
  fail('INVALID_OR_MISSING_FULL_SOURCE_'+day);
 const m=new Map(),codeSet=new Set(freeze.codes);
 for(const row of projection.audit.rows){
  if(!codeSet.has(row?.code)||m.has(row.code)||row.tradeDate!==day)
   fail('INVALID_OR_DUPLICATE_SOURCE_CODE');
  m.set(row.code,row);
 }
 if(m.size!==953)fail('MISSING_FROZEN_SOURCE_ROWS');
 return m;
}
const median=a=>{
 const b=[...a].sort((x,y)=>x-y),i=Math.floor(b.length/2);
 return b.length%2?b[i]:(b[i-1]+b[i])/2;
};
function classifyMarket(freeze,priorDates,priorProjections,currentDate,currentProjection){
 const slice=[...priorProjections.slice(-5),currentProjection];
 const daySlice=[...priorDates.slice(-5),currentDate];
 const maps=daySlice.map((d,i)=>mapProjected(freeze,d,slice[i]));
 const returns=[];
 for(const code of freeze.codes){
  let prev=null,first=null,valid=true;
  for(let i=0;i<6;i++){
   const r=maps[i].get(code);
   if(!barValid(r,daySlice[i],code)){valid=false;break}
   if(prev!==null&&(Math.abs(r.bar.open/prev-1)>.45||
     Math.abs(r.bar.close/prev-1)>.45)){valid=false;break}
   if(i===0)first=r.bar.close;
   prev=r.bar.close;
  }
  if(valid)returns.push(100*(prev/first-1));
 }
 const n=returns.length,m=n?round(median(returns)):null;
 const regime=n<800?'UNKNOWN':m>=1?'UP':m<=-1?'DOWN':'SIDEWAYS';
 return {regime,trailingFiveMedianPercent:m,validCodes:n,
  invalidCodes:953-n,method:'FROZEN953_MEDIAN_PRE_SIGNAL_5_SESSIONS_NOT_TOPIX'};
}
export function buildMa75Nov19RegimeLock(freeze,policy,{
 priorDates,priorProjections,signalProjection,originalsSha256,
 signalReceiptAt,lockedAt
}={}){
 const policySha256=checkMa75Nov19RegimePolicy(policy);
 validateMa75FrozenUniverse(freeze);
 if(freeze.populationSize!==953||
  !Array.isArray(priorDates)||priorDates.length!==75||
  !Array.isArray(priorProjections)||priorProjections.length!==75||
  priorDates.at(-1)!=='2026-11-18'||
  priorDates.some((d,i)=>typeof d!=='string'||
   (i>0&&d<=priorDates[i-1])||d>='2026-11-19')||
  !isSha(originalsSha256))fail('INVALID_PREENTRY_SOURCE_WINDOW');
 const start=Date.parse(policy.sourceFirstPermittedUtc),
  deadline=Date.parse(policy.lockDeadlineUtc),
  receipt=Date.parse(signalReceiptAt),locked=Date.parse(lockedAt);
 if(!Number.isFinite(receipt)||!Number.isFinite(locked)||
  receipt<start||receipt>locked||locked>=deadline||
  typeof lockedAt!=='string'||new Date(locked).toISOString()!==lockedAt)
  fail('NOT_LOCKED_IN_SAME_DAY_PREENTRY_WINDOW');
 const review=reviewMa75FirstForwardDay({
  ...freeze,firstEligibleSignalDate:policy.signalDate
 },{priorDates,priorProjections,currentDate:policy.signalDate,
  currentProjection:signalProjection});
 const candidates=review.allBreakoutShadowPatterns.map(x=>({
  code:x.code,risingMA75:x.sma75Rising
 })).sort((a,b)=>a.code.localeCompare(b.code));
 const excluded=review.incompleteAndQuarantined.map(x=>({
  code:x.code,reason:x.reason
 })).sort((a,b)=>a.code.localeCompare(b.code));
 const market=classifyMarket(freeze,priorDates,priorProjections,
  policy.signalDate,signalProjection);
 const data={version:'ma75_nov19_regime_cohort_lock_v1',
  status:'SHADOW_NOT_APPROVED',signalDate:policy.signalDate,
  policySha256,originalsSha256,signalReceiptAt,lockedAt,
  priorDates:[...priorDates],frozenUniverseSize:953,
  allBreakouts:candidates.length,risingBreakouts:candidates.filter(x=>x.risingMA75).length,
  nonRisingBreakouts:candidates.filter(x=>!x.risingMA75).length,
  notEvaluableCodes:excluded.length,nonBreakoutCodes:review.nonBreakout,
  market,candidates,excluded,
  returnsReadBeforeLock:false,independentlyVerifiedSourceReceipt:false,
  validatedForwardOutcomes:0,eligibleForProduction:false,
  eligibleForTrading:false,eligibleForNotifications:false,
  eligibleForAIPowerScoring:false};
 return {...data,lockSha256:hash(data)};
}
export function verifyMa75Nov19RegimeLock(lock,policy){
 try{
  const policySha=checkMa75Nov19RegimePolicy(policy);
  if(!isSha(lock?.lockSha256))return false;
  const {lockSha256,...body}=lock;
  if(hash(body)!==lockSha256||body.version!=='ma75_nov19_regime_cohort_lock_v1'||
   body.status!=='SHADOW_NOT_APPROVED'||body.signalDate!=='2026-11-19'||
   body.policySha256!==policySha||!isSha(body.originalsSha256)||
   body.frozenUniverseSize!==953||body.priorDates?.length!==75||
   body.priorDates.at(-1)!=='2026-11-18'||
   body.allBreakouts!==body.candidates?.length||
   body.risingBreakouts!==body.candidates.filter(x=>x.risingMA75).length||
   body.nonRisingBreakouts!==body.candidates.filter(x=>!x.risingMA75).length||
   body.notEvaluableCodes!==body.excluded?.length||
   body.allBreakouts+body.notEvaluableCodes+body.nonBreakoutCodes!==953||
   body.market?.validCodes+body.market?.invalidCodes!==953||
   !['UP','DOWN','SIDEWAYS','UNKNOWN'].includes(body.market?.regime)||
   body.market.regime!==(body.market.validCodes<800?'UNKNOWN':
    body.market.trailingFiveMedianPercent>=1?'UP':
    body.market.trailingFiveMedianPercent<=-1?'DOWN':'SIDEWAYS')||
   body.returnsReadBeforeLock!==false||body.validatedForwardOutcomes!==0||
   body.eligibleForProduction!==false||body.eligibleForTrading!==false||
   body.eligibleForNotifications!==false||body.eligibleForAIPowerScoring!==false||
   body.independentlyVerifiedSourceReceipt!==false)return false;
  const codes=new Set(),exc=new Set();
  for(const c of body.candidates){
   if(!/^[0-9]{3}[0-9A-Z]$/.test(c?.code)||
    typeof c.risingMA75!=='boolean'||codes.has(c.code))return false;
   codes.add(c.code);
  }
  for(const x of body.excluded){
   if(!/^[0-9]{3}[0-9A-Z]$/.test(x?.code)||
    typeof x.reason!=='string'||codes.has(x.code)||exc.has(x.code))return false;
   exc.add(x.code);
  }
  const now=Date.parse(body.lockedAt),received=Date.parse(body.signalReceiptAt);
  return Number.isFinite(now)&&Number.isFinite(received)&&
   received>=Date.parse(policy.sourceFirstPermittedUtc)&&
   now>=received&&now<Date.parse(policy.lockDeadlineUtc);
 }catch{return false}
}
const summary=rows=>{
 const complete=rows.filter(x=>x.status==='HYPOTHETICAL_OUTCOME_ONLY');
 const values=complete.map(x=>x.netReturnPercent).sort((a,b)=>a-b),n=values.length;
 const result={frozenGroupCount:rows.length,measured:n,
  pending:rows.filter(x=>x.status.startsWith('PENDING_')).length,
  quarantined:rows.filter(x=>x.status.startsWith('QUARANTINED_')).length,
  mean:null,median:null,positiveRate:null,largestWinnerCode:null,
  withoutLargestWinner:null,largestLoserCode:null,withoutLargestLoser:null};
 if(n){
  const total=values.reduce((a,b)=>a+b,0),j=Math.floor(n/2);
  const winners=[...complete].sort((a,b)=>b.netReturnPercent-a.netReturnPercent||
   a.code.localeCompare(b.code));
  const losers=[...complete].sort((a,b)=>a.netReturnPercent-b.netReturnPercent||
   a.code.localeCompare(b.code));
  Object.assign(result,{mean:round(total/n),median:round(n%2?values[j]:(values[j-1]+values[j])/2),
   positiveRate:round(100*values.filter(x=>x>0).length/n),
   largestWinnerCode:winners[0].code,largestLoserCode:losers[0].code,
   withoutLargestWinner:n>1?round((total-winners[0].netReturnPercent)/(n-1)):null,
   withoutLargestLoser:n>1?round((total-losers[0].netReturnPercent)/(n-1)):null});
 }
 return result;
};
function settle(code,risingMA75,signalClose,outcomeDates,maps,h){
 const required=outcomeDates.slice(0,h);
 const first=maps.get(outcomeDates[0]);
 if(!first)return {code,risingMA75,budgetEligible:null,horizonSessions:h,
  status:'PENDING_FIRST_ENTRY_DAY',netReturnPercent:null};
 let lastClose=signalClose,bars=[],status=null;
 for(const date of required){
  const day=maps.get(date);
  if(!day){status='PENDING_REQUIRED_DAY';break}
  const row=day.get(code);
  if(!row||['NO_TRADE','MISSING_PROVIDER_ROW'].includes(row.status)){
   status='PENDING_MISSING_PROVIDER_ROW';break
  }
  if(!barValid(row,date,code)){
   status='QUARANTINED_INVALID_BAR';break;
  }
  const b=row.bar;
  if(Math.abs(b.open/lastClose-1)>.45||
   Math.abs(b.close/lastClose-1)>.45){
   status='QUARANTINED_PRICE_DISCONTINUITY';break;
  }
  bars.push(b);lastClose=b.close;
 }
 const firstBar=first.get(code)?.bar;
 const safeFirst=barValid(first.get(code),outcomeDates[0],code)&&
  Math.abs(firstBar.open/signalClose-1)<=.45&&
  Math.abs(firstBar.close/signalClose-1)<=.45;
 const budget=safeFirst?Math.max(1,Math.ceil(100000/(firstBar.open*100*1.001)))<=
  Math.floor(500000/(firstBar.open*100*1.001)):null;
 if(!status&&bars.length!==h)status='PENDING_REQUIRED_DAY';
 if(status)return {code,risingMA75,budgetEligible:budget,horizonSessions:h,
  status,netReturnPercent:null};
 const entry=bars[0].open*1.001,exit=bars.at(-1).close*.999;
 return {code,risingMA75,budgetEligible:budget,horizonSessions:h,
  status:'HYPOTHETICAL_OUTCOME_ONLY',netReturnPercent:round(100*(exit/entry-1))};
}
export function evaluateMa75Nov19RegimeOutcomes(freeze,policy,lock,{
 signalProjection,sourceByDate={},now
}={}){
 validateMa75FrozenUniverse(freeze);
 if(!verifyMa75Nov19RegimeLock(lock,policy))fail('LOCK_INTEGRITY_FAILED');
 const at=Date.parse(now);
 if(!Number.isFinite(at)||at<Date.parse(lock.lockedAt))fail('INVALID_EVALUATION_TIME');
 if(Object.keys(sourceByDate).some(x=>!dates.includes(x)))fail('NONPREDECLARED_FUTURE_DAY');
 const sigMap=mapProjected(freeze,policy.signalDate,signalProjection);
 const maps=new Map();
 for(const date of dates){
  if(!sourceByDate[date])continue;
  const entry=sourceByDate[date],rec=Date.parse(entry.receivedAt);
  if(!Number.isFinite(rec)||rec<Date.parse(date+'T07:30:00Z')||rec>at||
   rec<Date.parse(lock.lockedAt))fail('FUTURE_SOURCE_TIMESTAMP_UNTRUSTED');
  maps.set(date,mapProjected(freeze,date,entry.projection));
 }
 const codes=new Set(lock.candidates.map(x=>x.code));
 const result={};
 for(const h of offsets){
  const rows=[];
  for(const c of lock.candidates){
   const signal=sigMap.get(c.code);
   if(!barValid(signal,policy.signalDate,c.code))fail('SIGNAL_CLOSE_SOURCE_CHANGED');
   rows.push(settle(c.code,c.risingMA75,signal.bar.close,dates,maps,h));
  }
  const peer=[];
  for(const code of freeze.codes){
   if(codes.has(code))continue;
   const sig=sigMap.get(code);
   if(!barValid(sig,policy.signalDate,code)){
    peer.push({code,status:'PENDING_UNKNOWN_SIGNAL_CLOSE'});continue;
   }
   peer.push(settle(code,false,sig.bar.close,dates,maps,h));
  }
  const defs={all:rows,rising:rows.filter(x=>x.risingMA75),
   nonRising:rows.filter(x=>!x.risingMA75),
   budget:rows.filter(x=>x.budgetEligible===true),
   budgetRising:rows.filter(x=>x.risingMA75&&x.budgetEligible===true),
   budgetNonRising:rows.filter(x=>!x.risingMA75&&x.budgetEligible===true)};
  const groups=Object.fromEntries(groupNames.map(k=>[k,summary(defs[k])]));
  const peers=summary(peer),budgetPeers=summary(peer.filter(x=>x.budgetEligible===true));
  if(groups.all.frozenGroupCount!==lock.allBreakouts||
   groups.all.measured+groups.all.pending+groups.all.quarantined!==lock.allBreakouts||
   groups.rising.frozenGroupCount!==lock.risingBreakouts||
   groups.nonRising.frozenGroupCount!==lock.nonRisingBreakouts||
   peers.frozenGroupCount!==953-lock.allBreakouts)
   fail('DENOMINATOR_CHANGED');
  const allComplete=dates.slice(0,h).every(d=>maps.has(d));
  result['session'+h]={exitSession:dates[h-1],
   allRequiredOriginalDaysPresent:allComplete,
   groups,peer:peers,budgetPeer:budgetPeers,
   signalMinusPeerPoints:allComplete&&groups.all.measured===lock.allBreakouts&&
    peers.measured===953-lock.allBreakouts&&groups.all.mean!==null&&peers.mean!==null?
    round(groups.all.mean-peers.mean):null};
 }
 return {version:'ma75_nov19_regime_forward_outcomes_v1',
  status:'SHADOW_NOT_APPROVED',signalDate:lock.signalDate,
  lockSha256:lock.lockSha256,priorMarketRegime:lock.market.regime,
  priorMarketMedianPercent:lock.market.trailingFiveMedianPercent,
  originalBreakouts:lock.allBreakouts,
  sourcesObserved:[...maps.keys()],horizons:result,
  sourceAndCaptureTimingIndependentlyVerified:false,
  testedOutcomesNotActualBrokerFills:true,independentlyValidatedEdge:false,
  eligibleForProduction:false,eligibleForTrading:false,
  eligibleForNotifications:false,eligibleForAIPowerScoring:false,
  filesWritten:0,networkRequests:0};
}
