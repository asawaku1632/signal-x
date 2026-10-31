/**
 * SHADOW ONLY: no-network acquisition preflight for frozen 953-code SMA75 cohort.
 * It NEVER calls J-Quants, handles secrets, persists rows, schedules a job,
 * subscribes to an add-on, or authorizes trading/notifications.
 */
import {validateMa75FrozenUniverse} from './ma75FrozenUniverse.mjs';
import {MA75_JQUANTS_PAGE_VERSION} from './ma75JQuantsDailyPages.mjs';
import {MA75_PAGE_REVISION_VERSION, fingerprintMa75RevisionPopulation}
  from './ma75JQuantsPageRevisionAudit.mjs';

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
const validPositive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const validRawBar=(bar,code,date)=>bar?.code===code&&
  bar.tradeDate===date&&bar.unadjusted===true&&
  [bar.open,bar.high,bar.low,bar.close,bar.volume].every(validPositive)&&
  bar.high>=Math.max(bar.open,bar.close,bar.low)&&
  bar.low<=Math.min(bar.open,bar.close,bar.high);

/**
 * asOf: explicit offset-aware ISO instant; sessions: 76 calendar-certified
 * session *claims* ending at the target signal date.
 * audits: existing outputs from parseMa75JQuantsDailyPages, NEVER fetched here.
 * minuteAddonStatus is a declared plan, not proof of account entitlement.
 */
