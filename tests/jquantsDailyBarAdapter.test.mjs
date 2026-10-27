import test from "node:test";
import assert from "node:assert/strict";
import { adaptJQuantsV2DailyBars } from "../app/lib/research/jquantsDailyBarAdapter.mjs";

test("J-Quants V2 daily bars are unverified by default",()=>{
  const [bar]=adaptJQuantsV2DailyBars({data:[{Code:"7203",Date:"2026-10-01",C:100,AdjC:105}]});
  assert.equal(bar.close,105);
  assert.equal(bar.priceField,"AdjC");
  assert.equal(bar.priceBasisVerified,false);
  assert.equal(bar.corporateActionUnresolved,true);
});
test("certification must be explicit and valid adjusted close present",()=>{
  const bars=adaptJQuantsV2DailyBars([
    {Code:"7203",Date:"2026-10-01",AdjC:105},
    {Code:"7203",Date:"2026-10-02",C:110},
  ],{certifiedComparable:true});
  assert.equal(bars[0].priceBasisVerified,true);
  assert.equal(bars[0].corporateActionUnresolved,false);
  assert.equal(bars[1].priceBasisVerified,false);
  assert.ok(Number.isNaN(bars[1].close));
});
test("invalid provider payload fails closed",()=>{
  assert.throws(()=>adaptJQuantsV2DailyBars({}),TypeError);
});
