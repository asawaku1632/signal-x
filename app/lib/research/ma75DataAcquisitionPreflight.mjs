/**
 * SHADOW ONLY: no-network acquisition preflight for frozen 953-code SMA75 cohort.
 * It NEVER calls J-Quants, handles secrets, persists rows, schedules a job,
 * subscribes to an add-on, or authorizes trading/notifications.
 */
import {validateMa75FrozenUniverse} from './ma75FrozenUniverse.mjs';
import {MA75_JQUANTS_PAGE_VERSION} from './ma75JQuantsDailyPages.mjs';

export const MA75_ACQUISITION_PREFLIGHT_VERSION='ma75_acquisition_preflight_v1';
export const MA75_STANDARD_ACCOUNT_RATE_LIMIT=120; // J-Quants docs, nominal requests/min, shared across keys.
const DAY=/^20\d\d-\d\d-\d\d$/;
const isDay=x=>typeof x==='string'&&DAY.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const timestamp=x=>typeof x==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(x)?Date.parse(x):NaN;
const afterTseClose=date=>Date.parse(date+'T06:30:00Z'); // 15:30 JST, NOT provider-available-at.
const dailyPublishTarget=date=>Date.parse(date+'T07:30:00Z'); // Around 16:30 JST; estimate, not guarantee.
const OFFLINE_PAGE_COMPLETE=new Set(['DAILY_BAR','NO_TRADE']);

/**
 * asOf: explicit offset-aware ISO instant; sessions: 76 calendar-certified
 * session *claims* ending at the target signal date.
 * audits: existing outputs from parseMa75JQuantsDailyPages, NEVER fetched here.
 * minuteAddonStatus is a declared plan, not proof of account entitlement.
 */