export function planMa75JQuantsAcquisition(freeze,{
  asOf,sessions,audits=[],pageRevisionAudits=[],minuteAddonStatus='PLANNED',
}={}){
 validateMa75FrozenUniverse(freeze);
 const clock=timestamp(asOf);
 if(!Number.isFinite(clock)||clock<timestamp(freeze.frozenAt))
   throw new TypeError('Require explicit as-of time at or after frozen candidate timestamp');
 if(!Array.isArray(sessions)||sessions.length!==76||
   sessions.some((d,i)=>!isDay(d)||(i>0&&d<=sessions[i-1]))||
   sessions[75]<freeze.firstEligibleSignalDate)
   throw new TypeError('Require 76 unique ascending session claims including eligible target date');
 if(!Array.isArray(audits)||!Array.isArray(pageRevisionAudits)||
    !['PLANNED','NOT_PLANNED','USER_REPORTED_ACTIVE'].includes(minuteAddonStatus))
   throw new TypeError('Invalid capture audits or minute add-on status');
 const wanted=new Set(sessions),grouped=new Map(),unexpected=[];
 for(const audit of audits){
   if(!wanted.has(audit?.date)){unexpected.push(String(audit?.date??'?'));continue}
   grouped.set(audit.date,[...(grouped.get(audit.date)??[]),audit]);
 }
 const revisionPopulationHash=fingerprintMa75RevisionPopulation(freeze);
 const revisionByDate=new Map(),unexpectedRevisionDates=[];
 for(const audit of pageRevisionAudits){
   const date=audit?.tradeDate;
   if(!wanted.has(date)){unexpectedRevisionDates.push(String(date??'?'));continue}
   revisionByDate.set(date,[...(revisionByDate.get(date)??[]),audit]);
 }
 const days=[];
 for(const date of sessions){
   const prior=grouped.get(date)??[];
   let state='REQUIRES_EXISTING_DATA_OR_FETCH';
   let usableDailyBars=0,noTradeCodes=0;
   if(prior.length>1)state='DUPLICATE_CAPTURE_REVIEW';
   else if(prior.length===1){
     const r=prior[0],rows=r?.rows;
     const lastReceived=timestamp(r?.lastReceivedAt);
     const firstReceived=timestamp(r?.firstReceivedAt);
     if(!Number.isFinite(firstReceived)||!Number.isFinite(lastReceived)||
       firstReceived<afterTseClose(date)||firstReceived>lastReceived||
       lastReceived>clock||lastReceived<afterTseClose(date)||
       r.version!==MA75_JQUANTS_PAGE_VERSION||
       r.paginationComplete!==true||!Array.isArray(r.failures)||r.failures.length!==0||
       !Number.isSafeInteger(r.readPages)||r.readPages<1||
       !Number.isSafeInteger(r.rawProviderRows)||r.rawProviderRows<0||
       r.expectedFrozenCodes!==freeze.codes.length||
       !Array.isArray(rows)||rows.length!==freeze.codes.length||
       rows.some((x,i)=>x?.code!==freeze.codes[i]||x.tradeDate!==date||
         !OFFLINE_PAGE_COMPLETE.has(x.status)||
         (x.status==='DAILY_BAR'&&!validRawBar(x.bar,x.code,date))||
         (x.status==='NO_TRADE'&&x.bar!==null))||
       r.eligibleForForwardSignal!==false||
       r.providerRightsVerified!==false||
       !r.counts||typeof r.counts!=='object'||
       !Number.isInteger(r.structurallyUsableRawBars)||
       r.structurallyUsableRawBars!==rows.filter(x=>x.status==='DAILY_BAR').length||
       r.rawProviderRows<r.structurallyUsableRawBars+rows.filter(x=>x.status==='NO_TRADE').length||
       Object.keys(r.counts).some(k=>r.counts[k]!==rows.filter(x=>x.status===k).length)||
       rows.some(x=>!Object.prototype.hasOwnProperty.call(r.counts,x.status)))
       state='PREVIOUS_AUDIT_INCOMPLETE';
     else {
       usableDailyBars=rows.filter(x=>x.status==='DAILY_BAR').length;
       noTradeCodes=rows.filter(x=>x.status==='NO_TRADE').length;
       state=noTradeCodes>0?'ARCHIVED_NO_TRADE_GAP':'ARCHIVED_OFFLINE_ONLY';
     }
   }
   const revisions=revisionByDate.get(date)??[];
   if(revisions.length>1||revisions.some(r=>
     r?.version!==MA75_PAGE_REVISION_VERSION||
     r.frozenPopulationSha256!==revisionPopulationHash||
     r.frozenCodes!==freeze.codes.length||
     r.structurallyConsistent!==true||r.revisionDetected!==false||
     !Array.isArray(r.issues)||r.issues.length>0))
     state='ARCHIVED_SOURCE_REVISION_REVIEW';
   // Close time does not imply provider release or live-source availability.
   if(clock<afterTseClose(date))state='SESSION_NOT_YET_CLOSED';
   else if(clock<dailyPublishTarget(date))state='WAIT_FOR_DAILY_PROVIDER_UPDATE';
   // As-of safeguards override all archived input even if its metadata claims success.
   if(state!=='ARCHIVED_NO_TRADE_GAP'&&state!=='ARCHIVED_OFFLINE_ONLY'){
     usableDailyBars=0;noTradeCodes=0;
   }
   days.push({date,state,previousAuditCount:prior.length,
     revisionReportCount:revisions.length,usableDailyBars,noTradeCodes});
 }
 const count=state=>days.filter(x=>x.state===state).length;
 const possibleRequests=days.filter(x=>[
   'REQUIRES_EXISTING_DATA_OR_FETCH','PREVIOUS_AUDIT_INCOMPLETE',
   'DUPLICATE_CAPTURE_REVIEW'
 ].includes(x.state)).length;
 const allArchived=days.every(x=>x.state==='ARCHIVED_OFFLINE_ONLY');
 const archivedUsableBars=days.reduce((n,d)=>n+d.usableDailyBars,0);
 const archivedNoTradeCells=days.reduce((n,d)=>n+d.noTradeCodes,0);
 const expectedCells=freeze.codes.length*sessions.length;
 return {
   version:MA75_ACQUISITION_PREFLIGHT_VERSION,
   frozenPopulation:freeze.codes.length,
   expectedCodeSessionCells:expectedCells,
   archivedUsableBarCells:archivedUsableBars,
   archivedNoTradeCells,
   unverifiedOrMissingBarCells:expectedCells-archivedUsableBars-archivedNoTradeCells,
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
     archivedNoTradeGap:count('ARCHIVED_NO_TRADE_GAP'),
     sourceRevisionReview:count('ARCHIVED_SOURCE_REVISION_REVIEW'),
     pendingFetch:count('REQUIRES_EXISTING_DATA_OR_FETCH'),
     incompleteExisting:count('PREVIOUS_AUDIT_INCOMPLETE'),
     duplicateExisting:count('DUPLICATE_CAPTURE_REVIEW'),
     notYetClosed:count('SESSION_NOT_YET_CLOSED'),
     waitingForProviderDailyUpdate:count('WAIT_FOR_DAILY_PROVIDER_UPDATE'),
     unexpectedAuditDates:unexpected.length,
     unexpectedRevisionDates:unexpectedRevisionDates.length,
   },
   unexpectedAuditDates:unexpected,
   unexpectedRevisionDates,
   dates:days,
   structuralHistoricalInputsPresent:allArchived&&unexpected.length===0&&
     unexpectedRevisionDates.length===0,
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
     'A complete page containing NO_TRADE is archived but insufficient for that symbol to compute the full SMA75; do not retry it blindly or count it as complete.',
     'Archived page revisions for a frozen code-day require independent manual review and cannot silently overwrite earlier study inputs.',
     'Even 76 archived page audits cannot prove original provider capture, data license, trading calendar or corporate-action treatment.',
   ],
 };
}
