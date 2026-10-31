import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMa75TseCalendar} from '../app/lib/research/ma75TseCalendarAudit.mjs';

const days=()=>{
 const output=[];
 for(let i=Date.parse('2026-07-01T00:00:00Z');i<=Date.parse('2026-11-04T00:00:00Z');i+=86400000){
  const d=new Date(i);
  if(d.getUTCDay()!==0&&d.getUTCDay()!==6)output.push(d.toISOString().slice(0,10));
 }
 return output.slice(-76);
};
const calendar=()=>{
 const s=days(),from=s[0],to=s.at(-1);
 const records=[];
 for(let d=Date.parse(from+'T00:00:00Z');d<=Date.parse(to+'T00:00:00Z');d+=86400000){
  const date=new Date(d),ds=date.toISOString().slice(0,10);
  records.push({Date:ds,HolDiv:date.getUTCDay()===0||date.getUTCDay()===6?'0':'1'});
 }
 return {sessions:s,requestFrom:from,requestTo:to,
   capturedAt:'2026-11-01T06:00:00Z',records};
};
test('76 consecutive claimed TSE weekday sessions pass with every calendar date covered',()=>{
 const r=auditMa75TseCalendar(calendar());
 assert.equal(r.structuralCalendarPass,true);
 assert.equal(r.validTseSessionCount,76);
 assert.equal(r.claimedSessions.length,76);
 assert.equal(r.independentlyAuthenticatedSource,false);
 assert.equal(r.pointInTimeCalendarAvailabilityVerified,false);
 assert.equal(r.eligibleForProduction,false);
});
test('OSE holiday-trading classification 3 cannot count as a TSE equity trading day',()=>{
 const f=calendar();
 const holiday=f.sessions[20];
 f.records.find(x=>x.Date===holiday).HolDiv='3';
 const r=auditMa75TseCalendar(f);
 assert.equal(r.structuralCalendarPass,false);
 assert.ok(r.issues.includes('TSE_SESSION_LIST_MISMATCH'));
 assert.equal(r.validTseSessionCount,75);
});
test('TSE half-day classification 2 remains a legitimate stock trading day',()=>{
 const f=calendar();
 f.records.find(x=>x.Date===f.sessions[5]).HolDiv='2';
 assert.equal(auditMa75TseCalendar(f).structuralCalendarPass,true);
});
test('one missing holiday calendar day fails even if all 76 claimed trading dates are present',()=>{
 const f=calendar();const index=f.records.findIndex(x=>x.HolDiv==='0');
 f.records.splice(index,1);
 const r=auditMa75TseCalendar(f);
 assert.equal(r.structuralCalendarPass,false);
 assert.ok(r.issues.includes('MISSING_CALENDAR_DATE'));
 assert.equal(r.missingDates.length,1);
});
test('duplicate date or unexpected date cannot be silently consumed',()=>{
 const f=calendar();f.records.push({...f.records[0]});
 const r=auditMa75TseCalendar(f);
 assert.equal(r.structuralCalendarPass,false);
 assert.ok(r.issues.includes('DUPLICATE_CALENDAR_DATE'));
 const g=calendar();g.records.push({Date:'2027-02-04',HolDiv:'1'});
 assert.ok(auditMa75TseCalendar(g).issues.includes('EXTRA_OR_INVALID_CALENDAR_DATE'));
});
test('reject ambiguous unknown HolDiv and reordered or changed stock sessions',()=>{
 const f=calendar();f.records[20].HolDiv='9';
 const r=auditMa75TseCalendar(f);
 assert.ok(r.issues.includes('INVALID_HOLDIV_CLASS'));
 const g=calendar();
 g.sessions[5]='2026-11-01';
 assert.throws(()=>auditMa75TseCalendar(g),TypeError);
});
test('receipt, exact declared range, and 76 unique sessions are mandatory',()=>{
 const f=calendar();delete f.capturedAt;
 assert.throws(()=>auditMa75TseCalendar(f),TypeError);
 const g=calendar();g.requestTo='2026-11-05';
 assert.throws(()=>auditMa75TseCalendar(g),TypeError);
 const h=calendar();h.sessions.pop();
 assert.throws(()=>auditMa75TseCalendar(h),TypeError);
});
