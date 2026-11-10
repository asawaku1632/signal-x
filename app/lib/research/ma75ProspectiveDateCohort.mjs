/**
 * Prospective SECOND signal-date MA75 study. The predeclared policy committed
 * on 2026-11-10 must NOT change after Nov 11 signals or future outcomes.
 * No I/O, network, orders, API, notifications, performance assertions.
 */
import {createHash} from 'node:crypto';
import {validateMa75FrozenUniverse} from './ma75FrozenUniverse.mjs';
import {reviewMa75FirstForwardDay} from './ma75FirstForwardDayShadow.mjs';

export const MA75_NEXT_DATE_FREEZE_VERSION='ma75_second_signal_date_owner_local_lock_v1';
const digest=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const fail=s=>{throw new TypeError('MA75_NEXT_COHORT_'+s)};
const validSha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const sorted=x=>[...x].sort((a,b)=>a.code.localeCompare(b.code));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function requireMa75ProspectivePolicy(policy){
 if(policy?.version!=='ma75_prospective_1111_policy_v1'||
    policy.status!=='SHADOW_NOT_APPROVED'||
    policy.declaredOn!=='2026-11-10'||
    policy.signalSession!=='2026-11-11'||
    policy.firstNewSignalDate!=='2026-11-11'||
    policy.fullPriorMA75Sessions!==75||
    policy.warmupHistoricalSessions!==69||
    policy.warmupPreviousPostfreezeSessions!==6||
    policy.frozenUniverseSize!==953||
    policy.historicalArchiveFrom!=='2026-05-01'||
    policy.historicalArchiveThrough!=='2026-10-30'||
    policy.historicalFileSessions!==122||
    policy.frozenUniverseSource!=='docs/ma75-forward-cohort-freeze-20261031.json'||
    policy.originalNov02PinnedFreezeSha256!==
     '1ba1aee5ac05b2c0fd114d3cabe5463bde4409b203544722cf03c04fc0a6612b'||
    policy.signalRule!==
     'previousClose <= previousSMA75 AND signalClose > signalSMA75'||
    policy.risingRule!=='signalSMA75 > previousSMA75'||
    policy.singleHundredShareBuyFriction!==.001||
    policy.singleHundredShareSellFriction!==.001||
    policy.budgetMinYen!==100000||policy.budgetMaxYen!==500000||
    policy.budgetRule!==
     'Some integer number >=1 of 100-share lots has modeled open-entry capital within inclusive budget range. This is a conditional next-open rule, not a signal-close known property.'||
    policy.ownerMustManuallyLockBeforeNextOpen!==true||
    policy.sameDaySourceEarliestUtc!=='2026-11-11T07:30:00Z'||
    policy.followingOpenDeadlineUtc!=='2026-11-12T00:00:00Z'||
    !same(policy.horizonOffsets,[1,3,5])||
    !same(policy.horizonSessions,[
     '2026-11-12','2026-11-13','2026-11-16','2026-11-17','2026-11-18'
    ])||
    !same(policy.precedingPostfreezeSessions,[
     '2026-11-02','2026-11-04','2026-11-05',
     '2026-11-06','2026-11-09','2026-11-10'
    ])||
    !same(policy.studyGroups,[
     'allBreakouts','risingBreakouts','nonRisingBreakouts',
     'budgetEligibleBreakouts','budgetEligibleRising','budgetEligibleNonRising'
    ])||
    policy.robustness!==
     'Per-group leave-largest-positive-out, leave-largest-negative-out, median, counts, positive rates; report per signal date and do not treat stocks on one date as independent market days.'||
    policy.licensedDataRemainsOwnerLocal!==true||
    policy.independentAsOfTimeCertified!==false||
    policy.providerRightsCertified!==false||
    policy.officialCalendarExternallyVerified!==false||
    policy.corporateActionsCertified!==false||
    policy.noRawProviderDataInGitHub!==true||
    policy.noNetworkByResearchRunner!==true||
    policy.noTrading!==true||policy.noAIPower!==true||
    policy.noLiveNotifications!==true||
    policy.claimFutureWinProbability!==false)
  fail('PREDECLARED_POLICY_CHANGED');
 return digest(policy);
}
export function buildMa75NextDateCohort(frozenUniverse,policy,{
 priorDates,priorProjections,signalProjection,sourceSha256,
 lockedAt,signalLastReceiptAt
}={}){
 const policySha256=requireMa75ProspectivePolicy(policy);
 validateMa75FrozenUniverse(frozenUniverse);
 if(frozenUniverse.populationSize!==953||
    frozenUniverse.firstEligibleSignalDate!=='2026-11-02'||
    !Array.isArray(priorDates)||priorDates.length!==75||
    !Array.isArray(priorProjections)||priorProjections.length!==75||
    priorDates.at(-1)!=='2026-11-10'||
    !same(priorDates.slice(-6),policy.precedingPostfreezeSessions)||
    !validSha(sourceSha256))
  fail('SOURCE_POPULATION_OR_SESSIONS_CHANGED');
 const start=Date.parse(policy.sameDaySourceEarliestUtc),
  end=Date.parse(policy.followingOpenDeadlineUtc);
 const now=Date.parse(lockedAt),received=Date.parse(signalLastReceiptAt);
 if(!Number.isFinite(now)||!Number.isFinite(received)||
    received<start||now<received||now>=end||
    typeof lockedAt!=='string'||new Date(now).toISOString()!==lockedAt)
  fail('LOCK_NOT_WITHIN_POSTCLOSE_BEFORE_OPEN');
 const virtualUniverse={...frozenUniverse,firstEligibleSignalDate:policy.signalSession};
 const report=reviewMa75FirstForwardDay(virtualUniverse,{
  priorDates,priorProjections,
  currentDate:policy.signalSession,currentProjection:signalProjection
 });
 if(report.fixedFrozenCodes!==953||
    report.analyzableCodeCount+report.incompleteAndQuarantined.length!==953||
    report.allBreakoutShadowCount+report.nonBreakout!==report.analyzableCodeCount||
    report.allBreakoutShadowCount!==
     report.risingMa75BreakoutShadowCount+report.breakoutWithoutRisingCount||
    report.return5Percent!==null||
    report.snapshotAsOfNextOpenIndependentlyAuthenticated!==false)
  fail('INCONSISTENT_SIGNAL_CLASSIFICATION');
 const candidateCodes=sorted(report.allBreakoutShadowPatterns)
  .map(x=>({code:x.code,risingMA75:x.sma75Rising}));
 const excluded=sorted(report.incompleteAndQuarantined)
  .map(x=>({code:x.code,reason:x.reason}));
 const body={
  version:MA75_NEXT_DATE_FREEZE_VERSION,status:'SHADOW_NOT_APPROVED',
  policySha256,originalsSha256:sourceSha256,
  signalDate:policy.signalSession,
  signalReceiptAt:signalLastReceiptAt,lockedAt,
  frozenUniverseSize:953,
  priorSourceDates:[...priorDates],
  allBreakouts:candidateCodes.length,
  risingBreakouts:candidateCodes.filter(x=>x.risingMA75).length,
  nonRisingBreakouts:candidateCodes.filter(x=>!x.risingMA75).length,
  analyzableCodes:report.analyzableCodeCount,
  notEvaluableCodes:excluded.length,nonBreakoutCodes:report.nonBreakout,
  candidates:candidateCodes,excluded,
  provenanceIndependentlyVerified:false,followingOpenFillVerified:false,
  returnsReadBeforeLock:false,
  validatedForwardOutcomes:0,validatedWinRate:null,
  eligibleForProduction:false,eligibleForTrading:false,
  eligibleForNotifications:false,eligibleForAIPowerScoring:false
 };
 return {...body,lockSha256:digest(body)};
}
export function verifyMa75NextDateCohort(value,policy){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    !validSha(value.lockSha256))return false;
 const {lockSha256,...body}=value;
 if(digest(body)!==lockSha256)return false;
 try{
  const sha=requireMa75ProspectivePolicy(policy);
  const candidates=body.candidates,exclusions=body.excluded;
  if(body.version!==MA75_NEXT_DATE_FREEZE_VERSION||
    body.status!=='SHADOW_NOT_APPROVED'||body.signalDate!==policy.signalSession||
    body.policySha256!==sha||!validSha(body.originalsSha256)||
    body.frozenUniverseSize!==953||
    !Array.isArray(body.priorSourceDates)||body.priorSourceDates.length!==75||
    body.priorSourceDates.at(-1)!=='2026-11-10'||
    !same(body.priorSourceDates.slice(-6),policy.precedingPostfreezeSessions)||
    !Array.isArray(candidates)||!Array.isArray(exclusions)||
    candidates.length!==body.allBreakouts||
    candidates.filter(x=>x.risingMA75).length!==body.risingBreakouts||
    candidates.filter(x=>!x.risingMA75).length!==body.nonRisingBreakouts||
    new Set(candidates.map(x=>x.code)).size!==candidates.length||
    candidates.some(x=>typeof x.code!=='string'||
     !/^[0-9]{3}[0-9A-Z]$/.test(x.code)||typeof x.risingMA75!=='boolean')||
    candidates.some((x,i)=>i>0&&x.code<=candidates[i-1].code)||
    new Set(exclusions.map(x=>x.code)).size!==exclusions.length||
    exclusions.some(x=>typeof x.code!=='string'||typeof x.reason!=='string'||
     candidates.some(c=>c.code===x.code))||
    body.analyzableCodes+body.notEvaluableCodes!==953||
    body.analyzableCodes!==body.allBreakouts+body.nonBreakoutCodes||
    body.notEvaluableCodes!==exclusions.length||
    body.returnsReadBeforeLock!==false||
    body.validatedForwardOutcomes!==0||body.validatedWinRate!==null||
    body.eligibleForProduction!==false||
    body.eligibleForTrading!==false||
    body.eligibleForNotifications!==false||
    body.eligibleForAIPowerScoring!==false||
    body.provenanceIndependentlyVerified!==false||
    body.followingOpenFillVerified!==false)
    return false;
  const now=Date.parse(body.lockedAt),receipt=Date.parse(body.signalReceiptAt);
  return Number.isFinite(now)&&Number.isFinite(receipt)&&
   now>=receipt&&receivedWithin(receipt,policy)&&
   now<Date.parse(policy.followingOpenDeadlineUtc);
 }catch{return false}
}
const receivedWithin=(receipt,policy)=>
 receipt>=Date.parse(policy.sameDaySourceEarliestUtc)&&
 receipt<Date.parse(policy.followingOpenDeadlineUtc);
