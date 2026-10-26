import test from "node:test";
import assert from "node:assert/strict";
import {summarizeMorningQuoteDiagnostics as summarize} from "../app/lib/research/morningQuoteDiagnosisSummary.mjs";
const row=(reason,overrides={})=>({research_run_date:"2026-10-26",stage:"existing_response",reason,classifier_version:"metadata-v1",...overrides});
test("empty sample never implies a confirmed cause",()=>{
 const x=summarize([]);assert.equal(x.accepted,0);assert.equal(x.rootCauseConfirmed,false);assert.equal(x.priceValidityEstablished,false);
});
test("separates absent 09:05 and mere timestamp presence",()=>{
 const x=summarize([row("MISSING_0905_BAR"),row("BARS_PRESENT_NOT_PRICE_VALIDATED")]);
 assert.equal(x.counts.MISSING_0905_BAR,1);assert.equal(x.timestampsPresentNotPriceValidated,1);
 assert.equal(x.priceValidityEstablished,false);
});
test("rejects unknown or incomplete records without guessing",()=>{
 const x=summarize([row("NOT_A_REASON"),row("NO_RESULT",{research_run_date:"invalid"}),row("NO_RESULT",{classifier_version:"unknown"}),null]);
 assert.equal(x.accepted,0);assert.equal(x.rejected,4);
});
test("counts observed upstream errors distinctly",()=>{
 const x=summarize([row("UPSTREAM_HTTP_ERROR",{stage:"upstream_failure"}),row("UPSTREAM_TIMEOUT",{stage:"upstream_failure"})]);
 assert.equal(x.counts.UPSTREAM_HTTP_ERROR,1);assert.equal(x.counts.UPSTREAM_TIMEOUT,1);
});
test("rejects non-array inputs",()=>assert.throws(()=>summarize({}),TypeError));
