/**
 * SHADOW ONLY. Consume already captured original J-Quants daily date pages.
 * No fetch, DB, token, vendor entitlement, scoring, job, trade or notification.
 * Original page envelopes must retain request pagination keys and receivedAt.
 */
import {validateMa75FrozenUniverse} from './ma75FrozenUniverse.mjs';
import {parseMa75JQuantsDailyPages} from './ma75JQuantsDailyPages.mjs';
import {auditMa75JQuantsDailyWindow} from './ma75JQuantsWindowAudit.mjs';

export const MA75_ORIGINAL_DAILY_BUNDLE_VERSION='ma75_original_daily_bundle_v1';
const DATE=/^20\d{2}-\d{2}-\d{2}$/;
const validDate=value=>typeof value==='string'&&DATE.test(value)&&
 Number.isFinite(Date.parse(value+'T00:00:00Z'))&&
 new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

export function auditMa75OriginalDailyBundle(freeze,bundle){
 validateMa75FrozenUniverse(freeze);
 if(!bundle||typeof bundle!=='object'||Array.isArray(bundle)||
    bundle.schemaVersion!==MA75_ORIGINAL_DAILY_BUNDLE_VERSION||
    !Array.isArray(bundle.sessions)||bundle.sessions.length!==76||
    bundle.sessions.some((d,i)=>!validDate(d)||(i>0&&d<=bundle.sessions[i-1]))||
    bundle.sessions.at(-1)<freeze.firstEligibleSignalDate||
    !Array.isArray(bundle.dayPages)||bundle.dayPages.length>76)
  throw new TypeError('Require original-page bundle with exactly 76 ordered sessions and at most 76 dated captures');
 const allowedDates=new Set(bundle.sessions),seen=new Set(),reports=[];
 for(const entry of bundle.dayPages){
  const date=entry?.date,pages=entry?.pages;
  if(!validDate(date)||!allowedDates.has(date)||seen.has(date)||
    !Array.isArray(pages)||pages.length<1||pages.length>50||
    pages.some(p=>!p||!Array.isArray(p.response?.data)||p.response.data.length>10000))
   throw new TypeError('Duplicate, foreign or oversized original date-page capture');
  seen.add(date);
  // Never accept a user-authored summary in place of original provider envelopes.
  reports.push(parseMa75JQuantsDailyPages(freeze,{date,pages,requestedCode:null}));
 }
 const audit=auditMa75JQuantsDailyWindow(freeze,{
  sessions:bundle.sessions,reports,
  calendarSnapshot:bundle.calendarSnapshot??null,
  calendarRevisionAudit:bundle.calendarRevisionAudit,
 });
 const complete=audit.structuralCoverageComplete===true;
 return {
  version:MA75_ORIGINAL_DAILY_BUNDLE_VERSION,
  freezeSize:freeze.codes.length,firstEligibleDate:freeze.firstEligibleSignalDate,
  studySignalDate:bundle.sessions.at(-1),requiredSessions:76,
  submittedDateCaptures:reports.length,missingDateCaptures:audit.missingSessions,
  originalProviderRowsRecorded:reports.reduce((sum,r)=>sum+r.rawProviderRows,0),
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
