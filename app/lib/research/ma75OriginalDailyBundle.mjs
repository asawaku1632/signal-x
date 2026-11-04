/**
 * SHADOW ONLY. Consume already captured original J-Quants daily date pages.
 * No fetch, DB, token, vendor entitlement, scoring, job, trade or notification.
 * Original page envelopes must retain request pagination keys and receivedAt.
 */
import {validateMa75FrozenUniverse} from './ma75FrozenUniverse.mjs';
import {projectMa75FullDateSource} from './ma75FullDateProjection.mjs';
import {auditMa75JQuantsDailyWindow} from './ma75JQuantsWindowAudit.mjs';

export const MA75_ORIGINAL_DAILY_BUNDLE_VERSION='ma75_original_daily_bundle_v1';
const DATE=/^20\d{2}-\d{2}-\d{2}$/;
const validDate=value=>typeof value==='string'&&DATE.test(value)&&
 Number.isFinite(Date.parse(value+'T00:00:00Z'))&&
 new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

export function auditMa75OriginalDailyBundle(freeze,bundle,{asOf}={}){
 validateMa75FrozenUniverse(freeze);
 if(!bundle||typeof bundle!=='object'||Array.isArray(bundle)||
    bundle.schemaVersion!==MA75_ORIGINAL_DAILY_BUNDLE_VERSION||
    !Array.isArray(bundle.sessions)||bundle.sessions.length!==76||
    bundle.sessions.some((d,i)=>!validDate(d)||(i>0&&d<=bundle.sessions[i-1]))||
    bundle.sessions.at(-1)<freeze.firstEligibleSignalDate||
    !Array.isArray(bundle.dayPages)||bundle.dayPages.length>76)
  throw new TypeError('Require original-page bundle with exactly 76 ordered sessions and at most 76 dated captures');
 // An explicit as-of clock is mandatory. Archived JSON may claim future
 // capture times; never infer that those records existed on audit day.
 const asOfMillis=typeof asOf==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(asOf)?
  Date.parse(asOf):NaN;
 const releaseFloor=Date.parse(bundle.sessions.at(-1)+'T07:30:00Z');
 if(!Number.isFinite(asOfMillis)||asOfMillis<Date.parse(freeze.frozenAt)||
    asOfMillis<releaseFloor)
  throw new TypeError('HISTORICAL_SOURCE_WINDOW_NOT_PUBLISHED_AS_OF_AUDIT');
 const capturedMs=t=>typeof t==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(t)?
  Date.parse(t):NaN;
 if(bundle.calendarSnapshot!==undefined&&bundle.calendarSnapshot!==null){
  const calendarTime=capturedMs(bundle.calendarSnapshot.capturedAt);
  if(!Number.isFinite(calendarTime)||calendarTime>asOfMillis)
   throw new TypeError('TSE_CALENDAR_CAPTURE_IS_FUTURE_OR_UNDATED');
 }
 const allowedDates=new Set(bundle.sessions),seen=new Set(),reports=[],sourceProjections=[];
 for(const entry of bundle.dayPages){
  const date=entry?.date,pages=entry?.pages;
  if(!validDate(date)||!allowedDates.has(date)||seen.has(date)||
    !Array.isArray(pages)||pages.length<1||pages.length>50||
    pages.some(p=>!p||!Array.isArray(p.response?.data)||p.response.data.length>10000))
   throw new TypeError('Duplicate, foreign or oversized original date-page capture');
  if(pages.some(p=>{
   const receipt=capturedMs(p?.receivedAt);
   return !Number.isFinite(receipt)||receipt>asOfMillis;
  }))throw new TypeError('ORIGINAL_PAGE_RECEIPT_AFTER_AUDIT_ASOF');
  seen.add(date);
  // Never accept a user-authored summary in place of original provider envelopes.
  const projection=projectMa75FullDateSource(freeze,{date,pages});
  sourceProjections.push(projection);
  reports.push(projection.audit);
 }
 const audit=auditMa75JQuantsDailyWindow(freeze,{
  sessions:bundle.sessions,reports,
  calendarSnapshot:bundle.calendarSnapshot??null,
  calendarRevisionAudit:bundle.calendarRevisionAudit,
 });
 const complete=audit.structuralCoverageComplete===true;
 return {
  version:MA75_ORIGINAL_DAILY_BUNDLE_VERSION,
  auditAsOf: new Date(asOfMillis).toISOString(),
  historicalUpdateTimeIsEstimate:true,
  freezeSize:freeze.codes.length,firstEligibleDate:freeze.firstEligibleSignalDate,
  studySignalDate:bundle.sessions.at(-1),requiredSessions:76,
  submittedDateCaptures:reports.length,missingDateCaptures:audit.missingSessions,
  originalProviderRowsRecorded:sourceProjections.reduce((sum,r)=>sum+r.originalAllListedRows,0),
  projectedFrozenRowsRecorded:sourceProjections.reduce((sum,r)=>sum+r.projectedFrozenRows,0),
  excludedUnselectedListingRows:sourceProjections.reduce((sum,r)=>sum+r.excludedUnselectedListingRows,0),
  frozenProjectionNotOriginalSource:true,
  originalPagesRecorded:reports.reduce((sum,r)=>sum+r.readPages,0),
  expectedCodeSessionCells:freeze.codes.length*76,
  rejectedDateAudits:audit.invalidReports,
  duplicateDateAudits:audit.duplicateDates,
  unexpectedDateAudits:audit.unexpectedDates,
  calendarStructuralPass:audit.calendarStructuralPass,
  calendarIssues:audit.calendarIssues,
  structural76DayCoverage:complete,
  stockStatusCounts:audit.counts,
  // With an incomplete population, no winners-only candidate list or rate.
  hypotheticalOfflineCrossoverCount:complete?
   (audit.counts.BREAKOUT_OFFLINE_ONLY??0):null,
  historicalOnly:true,
  originalProviderRightsIndependentlyVerified:false,
  originalProviderAuthenticityIndependentlyVerified:false,
  pointInTimeAvailabilityVerified:false,
  corporateActionsIndependentlyVerified:false,
  validatedForwardWinRate:null,validatedForwardOutcomes:0,
  eligibleForAIPowerScoring:false,eligibleForNotifications:false,
  eligibleForTrading:false,eligibleForProduction:false,
  note:'Successful structural replay means retrospective mathematics only; it cannot establish vendor permission, point-in-time capture, future profitability or live buy signals.'
 };
}
