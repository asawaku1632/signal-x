import test from "node:test";
import assert from "node:assert/strict";
import { summarizeVerifiedForwardResearch as summarize } from "../../app/lib/learning/summarizeVerifiedForwardResearch.mjs";
const capture={scan_run_id:"r1",code:"590A",capture_status:"ASOF_VERIFIED",provenance_verified:true,
 scan_received_at:"2026-10-27T06:35:00Z",source_bar_at:"2026-10-27T06:30:00Z",
 features_computed_at:"2026-10-27T06:31:00Z",ai_power:75};
const outcome={scan_run_id:"r1",code:"590A",independent_source_verified:true,
 observed_at:"2026-11-04T06:30:00Z",return_pct:2.4,horizon_days:5,
 horizon_verified:true,outcome_version:"forward-v1",
 verified_session_dates:["2026-10-28","2026-10-29","2026-10-30","2026-11-02","2026-11-04"]};
test("no independently verified outcome yields no performance numbers",()=>{
 const x=summarize([capture],[]);
 assert.equal(x.status,"INSUFFICIENT_VERIFIED_DATA");
 assert.equal(x.accepted,0);assert.equal(x.rejected,1);
 assert.equal(x.mean_return_pct,null);assert.equal(x.median_return_pct,null);
 assert.equal(x.positive_rate_pct,null);assert.equal(x.eligible_for_live_ai,false);
 assert.equal(x.rejection_reasons.MISSING_OR_AMBIGUOUS_OUTCOME,1);
});
test("quarantined data cannot become a performance result",()=>{
 const x=summarize([{...capture,capture_status:"QUARANTINED"}],[outcome]);
 assert.equal(x.accepted,0);assert.equal(x.rejection_reasons.UNVERIFIED_CAPTURE,1);
});
test("verified forward result produces descriptive numbers only",()=>{
 const x=summarize([capture],[outcome]);
 assert.equal(x.accepted,1);assert.equal(x.distinct_codes,1);
 assert.equal(x.mean_return_pct,2.4);assert.equal(x.median_return_pct,2.4);
 assert.equal(x.positive_rate_pct,100);assert.equal(x.eligible_for_live_ai,false);
});
test("duplicate capture cannot inflate research results",()=>{
 const x=summarize([capture,{...capture}],[outcome]);
 assert.equal(x.accepted,0);assert.equal(x.rejected,2);
 assert.equal(x.rejection_reasons.DUPLICATE_CAPTURE,2);
});
test("unverified holiday horizon cannot create positive rate",()=>{
 const bad={...outcome,observed_at:"2026-11-03T06:30:00Z",
 verified_session_dates:["2026-10-28","2026-10-29","2026-10-30","2026-11-02","2026-11-03"]};
 const x=summarize([capture],[bad]);
 assert.equal(x.accepted,0);assert.equal(x.positive_rate_pct,null);
 assert.equal(x.rejection_reasons.JPX_SESSION_CALENDAR_MISMATCH,1);
});
test("invalid collections fail closed",()=>assert.throws(()=>summarize(null,[]),/INVALID_RESEARCH_INPUT/));
