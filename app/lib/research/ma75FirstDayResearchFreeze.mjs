/**
 * Research-only deterministic FIRST-DAY cohort freeze for a subsequent
 * held-constant 5-session outcome evaluation. No network, API, file writes,
 * scores, notifications, or trading. A user-local file hash and timestamp
 * do NOT independently prove provider authenticity or point-in-time capture.
 */
import {createHash} from 'node:crypto';
export const MA75_FIRST_DAY_FREEZE_VERSION='ma75_first_forward_shadow_cohort_freeze_v1';
const codePattern=/^[0-9]{3}[0-9A-Z]$/;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const fail=why=>{throw new TypeError('MA75_FIRST_DAY_FREEZE_'+why)};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const canonicalCodes=rows=>rows.map(row=>row.code).sort();
export function buildMa75FirstDayResearchFreeze(report,{sourceSha256,recordedAt}={}){
 if(!report||report.version!=='ma75_first_forward_day_shadow_v1'||
    report.status!=='OFFLINE_SHADOW_PATTERN_REVIEW_ONLY'||
    report.requestedSignalDate!=='2026-11-02'||
    report.historicalWarmupLast!=='2026-10-30'||
    report.warmupSessions!==75||
    report.fixedFrozenCodes!==953||
    report.snapshotAsOfNextOpenIndependentlyAuthenticated!==false||
    report.return5Percent!==null||report.validatedForwardWinRate!==null||
    report.eligibleForProduction!==false||
    report.eligibleForTrading!==false||
    report.eligibleForNotifications!==false||
    report.eligibleForAIPowerScoring!==false||
    report.independentForwardOutcomes!==0)
  fail('NOT_FIRST_DAY_RESEARCH_ONLY');
 if(typeof sourceSha256!=='string'||!/^[0-9a-f]{64}$/.test(sourceSha256))
  fail('SOURCE_DIGEST_REQUIRED');
 const timestamp=Date.parse(recordedAt);
 if(typeof recordedAt!=='string'||!Number.isFinite(timestamp)||
    !/Z$/.test(recordedAt)||new Date(timestamp).toISOString()!==recordedAt)
  fail('UTC_TIMESTAMP_REQUIRED');
 if(timestamp<Date.parse('2026-11-02T07:30:00Z'))
  fail('PRE_PUBLISHED_COHORT');
 const counts=['codesWithCompletePrior75','blockedPrior75',
  'blockedCurrentDayAmongCompletePrior75','quarantinedPriceDiscontinuity',
  'analyzableCodeCount','allBreakoutShadowCount',
  'risingMa75BreakoutShadowCount','breakoutWithoutRisingCount'];
 if(counts.some(x=>!Number.isSafeInteger(report[x])||report[x]<0)||
    report.codesWithCompletePrior75+report.blockedPrior75!==953||
    report.blockedCurrentDayAmongCompletePrior75+
     report.quarantinedPriceDiscontinuity+report.analyzableCodeCount!==
      report.codesWithCompletePrior75||
    report.allBreakoutShadowCount+report.nonBreakout!==
      report.analyzableCodeCount||
    report.risingMa75BreakoutShadowCount+
     report.breakoutWithoutRisingCount!==report.allBreakoutShadowCount)
  fail('DENOMINATOR_RECONCILIATION');
 if(!Array.isArray(report.shadowPatterns)||
    !Array.isArray(report.allBreakoutShadowPatterns)||
    !Array.isArray(report.incompleteAndQuarantined)||
    report.allBreakoutShadowPatterns.length!==report.allBreakoutShadowCount||
    report.shadowPatterns.length!==report.risingMa75BreakoutShadowCount||
    report.incompleteAndQuarantined.length!==
      report.blockedPrior75+report.blockedCurrentDayAmongCompletePrior75+
      report.quarantinedPriceDiscontinuity)
  fail('MISSING_FULL_LEDGER');
 const group=report.allBreakoutShadowPatterns;
 const risen=report.shadowPatterns;
 const validEntry=e=>e&&codePattern.test(e.code)&&e.tradeDate==='2026-11-02'&&
  typeof e.sma75Rising==='boolean'&&
  e.status==='CLOSE_TIME_SHADOW_PATTERN_ONLY'&&
  (e.historicalVolumeRatio===null||finite(e.historicalVolumeRatio));
 if(group.some(e=>!validEntry(e))||risen.some(e=>!validEntry(e)||!e.sma75Rising)||
    new Set(canonicalCodes(group)).size!==group.length||
    new Set(canonicalCodes(risen)).size!==risen.length)
  fail('BAD_OR_DUPLICATED_PATTERN');
 const groupByCode=new Map(group.map(e=>[e.code,e]));
 for(const r of risen)if(!same(r,groupByCode.get(r.code)))fail('RISEN_SUBSET_NOT_IDENTICAL');
 if(group.filter(x=>x.sma75Rising).length!==risen.length)
  fail('MISSING_RISING_BREAKOUT');
 const excluded=report.incompleteAndQuarantined.map(e=>({
  code:e.code,status:e.status,reason:e.reason
 })).sort((a,b)=>a.code.localeCompare(b.code));
 if(excluded.some(e=>!codePattern.test(e.code)||
    e.status!=='NOT_EVALUABLE'||typeof e.reason!=='string'||
    !/^(PRIOR_75_|CURRENT_|UNVERIFIED_)/.test(e.reason))||
    new Set(excluded.map(e=>e.code)).size!==excluded.length||
    excluded.some(e=>groupByCode.has(e.code)))
  fail('BAD_OR_DUPLICATED_EXCLUSION');
 const groupCanonical=[...group].sort((a,b)=>a.code.localeCompare(b.code))
  .map(({code,tradeDate,sma75Rising,historicalVolumeRatio})=>({
   code,tradeDate,sma75Rising,historicalVolumeRatio
  }));
 const frozen={
  version:MA75_FIRST_DAY_FREEZE_VERSION,
  createdAt:recordedAt,
  capturedSourceSha256:sourceSha256,
  firstForwardDate:'2026-11-02',
  priorHistoryLast:'2026-10-30',
  frozenPopulation:953,
  eligibleWarmupCount:report.codesWithCompletePrior75,
  analyzableCount:report.analyzableCodeCount,
  excludedCount:excluded.length,
  breakoutsTotal:groupCanonical.length,
  risingBreakoutCount:risen.length,
  breakoutsAll:groupCanonical,
  exclusions:excluded,
  originalAsOfProofIndependentlyAuthenticated:false,
  officialTradingCalendarIndependentlyVerified:false,
  rightsAndCorporateActionsIndependentlyVerified:false,
  noOriginalPriceDataStored:true,
  noFutureEntryOrOutcomeRead:true,
  independentForwardOutcomes:0,
  validatedWinRate:null,
  eligibleForProduction:false,
  eligibleForNotifications:false,
  eligibleForTrading:false,
  eligibleForAIPowerScoring:false
 };
 return {...frozen,freezeSha256:digest(frozen)};
}
export function verifyMa75FirstDayResearchFreeze(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const {freezeSha256,...payload}=value;
 if(typeof freezeSha256!=='string'||!/^[0-9a-f]{64}$/.test(freezeSha256)||
    digest(payload)!==freezeSha256)return false;
 try{
  const source={...payload,version:'ma75_first_forward_day_shadow_v1',
   status:'OFFLINE_SHADOW_PATTERN_REVIEW_ONLY',
   requestedSignalDate:payload.firstForwardDate,
   historicalWarmupLast:payload.priorHistoryLast,
   warmupSessions:75,fixedFrozenCodes:payload.frozenPopulation,
   codesWithCompletePrior75:payload.eligibleWarmupCount,
   blockedPrior75:payload.exclusions.filter(e=>e.reason.startsWith('PRIOR_75_')).length,
   blockedCurrentDayAmongCompletePrior75:payload.exclusions.filter(e=>e.reason.startsWith('CURRENT_')).length,
   quarantinedPriceDiscontinuity:payload.exclusions.filter(e=>e.reason==='UNVERIFIED_PRICE_DISCONTINUITY').length,
   analyzableCodeCount:payload.analyzableCount,
   allBreakoutShadowCount:payload.breakoutsTotal,
   risingMa75BreakoutShadowCount:payload.risingBreakoutCount,
   breakoutWithoutRisingCount:payload.breakoutsTotal-payload.risingBreakoutCount,
   nonBreakout:payload.analyzableCount-payload.breakoutsTotal,
   allBreakoutShadowPatterns:payload.breakoutsAll.map(x=>({...x,status:'CLOSE_TIME_SHADOW_PATTERN_ONLY'})),
   shadowPatterns:payload.breakoutsAll.filter(x=>x.sma75Rising)
     .map(x=>({...x,status:'CLOSE_TIME_SHADOW_PATTERN_ONLY'})),
   incompleteAndQuarantined:payload.exclusions,
   snapshotAsOfNextOpenIndependentlyAuthenticated:false,
   return5Percent:null,validatedForwardWinRate:null,independentForwardOutcomes:0,
   eligibleForProduction:false,eligibleForNotifications:false,
   eligibleForTrading:false,eligibleForAIPowerScoring:false
  };
  return same(value,buildMa75FirstDayResearchFreeze(source,{
   sourceSha256:payload.capturedSourceSha256,recordedAt:payload.createdAt
  }));
 }catch{return false}
}
