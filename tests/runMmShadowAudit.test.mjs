import test from 'node:test';
import assert from 'node:assert/strict';
import { runMmShadowAudit as audit } from '../app/lib/research/runMmShadowAudit.mjs';

const days=['2026-09-18','2026-09-19','2026-09-20','2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27','2026-09-28','2026-09-29','2026-09-30'];
const sessions=['2026-09-18','2026-09-24','2026-09-25','2026-09-28','2026-09-29','2026-09-30'];
const fixture=()=>({
  calendarRows:days.map(Date=>({Date,HolDiv:sessions.includes(Date)?'1':'0'})),
  calendarFrom:days[0],calendarTo:days.at(-1),sourceVerified:true,responseComplete:true,
  observations:[{code:'3762',tradeDate:days[0],storedResult1d:0,storedResult3d:6,storedResult5d:6}],
  stockClosesByCode:new Map([['3762',new Map(sessions.map((d,i)=>[d,100+2*i]))]]),
  indexCloses:new Map(),asOfDate:'2026-10-01',
});
test('as-of date may follow complete calendar end',()=>{
 const r=audit(fixture());
 assert.equal(r.status,'RESEARCH_ONLY');
 assert.equal(r.sessionCount,6);
 assert.equal(r.rows[0].horizons[5].sessionDate,'2026-09-30');
 assert.equal(r.summary.horizons[5].changed,1);
 assert.equal(r.notificationEligible,false);
});
test('unverified source blocks before comparison',()=>{
 assert.equal(audit({...fixture(),sourceVerified:false}).status,'BLOCKED');
});
test('calendar gaps block',()=>{
 const f=fixture();f.calendarRows=f.calendarRows.slice(1);
 assert.equal(audit(f).reason,'INCOMPLETE_CALENDAR_RANGE');
});
test('holiday observation blocks',()=>{
 const f=fixture();f.observations[0].tradeDate='2026-09-21';
 assert.equal(audit(f).reason,'OBSERVATION_NOT_TSE_SESSION');
});
test('future horizon is pending',()=>{
 const r=audit({...fixture(),asOfDate:'2026-09-29'});
 assert.equal(r.rows[0].horizons[5].status,'PENDING');
});
test('missing input blocks',()=>{
 assert.equal(audit({...fixture(),stockClosesByCode:null}).status,'BLOCKED');
});
test('reject as-of on or before start',()=>{
 assert.equal(audit({...fixture(),asOfDate:'2026-09-18'}).reason,'AS_OF_OUTSIDE_CALENDAR');
});
test('reject observations outside requested calendar',()=>{
 const f=fixture();f.observations[0].tradeDate='2026-10-01';
 assert.equal(audit(f).reason,'OBSERVATION_OUTSIDE_CALENDAR');
});

test('invalid as-of dates are rejected before research comparison',()=>{
 for(const asOfDate of ['2026-99-99','2026-02-30','nonsense','2026-10-01x']) {
  assert.equal(audit({...fixture(),asOfDate}).reason,'AS_OF_OUTSIDE_CALENDAR');
 }
});

test('invalid observation dates are rejected before comparison',()=>{
 for(const tradeDate of ['2026-02-30','2026-99-99','bad-date']) {
  const f=fixture();f.observations[0].tradeDate=tradeDate;
  assert.equal(audit(f).reason,'INVALID_OBSERVATION');
 }
});

test('future observation relative to as-of blocks entire audit',()=>{
 const f=fixture();
 f.observations[0].tradeDate='2026-09-24';
 f.asOfDate='2026-09-22';
 const r=audit(f);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,'OBSERVATION_NOT_BEFORE_AS_OF');
 assert.equal(r.notificationEligible,false);
});
