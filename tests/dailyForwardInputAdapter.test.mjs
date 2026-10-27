import test from "node:test";
import assert from "node:assert/strict";
import { adaptDailySnapshotsForForwardResearch, adaptLicensedDailyClosesForForwardResearch } from "../app/lib/research/dailyForwardInputAdapter.mjs";
import { evaluateDailyForward } from "../app/lib/research/dailyForwardEvaluation.mjs";

test("legacy daily snapshot is not automatically treated as verified official close", () => {
  const original = { id:"2026-10-01-1234", code:"1234",date:"2026-10-01",score:88,price:100,result:"WIN" };
  const predictions = adaptDailySnapshotsForForwardResearch([original]);
  assert.equal(predictions[0].priceBasisVerified,false);
  assert.equal(original.result,"WIN");
  const sessions=Array.from({length:6},(_,i)=>"2026-10-0"+(i+1));
  const closes=adaptLicensedDailyClosesForForwardResearch([{code:"1234",date:sessions[5],close:120,priceBasisVerified:true,corporateActionUnresolved:false}]);
  const report=evaluateDailyForward({predictions,closes,sessions,horizons:[5]});
  assert.equal(report.rows[0].status,"PRICE_BASIS_UNVERIFIED");
  assert.equal(report.rows[0].returnPct,null);
});

test("unconfirmed corporate actions remain unverified",()=>{
  const rows=adaptLicensedDailyClosesForForwardResearch([{code:"1234",date:"2026-10-08",close:110,priceBasisVerified:true}]);
  assert.equal(rows[0].corporateActionUnresolved,true);
});

test("adapters reject non-array inputs",()=>{
  assert.throws(()=>adaptDailySnapshotsForForwardResearch(null),TypeError);
  assert.throws(()=>adaptLicensedDailyClosesForForwardResearch({}),TypeError);
});
