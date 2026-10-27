import test from "node:test";
import assert from "node:assert/strict";
import { validateJQuantsDailyResearchBatch } from "../app/lib/research/jquantsDailyBatchGate.mjs";
const sessions=["2026-10-01","2026-10-02","2026-10-05"];
const bar={code:"7203",date:"2026-10-01",close:100,priceField:"AdjC",provider:"JQUANTS_V2",priceBasisVerified:true,corporateActionUnresolved:false};
const check=(rows,other={})=>validateJQuantsDailyResearchBatch({rows,sessions,expectedCodes:["7203"],...other});
test("accepts an explicitly certified synthetic daily batch",()=>{
  const result=check([bar]);
  assert.equal(result.accepted,true);
  assert.deepEqual(result.issues,[]);
});
test("rejects duplicates and invalid prices instead of dropping them",()=>{
  const result=check([bar,bar,{...bar,date:"2026-10-02",close:NaN}]);
  assert.equal(result.accepted,false);
  assert.ok(result.issues.some(x=>x.startsWith("DUPLICATE")));
  assert.ok(result.issues.some(x=>x.startsWith("INVALID_ADJUSTED_CLOSE")));
});
test("rejects wrong source, unknown code, and outside calendar",()=>{
  assert.equal(check([{...bar,provider:"OTHER"}]).accepted,false);
  assert.equal(check([{...bar,code:"9999"}]).accepted,false);
  assert.equal(check([{...bar,date:"2026-10-03"}]).accepted,false);
});
test("rejects unverified basis and invalid calendar",()=>{
  assert.equal(check([{...bar,priceBasisVerified:false}]).accepted,false);
  assert.equal(check([bar],{sessions:["2026-10-05","2026-10-01"]}).accepted,false);
});
