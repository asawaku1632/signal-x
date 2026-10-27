import test from 'node:test';
import assert from 'node:assert/strict';
import { compareForwardResults } from '../../app/lib/learning/compareForwardResults.mjs';
const capture = {scan_run_id:'r1', code:'590A', capture_status:'ASOF_VERIFIED',provenance_verified:true,scan_received_at:'2026-10-27T06:35:00Z',source_bar_at:'2026-10-27T06:30:00Z',features_computed_at:'2026-10-27T06:31:00Z',ai_power:75};
const outcome = {scan_run_id:'r1',code:'590A',independent_source_verified:true,observed_at:'2026-11-04T06:30:00Z',return_pct:2.4,horizon_days:5,outcome_version:'forward-v1'};
test('accepts only independently verified future result',()=>assert.equal(compareForwardResults([capture],[outcome]).accepted.length,1));
for (const [name, cap, out, reason] of [
 ['quarantined', {...capture,capture_status:'QUARANTINED'},outcome,'UNVERIFIED_CAPTURE'],
 ['missing provenance', {...capture,provenance_verified:false},outcome,'UNVERIFIED_CAPTURE'],
 ['future feature', {...capture,features_computed_at:'2026-10-28T06:31:00Z'},outcome,'INVALID_ASOF_TIMING'],
 ['future bar', {...capture,source_bar_at:'2026-10-28T06:31:00Z'},outcome,'INVALID_ASOF_TIMING'],
 ['missing result',capture,null,'MISSING_OR_AMBIGUOUS_OUTCOME'],
 ['same-time outcome',capture,{...outcome,observed_at:capture.scan_received_at},'UNVERIFIED_FUTURE_OUTCOME'],
 ['unverified outcome',capture,{...outcome,independent_source_verified:false},'UNVERIFIED_FUTURE_OUTCOME'],
 ['wrong horizon',capture,{...outcome,horizon_days:1},'MISMATCHED_HORIZON'],
 ['wrong version',capture,{...outcome,outcome_version:'legacy'},'MISMATCHED_HORIZON'],
]) test(name,()=>assert.equal(compareForwardResults([cap],out?[out]:[]).rejected[0].reason,reason));
test('duplicate outcomes fail closed',()=>assert.equal(compareForwardResults([capture],[outcome,outcome]).rejected[0].reason,'MISSING_OR_AMBIGUOUS_OUTCOME'));
