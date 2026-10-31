/**
 * SHADOW ONLY: offline integrity check of an already acquired J-Quants
 * /v2/markets/calendar response for 76 declared TSE stock sessions.
 * This verifies contiguous CALENDAR-DATE coverage, not genuine provider
 * origin, original availability time, exchange announcements or licensing.
 *
 * HolDiv 0: non-business; 1: normal TSE/OSE business;
 * 2: TSE half-day; 3: derivatives holiday trading, TSE equity CLOSED.
 */
export const MA75_TSE_CALENDAR_AUDIT_VERSION='ma75_tse_calendar_offline_v1';
const validDate=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&
 Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const stamp=s=>typeof s==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(s)?Date.parse(s):NaN;
const trading=new Set(['1','2']);
const values=new Set(['0','1','2','3']);
const dateRange=(a,b)=>{
 const list=[];
 const start=Date.parse(a+'T00:00:00Z'),end=Date.parse(b+'T00:00:00Z');
 for(let t=start;t<=end;t+=86400000)list.push(new Date(t).toISOString().slice(0,10));
 return list;
};
export function auditMa75TseCalendar({
 sessions,records,requestFrom,requestTo,capturedAt
}={}){
 if(!Array.isArray(sessions)||sessions.length!==76||
   sessions.some((s,i)=>!validDate(s)||(i>0&&s<=sessions[i-1]))||
   requestFrom!==sessions[0]||requestTo!==sessions.at(-1)||
   !Array.isArray(records)||!Number.isFinite(stamp(capturedAt)))
   throw new TypeError('Expected exact 76 ordered sessions and explicit range/receipt');
 const calendarDates=dateRange(requestFrom,requestTo);
 const received=new Map(),duplicates=new Set(),outOfRange=[],invalidCodes=[];
 for(const row of records){
  const date=row?.Date;
  if(!validDate(date)||date<requestFrom||date>requestTo){
   outOfRange.push(String(date??'?'));continue;
  }
  if(received.has(date)){duplicates.add(date);continue}
  const division=row?.HolDiv;
  if(!values.has(division))invalidCodes.push(date);
  received.set(date,division);
 }
 const missingDates=calendarDates.filter(d=>!received.has(d));
 const tseTradingSessions=calendarDates.filter(d=>trading.has(received.get(d)));
 const claimedMatch=tseTradingSessions.length===sessions.length&&
  tseTradingSessions.every((d,i)=>d===sessions[i]);
 const issues=[];
 if(outOfRange.length)issues.push('EXTRA_OR_INVALID_CALENDAR_DATE');
 if(duplicates.size)issues.push('DUPLICATE_CALENDAR_DATE');
 if(invalidCodes.length)issues.push('INVALID_HOLDIV_CLASS');
 if(missingDates.length)issues.push('MISSING_CALENDAR_DATE');
 if(!claimedMatch)issues.push('TSE_SESSION_LIST_MISMATCH');
 return {
  version:MA75_TSE_CALENDAR_AUDIT_VERSION,
  requestFrom,requestTo,capturedAt,
  claimedSessions:[...sessions],
  calendarDateCount:calendarDates.length,
  validTseSessionCount:tseTradingSessions.length,
  nonTseDates:calendarDates.filter(d=>!trading.has(received.get(d))).length,
  missingDates,duplicateDates:[...duplicates].sort(),outOfRange,
  invalidCodes,issues,structuralCalendarPass:issues.length===0,
  independentlyAuthenticatedSource:false,
  pointInTimeCalendarAvailabilityVerified:false,
  officialProviderTimestampAvailable:false,
  eligibleForProduction:false,eligibleForNotifications:false,
  warnings:[
   'HolDiv=3 is OSE holiday trading, not a TSE equity session.',
   'Provider calendar has no per-record revision ID, public release timestamp or immutable vendor signature.',
   'Even an exact structural 76-session match is not proof of authentic point-in-time provider origin.',
  ],
 };
}
