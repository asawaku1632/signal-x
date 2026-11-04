/**
 * SHADOW ONLY: detect changes between TWO already-captured, date-complete
 * J-Quants TSE calendar responses. No network, keys, DB writes or promotion.
 * A local hash proves only that submitted snapshots differ.
 */
import {createHash} from 'node:crypto';
import {auditMa75TseCalendar} from './ma75TseCalendarAudit.mjs';
export const MA75_TSE_CALENDAR_REVISION_VERSION='ma75_tse_calendar_revision_v1';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function fingerprintMa75CalendarSessions(sessions){
 if(!Array.isArray(sessions)||sessions.length!==76||
    sessions.some((d,i)=>typeof d!=='string'||(i>0&&d<=sessions[i-1])))
   throw new TypeError('Require ordered frozen 76-session identity');
 return digest(sessions);
}
export function auditMa75TseCalendarRevisions({sessions,previous,current}={}){
 const identity=fingerprintMa75CalendarSessions(sessions);
 if(!previous||!current)throw new TypeError('Both original and subsequent calendars required');
 // Deliberately overwrite any snapshot-owned sessions fields.
 const before=auditMa75TseCalendar({...previous,sessions});
 const after=auditMa75TseCalendar({...current,sessions});
 const map=x=>new Map(x.records.map(r=>[r.Date,r.HolDiv]));
 const old=map(previous),latest=map(current);
 const union=[...new Set([...old.keys(),...latest.keys()])].sort();
 const changedDates=union.filter(date=>old.get(date)!==latest.get(date));
 const receiptChanged=previous.capturedAt!==current.capturedAt;
 const payload=a=>({requestFrom:a.requestFrom,requestTo:a.requestTo,
  capturedAt:a.capturedAt,
  records:a.records.map(r=>({Date:r.Date,HolDiv:r.HolDiv}))
    .sort((x,y)=>x.Date.localeCompare(y.Date))});
 const previousSha256=digest(payload(previous)),currentSha256=digest(payload(current));
 const revisionDetected=previousSha256!==currentSha256;
 const issues=[
   ...before.issues.map(reason=>({side:'PREVIOUS',reason})),
   ...after.issues.map(reason=>({side:'CURRENT',reason}))
 ];
 if(changedDates.length)issues.push({side:'BOTH',reason:'CALENDAR_DATE_CLASSIFICATION_CHANGED'});
 if(receiptChanged)issues.push({side:'BOTH',reason:'CALENDAR_RECEIPT_CHANGED'});
 if(revisionDetected&&!changedDates.length&&!receiptChanged)
   issues.push({side:'BOTH',reason:'CALENDAR_METADATA_OR_ROW_REVISION'});
 return {
  version:MA75_TSE_CALENDAR_REVISION_VERSION,
  sessionsSha256:identity,
  requestFrom:sessions[0],requestTo:sessions.at(-1),
  previousSha256,currentSha256,
  changedDates,changedDateCount:changedDates.length,
  receiptChanged,revisionDetected,
  structurallyConsistent:issues.length===0,issues,
  independentlyAuthenticatedSource:false,
  approvedToOverwriteOriginal:false,
  eligibleForProduction:false,eligibleForNotifications:false,
  note:'This identifies submitted calendar differences, not the origin or authenticity of exchange records.',
 };
}
