import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMa75TseCalendarRevisions,fingerprintMa75CalendarSessions}
 from '../app/lib/research/ma75TseCalendarRevisions.mjs';

const fixture=()=>{
 const sessionDates=[];
 for(let t=Date.parse('2026-11-04T00:00:00Z');sessionDates.length<76;t-=86400000){
   const d=new Date(t);
   if(d.getUTCDay()!==0&&d.getUTCDay()!==6&&d.toISOString().slice(0,10)!=='2026-11-03')
     sessionDates.unshift(d.toISOString().slice(0,10));
 }
 const set=new Set(sessionDates),records=[];
 for(let t=Date.parse(sessionDates[0]+'T00:00:00Z');
   t<=Date.parse(sessionDates.at(-1)+'T00:00:00Z');t+=86400000){
  const d=new Date(t).toISOString().slice(0,10);
  records.push({Date:d,HolDiv:set.has(d)?'1':'0'});
 }
 const previous={requestFrom:sessionDates[0],requestTo:sessionDates.at(-1),
   capturedAt:'2026-11-05T08:00:00Z',records};
 const current=JSON.parse(JSON.stringify(previous));
 return {sessions:sessionDates,previous,current};
};
const audit=x=>auditMa75TseCalendarRevisions(x);
test('unchanged full raw TSE calendar has stable fingerprints but does not prove source license',()=>{
 const p=fixture(),r=audit(p);
 assert.equal(r.structurallyConsistent,true);
 assert.equal(r.revisionDetected,false);
 assert.equal(r.changedDateCount,0);
 assert.match(r.previousSha256,/^[0-9a-f]{64}$/);
 assert.equal(r.previousSha256,r.currentSha256);
 assert.equal(r.sessionsSha256,fingerprintMa75CalendarSessions(p.sessions));
 assert.equal(r.independentlyAuthenticatedSource,false);
 assert.equal(r.approvedToOverwriteOriginal,false);
});
test('a corrected stock session marked OSE holiday becomes a quarantined calendar change',()=>{
 const p=fixture(),target=p.sessions[20];
 p.current.records.find(x=>x.Date===target).HolDiv='3';
 const r=audit(p);
 assert.equal(r.structurallyConsistent,false);
 assert.equal(r.revisionDetected,true);
 assert.deepEqual(r.changedDates,[target]);
 assert.ok(r.issues.some(x=>x.reason==='CALENDAR_DATE_CLASSIFICATION_CHANGED'));
 assert.ok(r.issues.some(x=>x.reason==='TSE_SESSION_LIST_MISMATCH'));
});
test('changed receipt timestamp is not silent evidence of original availability',()=>{
 const p=fixture();p.current.capturedAt='2026-11-08T08:00:00Z';
 const r=audit(p);
 assert.equal(r.receiptChanged,true);
 assert.equal(r.revisionDetected,true);
 assert.ok(r.issues.some(x=>x.reason==='CALENDAR_RECEIPT_CHANGED'));
});
test('missing original nontrade day or additional record must not pass source revision',()=>{
 const p=fixture();p.current.records.pop();
 const r=audit(p);
 assert.equal(r.structurallyConsistent,false);
 assert.ok(r.issues.some(x=>x.reason==='MISSING_CALENDAR_DATE'));
 const q=fixture();q.current.records.push(q.current.records[0]);
 assert.ok(audit(q).issues.some(x=>x.reason==='DUPLICATE_CALENDAR_DATE'));
});
test('original and revised calendars belong to the exact caller-defined 76 sessions',()=>{
 const p=fixture();
 p.current.sessions=['wrong','metadata','ignored'];
 const r=audit(p);
 assert.equal(r.structurallyConsistent,true);
 assert.equal(r.sessionsSha256,fingerprintMa75CalendarSessions(p.sessions));
 const bad=fixture();
 bad.sessions[0]=bad.sessions[1];
 assert.throws(()=>audit(bad),TypeError);
});
test('invalid or missing snapshot fails closed rather than becoming a clean history',()=>{
 const p=fixture();delete p.current.capturedAt;
 assert.throws(()=>audit(p),TypeError);
 const q=fixture();q.current.requestTo='2026-11-05';
 assert.throws(()=>audit(q),TypeError);
 assert.throws(()=>audit({...fixture(),previous:null}),TypeError);
});