export function planMa75JQuantsAcquisition(freeze,{
  asOf,sessions,audits=[],minuteAddonStatus='PLANNED',
}={}){
 validateMa75FrozenUniverse(freeze);
 const clock=timestamp(asOf);
 if(!Number.isFinite(clock)||clock<timestamp(freeze.frozenAt))
   throw new TypeError('Require explicit as-of time at or after frozen candidate timestamp');
 if(!Array.isArray(sessions)||sessions.length!==76||
   sessions.some((d,i)=>!isDay(d)||(i>0&&d<=sessions[i-1]))||
   sessions[75]<freeze.firstEligibleSignalDate)
   throw new TypeError('Require 76 unique ascending session claims including eligible target date');
 if(!Array.isArray(audits)||!['PLANNED','NOT_PLANNED','USER_REPORTED_ACTIVE'].includes(minuteAddonStatus))
   throw new TypeError('Invalid capture audits or minute add-on status');
 const wanted=new Set(sessions),grouped=new Map(),unexpected=[];
 for(const audit of audits){
   if(!wanted.has(audit?.date)){unexpected.push(String(audit?.date??'?'));continue}
   grouped.set(audit.date,[...(grouped.get(audit.date)??[]),audit]);
 }
 const days=[];
 for(const date of sessions){
   const prior=grouped.get(date)??[];
   let state='REQUIRES_EXISTING_DATA_OR_FETCH';
   if(prior.length>1)state='DUPLICATE_CAPTURE_REVIEW';
   else if(prior.length===1){
     const r=prior[0],rows=r?.rows;
     if(r.version!==MA75_JQUANTS_PAGE_VERSION||
       r.paginationComplete!==true||!Array.isArray(r.failures)||r.failures.length!==0||
       r.expectedFrozenCodes!==freeze.codes.length||
       !Array.isArray(rows)||rows.length!==freeze.codes.length||
       rows.some((x,i)=>x?.code!==freeze.codes[i]||x.tradeDate!==date||
         !OFFLINE_PAGE_COMPLETE.has(x.status)||
         (x.status==='DAILY_BAR'&&x.bar?.unadjusted!==true)||
         (x.status==='NO_TRADE'&&x.bar!==null))||
       r.eligibleForForwardSignal!==false||
       r.providerRightsVerified!==false)
       state='PREVIOUS_AUDIT_INCOMPLETE';
     else state='ARCHIVED_OFFLINE_ONLY';
   }
   // Close time does not imply provider release or live-source availability.
   if(clock<afterTseClose(date))state='SESSION_NOT_YET_CLOSED';
   else if(clock<dailyPublishTarget(date))state='WAIT_FOR_DAILY_PROVIDER_UPDATE';
   days.push({date,state,previousAuditCount:prior.length});
 }
 const count=state=>days.filter(x=>x.state===state).length;
 const possibleRequests=days.filter(x=>[
   'REQUIRES_EXISTING_DATA_OR_FETCH','PREVIOUS_AUDIT_INCOMPLETE',
   'DUPLICATE_CAPTURE_REVIEW'
 ].includes(x.state)).length;
 const allArchived=days.every(x=>x.state==='ARCHIVED_OFFLINE_ONLY');
 return {
   version:MA75_ACQUISITION_PREFLIGHT_VERSION,
   frozenPopulation:freeze.codes.length,
   expectedCodeSessionCells:freeze.codes.length*sessions.length,
   expectedDailySessions:76,
   requestedEndpoint:'/v2/equities/bars/daily',
   requestGranularity:'ONE_DATE_ALL_LISTED_WITH_PAGINATION',
   baselineRequestsForAllMissingDates:76,
   initialDateRequestsPotentiallyNeeded:possibleRequests,
   extraPaginationRequests:'UNKNOWN_UNTIL_REAL_RESPONSES',
   officialStandardPerMinuteCeiling:MA75_STANDARD_ACCOUNT_RATE_LIMIT,
   planningSafetyTargetRequestsPerMinute:30,
   accountRateLimitSharedWithOtherConsumers:true,
   minuteAddonStatus,
   minuteAddonConfirmedByProvider:false,
   minuteAddonPriceYenPerMonthBeforeOtherCharges:5500,
   minuteAddonHistoricalRetentionYears:2,
   minuteAddonUpdatesOnlyDaily:true,
   minuteAddonRealtimeSupported:false,
   minuteBarsWithNoTransactionsAreOmitted:true,
   minuteResearchEndpoint:'/v2/equities/bars/minute',
   minuteResearchCanBeginWithExistingEntitlement:false,
   minuteAddonPurpose:'SEPARATE_MORNING_DIP_REBOUND_STUDY_NOT_SMA75_DAILY',
   states:{
     archivedOfflineOnly:count('ARCHIVED_OFFLINE_ONLY'),
     pendingFetch:count('REQUIRES_EXISTING_DATA_OR_FETCH'),
     incompleteExisting:count('PREVIOUS_AUDIT_INCOMPLETE'),
     duplicateExisting:count('DUPLICATE_CAPTURE_REVIEW'),
     notYetClosed:count('SESSION_NOT_YET_CLOSED'),
     waitingForProviderDailyUpdate:count('WAIT_FOR_DAILY_PROVIDER_UPDATE'),
     unexpectedAuditDates:unexpected.length,
   },
   unexpectedAuditDates:unexpected,
   dates:days,
   structuralHistoricalInputsPresent:allArchived&&unexpected.length===0,
   independentCalendarVerified:false,
   pointInTimeProviderAvailabilityVerified:false,
   providerRightsVerified:false,
   allowedToRunApiCalls:false,
   allowedToSpendMoney:false,
   generatedFutureSignals:0,
   eligibleForProduction:false,
   eligibleForNotifications:false,
   warnings:[
     'Standard daily bars do not require the separate minute/tick add-on.',
     'The minute/tick add-on is user-planned; its actual activation and cost have not been verified by this tool.',
     'J-Quants one-minute and tick historical feeds update daily, NOT real time; never use for a same-day 09:05 alert.',
     'A minute without trades may have no bar, and the first trade bar need not occur at 09:00.',
     'The nominal account-level 120 requests/min is shared across services and does not determine pagination or availability.',
     'J-Quants daily OHLCV is typically updated around 16:30 JST, not at 15:30. This is an estimate, not a guaranteed release time.',
     'J-Quants may publish data after exchange close; historical API download cannot prove an as-of next-open decision.',
     'Even 76 archived page audits cannot prove original provider capture, data license, trading calendar or corporate-action treatment.',
   ],
 };
}
