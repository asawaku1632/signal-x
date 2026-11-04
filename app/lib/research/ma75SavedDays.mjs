/**
 * SHADOW ONLY: audit existing private original daily capture files one by one.
 * Never fetch, save market data, use keys, update DB, score, or notify.
 */
import {validateMa75FrozenUniverse} from './ma75FrozenUniverse.mjs';
import {projectMa75FullDateSource} from './ma75FullDateProjection.mjs';
import {auditMa75JQuantsDailyWindow} from './ma75JQuantsWindowAudit.mjs';
export const MA75_SAVED_DAYS_VERSION='ma75_saved_days_audit_v1';
const stamp=x=>typeof x==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(x)?Date.parse(x):NaN;
const day=x=>typeof x==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
/** load(file) must return a saved, originally captured ONE-DATE payload. */
export function auditMa75SavedDays(freeze,{sessions,entries=[],calendar,asOf,load}={}){
 validateMa75FrozenUniverse(freeze);
 if(!Array.isArray(sessions)||sessions.length!==76||
  sessions.some((d,i)=>!day(d)||(i>0&&d<=sessions[i-1]))||
  sessions[75]<freeze.firstEligibleSignalDate||!Array.isArray(entries)||
  entries.length>76||typeof load!=='function')
  throw new TypeError('INVALID_76_DAY_AUDIT_MANIFEST');
 const asOfMs=stamp(asOf);
 if(!Number.isFinite(asOfMs)||asOfMs<Date.parse(freeze.frozenAt)||
  asOfMs<Date.parse(sessions[75]+'T07:30:00Z'))
  throw new TypeError('FUTURE_OR_MISSING_ASOF_CLOCK');
 if(calendar!=null&&(!Number.isFinite(stamp(calendar.capturedAt))||
  stamp(calendar.capturedAt)>asOfMs))
  throw new TypeError('FUTURE_OR_UNDATED_TSE_CALENDAR');
 const days=new Set(sessions),usedDates=new Set(),usedFiles=new Set();
 const audits=[],totals={sourceRows:0,frozenRows:0,otherRows:0,pages:0};
 for(const entry of entries){
  if(!days.has(entry?.date)||usedDates.has(entry.date)||
   typeof entry.file!=='string'||!entry.file||usedFiles.has(entry.file))
   throw new TypeError('DUPLICATE_OR_FOREIGN_SAVED_DAY');
  usedDates.add(entry.date);usedFiles.add(entry.file);
  const src=load(entry.file);
  if(src?.version!=='ma75_one_date_original_capture_v1'||
   src.date!==entry.date||src.requestScope!=='ALL_LISTED_ONE_DATE'||
   src.completeProviderPagination!==true||
   src.eligibleForProduction!==false||src.eligibleForNotifications!==false||
   !Array.isArray(src.pages)||src.pages.length<1||src.pages.length>12||
   src.pages.some(p=>!Number.isFinite(stamp(p?.receivedAt))||
    stamp(p.receivedAt)>asOfMs))
   throw new TypeError('INVALID_OR_FUTURE_SAVED_CAPTURE');
  const p=projectMa75FullDateSource(freeze,{date:entry.date,pages:src.pages});
  if(!p.completeProviderPagination||p.audit.failures.length||
   src.originalProviderRows!==p.originalAllListedRows||
   src.frozenRows!==p.projectedFrozenRows||
   src.outsideFrozenRows!==p.excludedUnselectedListingRows||
   p.audit.rows.some(x=>['INVALID_OHLCV','DUPLICATE_CODE_DATE','BLOCKED_PAGINATION'].includes(x.status)))
   throw new TypeError('SAVED_CAPTURE_FAILED_ORIGINAL_SOURCE_AUDIT');
  audits.push(p.audit);
  totals.sourceRows+=p.originalAllListedRows;
  totals.frozenRows+=p.projectedFrozenRows;
  totals.otherRows+=p.excludedUnselectedListingRows;
  totals.pages+=src.pages.length;
 }
 const result=auditMa75JQuantsDailyWindow(freeze,{
  sessions,reports:audits,calendarSnapshot:calendar??null
 });
 const ready=result.structuralCoverageComplete===true;
 return {
  version:MA75_SAVED_DAYS_VERSION,auditAsOf:new Date(asOfMs).toISOString(),
  frozenCodes:freeze.codes.length,expectedDates:76,
  expectedFrozenCodeDates:freeze.codes.length*76,
  examinedDateFiles:entries.length,missingDates:result.missingSessions,
  invalidDayReports:result.invalidReports,calendarIssues:result.calendarIssues,
  calendarStructuralPass:result.calendarStructuralPass,sourceCounts:totals,
  stockStatusCounts:result.counts,structuralHistoricalCoverageComplete:ready,
  hypotheticalCrossoverCount:ready?(result.counts.BREAKOUT_OFFLINE_ONLY??0):null,
  validatedForwardReturns:0,validatedWinRate:null,
  independentlyVerifiedProviderRights:false,
  independentlyAuthenticatedOriginalCapture:false,
  eligibleForNotifications:false,eligibleForProduction:false,
  eligibleForAIPowerScoring:false,eligibleForTrading:false
 };
}
