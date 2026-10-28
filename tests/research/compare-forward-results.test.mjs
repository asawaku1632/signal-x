import test from 'node:test';
import assert from 'node:assert/strict';
import { compareForwardResults } from '../../app/lib/learning/compareForwardResults.mjs';
const capture = {scan_run_id:'r1', code:'590A', capture_status:'ASOF_VERIFIED',provenance_verified:true,scan_received_at:'2026-10-27T06:35:00Z',source_bar_at:'2026-10-27T06:30:00Z',features_computed_at:'2026-10-27T06:31:00Z',ai_power:75};
const outcome = {scan_run_id:'r1',code:'590A',independent_source_verified:true,observed_at:'2026-11-04T06:30:00Z',return_pct:2.4,horizon_days:5,horizon_verified:true,outcome_version:'forward-v1',verified_session_dates:['2026-10-28','2026-10-29','2026-10-30','2026-11-02','2026-11-04']};
test('accepts only independently verified future result',()=>assert.equal(compareForwardResults([capture],[outcome]).accepted.length,1));
for (const [name, cap, out, reason] of [
 ['quarantined', {...capture,capture_status:'QUARANTINED'},outcome,'UNVERIFIED_CAPTURE'],
 ['missing provenance', {...capture,provenance_verified:false},outcome,'UNVERIFIED_CAPTURE'],
 ['future feature', {...capture,features_computed_at:'2026-10-28T06:31:00Z'},outcome,'INVALID_ASOF_TIMING'],
 ['future bar', {...capture,source_bar_at:'2026-10-28T06:31:00Z'},outcome,'INVALID_ASOF_TIMING'],
 ['missing result',capture,null,'MISSING_OR_AMBIGUOUS_OUTCOME'],
 ['same-time outcome',capture,{...outcome,observed_at:capture.scan_received_at},'UNVERIFIED_FUTURE_OUTCOME'],
 ['unverified outcome',capture,{...outcome,independent_source_verified:false},'UNVERIFIED_FUTURE_OUTCOME'],
 ['unverified horizon',capture,{...outcome,horizon_verified:false},'MISMATCHED_HORIZON'],
 ['wrong horizon',capture,{...outcome,horizon_days:1},'MISMATCHED_HORIZON'],
 ['wrong version',capture,{...outcome,outcome_version:'legacy'},'MISMATCHED_HORIZON'],
]) test(name,()=>assert.equal(compareForwardResults([cap],out?[out]:[]).rejected[0].reason,reason));
test('duplicate outcomes fail closed',()=>assert.equal(compareForwardResults([capture],[outcome,outcome]).rejected[0].reason,'MISSING_OR_AMBIGUOUS_OUTCOME'));

test('invalid scores are rejected before forward outcome analysis',()=>{
 for(const score of [Number.POSITIVE_INFINITY,Number.NaN,-1,101,undefined]){
  const result=compareForwardResults([{...capture,ai_power:score}],[outcome]);
  assert.equal(result.accepted.length,0);
  assert.equal(result.rejected[0].reason,'INVALID_AI_POWER');
 }
});

test('duplicate captures cannot multiply performance results',()=>{
 const result=compareForwardResults([capture,{...capture}],[outcome]);
 assert.equal(result.accepted.length,0);
 assert.deepEqual(result.rejected.map(x=>x.reason),['DUPLICATE_CAPTURE','DUPLICATE_CAPTURE']);
});

test('five calendar days are not proof of five trading sessions',()=>{
 const result=compareForwardResults([capture],[{...outcome,verified_session_dates:undefined}]);
 assert.equal(result.accepted.length,0);
 assert.equal(result.rejected[0].reason,'MISSING_VERIFIED_TRADING_SESSIONS');
});
for(const [name,dates] of [
 ['too few',['2026-10-28','2026-10-29','2026-10-30','2026-11-02']],
 ['duplicate',['2026-10-28','2026-10-29','2026-10-29','2026-11-02','2026-11-04']],
 ['out of order',['2026-10-29','2026-10-28','2026-10-30','2026-11-02','2026-11-04']],
 ['wrong last date',['2026-10-28','2026-10-29','2026-10-30','2026-11-02','2026-11-05']],
 ['invalid date',['2026-02-30','2026-10-29','2026-10-30','2026-11-02','2026-11-04']],
]) test(name,()=>{
 const result=compareForwardResults([capture],[{...outcome,verified_session_dates:dates}]);
 assert.equal(result.accepted.length,0);
 assert.equal(result.rejected[0].reason,'MISSING_VERIFIED_TRADING_SESSIONS');
});

test('JPX 2026 holiday cannot be counted as a trading session',()=>{
 const dates=['2026-10-28','2026-10-29','2026-10-30','2026-11-02','2026-11-03'];
 const result=compareForwardResults([capture],[{...outcome,observed_at:'2026-11-03T06:30:00Z',verified_session_dates:dates}]);
 assert.equal(result.accepted.length,0);
 assert.equal(result.rejected[0].reason,'JPX_SESSION_CALENDAR_MISMATCH');
});
test('five sequential but incorrect weekday dates are rejected',()=>{
 const dates=['2026-10-29','2026-10-30','2026-11-02','2026-11-04','2026-11-05'];
 const result=compareForwardResults([capture],[{...outcome,observed_at:'2026-11-05T06:30:00Z',verified_session_dates:dates}]);
 assert.equal(result.rejected[0].reason,'JPX_SESSION_CALENDAR_MISMATCH');
});

test('2027 JPX cross-year five-session result is accepted only with verified provenance',()=>{
 const yearEndCapture={...capture,scan_received_at:'2026-12-29T06:35:00Z',
   source_bar_at:'2026-12-29T06:30:00Z',features_computed_at:'2026-12-29T06:31:00Z'};
 const yearEndOutcome={...outcome,observed_at:'2027-01-07T06:30:00Z',
   verified_session_dates:['2026-12-30','2027-01-04','2027-01-05','2027-01-06','2027-01-07']};
 assert.equal(compareForwardResults([yearEndCapture],[yearEndOutcome]).accepted.length,1);
 assert.equal(compareForwardResults([{...yearEndCapture,provenance_verified:false}],[yearEndOutcome]).accepted.length,0);
});
test('invented 2027 January holiday session cannot pass as five sessions',()=>{
 const yearEndCapture={...capture,scan_received_at:'2026-12-29T06:35:00Z',
   source_bar_at:'2026-12-29T06:30:00Z',features_computed_at:'2026-12-29T06:31:00Z'};
 const bad={...outcome,observed_at:'2027-01-06T06:30:00Z',
   verified_session_dates:['2026-12-30','2027-01-01','2027-01-04','2027-01-05','2027-01-06']};
 const result=compareForwardResults([yearEndCapture],[bad]);
 assert.equal(result.accepted.length,0);
 assert.equal(result.rejected[0].reason,'JPX_SESSION_CALENDAR_MISMATCH');
});
