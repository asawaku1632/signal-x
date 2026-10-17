import test from "node:test";
import assert from "node:assert/strict";
import {expectedAuditTradingDates,auditBroadCohortQuality,
 BROAD_AUDIT_REQUIRED_DAYS} from "../app/lib/research/broadCohortAudit.mjs";
import {BROAD_SHADOW_SLOTS,BROAD_SHADOW_VERSION} from "../app/lib/research/broadCohortShadow.mjs";
const sessions=["2026-10-21","2026-10-20","2026-10-19","2026-10-16","2026-10-15"];
const trading=date=>!["2026-10-17","2026-10-18"].includes(date)&&
 new Date(date+"T00:00:00Z").getUTCDay()%6!==0;
const archive=(dates=sessions,valid=30)=>dates.flatMap(date=>BROAD_SHADOW_SLOTS.map(time_slot=>({
 trade_date:date,time_slot,policy_version:BROAD_SHADOW_VERSION,
 expected_count:30,observed_count:valid,missing:valid===30?[]:
 Array.from({length:30-valid},(_,i)=>({code:String(i+1000),reason:"QUOTE_OLD_OR_WRONG_DAY"}))
})));
test("market days start 2026-10-15, skip weekends and never count today's partial schedule",()=>{
 assert.deepEqual(expectedAuditTradingDates({now:"2026-10-14T19:00:00+09:00",isTradingDay:trading}),[]);
 assert.deepEqual(expectedAuditTradingDates({now:"2026-10-15T15:25:00+09:00",isTradingDay:trading}),[]);
 assert.deepEqual(expectedAuditTradingDates({now:"2026-10-15T15:41:00+09:00",isTradingDay:trading}),["2026-10-15"]);
 assert.deepEqual(expectedAuditTradingDates({now:"2026-10-21T20:00:00+09:00",isTradingDay:trading}),sessions);
});
test("zero records must never show healthy or empty-day green status",()=>{
 const state=auditBroadCohortQuality([],sessions);
 assert.equal(state.status,"QUALITY_GATE_BLOCKED");
 assert.equal(state.presentSlots,0);
 assert.equal(state.captureRate,0);
 assert.equal(state.expected,1050);
 assert.equal(state.days[0].missingSlots.length,7);
 assert.equal(state.nextPhaseAutomatic,false);
});
test("a complete 5-session top30 cohort can be reviewed but never auto expanded",()=>{
 const state=auditBroadCohortQuality(archive(),sessions);
 assert.equal(state.status,"READY_FOR_REVIEW");
 assert.equal(state.expected,1050);assert.equal(state.observed,1050);
 assert.equal(state.presentSlots,35);assert.equal(state.completeDays,5);
 assert.equal(state.nextPhaseAutomatic,false);
});
test("four completed sessions remain in collecting, not ready",()=>{
 const recent=sessions.slice(0,4);
 const state=auditBroadCohortQuality(archive(recent),recent);
 assert.equal(state.status,"COLLECTING");
 assert.equal(state.checkedSessions,4);
 assert.equal(state.completeDays,4);
});
test("partial 30/30 slot coverage and missing day are rejected without hiding missing reasons",()=>{
 const rows=archive();
 rows.splice(rows.findIndex(r=>r.trade_date==="2026-10-20"&&r.time_slot==="10:30"),1);
 const partial=rows.find(r=>r.trade_date==="2026-10-21"&&r.time_slot==="09:15");
 partial.observed_count=20;
 partial.missing=[{code:"3762",reason:"QUOTE_OLD_OR_WRONG_DAY"}];
 const state=auditBroadCohortQuality(rows,sessions);
 assert.equal(state.status,"QUALITY_GATE_BLOCKED");
 assert.equal(state.presentSlots,34);
 assert.ok(state.captureRate<100);
 assert.equal(state.missingReasonTotals.QUOTE_OLD_OR_WRONG_DAY,1);
 assert.deepEqual(state.days[1].missingSlots,["10:30"]);
});
test("even near-perfect observed percentage cannot pass with missing one slot",()=>{
 const rows=archive();
 rows.splice(rows.findIndex(r=>r.trade_date==="2026-10-19"&&r.time_slot==="15:15"),1);
 const state=auditBroadCohortQuality(rows,sessions);
 assert.equal(state.status,"QUALITY_GATE_BLOCKED");
 assert.equal(state.days[2].full,false);
});
test("95pct barrier blocks low-quality observations despite all rows being present",()=>{
 const state=auditBroadCohortQuality(archive(sessions,28),sessions);
 assert.equal(state.status,"QUALITY_GATE_BLOCKED");
 assert.equal(state.captureRate,28/30*100);
});
test("sparse below-30 previous-night cohort cannot pass readiness by 100% of fewer names",()=>{
 const rows=archive();for(const r of rows){r.expected_count=20;r.observed_count=20;}
 const state=auditBroadCohortQuality(rows,sessions);
 assert.ok(Math.abs(state.captureRate-20/30*100)<1e-9);
 assert.equal(state.status,"QUALITY_GATE_BLOCKED");
 assert.ok(state.days.every(d=>d.underTarget.length===7));
});
test("old policy rows and duplicate dates cannot inflate gate samples",()=>{
 const rows=archive();
 rows.push({...rows[0],policy_version:"OBSOLETE",observed_count:30});
 const state=auditBroadCohortQuality(rows,sessions);
 assert.equal(state.status,"READY_FOR_REVIEW");
 assert.throws(()=>auditBroadCohortQuality(rows,[...sessions,sessions[0]]),/INVALID_AUDIT_INPUT/);
});

test("a lone saved slot cannot masquerade as 100 percent coverage",()=>{
 const onlyOne=archive(sessions.slice(0,1)).slice(0,1);
 const state=auditBroadCohortQuality(onlyOne,sessions);
 assert.equal(state.expected,1050);
 assert.equal(state.observed,30);
 assert.equal(state.captureRate,30/1050*100);
 assert.equal(state.status,"QUALITY_GATE_BLOCKED");
 assert.equal(state.days[0].expected,210);
 assert.equal(state.days[0].observed,30);
 assert.equal(state.days[1].coverage,0);
});
