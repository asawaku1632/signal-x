import test from "node:test";
import assert from "node:assert/strict";
import {parseCrashIndexDaily,joinCrashIndexSeries} from "../app/lib/research/crashStrengthMarketReference.mjs";

const sec=(iso)=>Date.parse(iso)/1000;
const record={
  chart:{result:[{
    timestamp:[sec("2026-10-14T06:00:00Z"),sec("2026-10-15T06:00:00Z"),sec("2026-10-16T06:00:00Z")],
    indicators:{quote:[{close:[67744.29,64425.95,65324.29]}]},
  }]}
};
test("historical Yahoo close bars map to correct Japanese trade dates",()=>{
  const p=parseCrashIndexDaily(record);
  assert.deepEqual(p.map(x=>x.date),["2026-10-14","2026-10-15","2026-10-16"]);
  assert.equal(p[1].price,64425.95);
  assert.ok((p[1].price/p[0].price-1)*100 < -2);
});

test("never use an intraday meta quote or missing price as a settled bar",()=>{
  assert.throws(()=>parseCrashIndexDaily({chart:{result:[{timestamp:[sec("2026-10-15T06:00:00Z")],meta:{regularMarketPrice:99999},indicators:{quote:[{close:[null]}]}}]}}),/EMPTY_REFERENCE_CHART/);
  assert.throws(()=>parseCrashIndexDaily({chart:{result:[]}}),/INVALID_REFERENCE_CHART/);
});

test("index series remain separately identified and future dates excluded",()=>{
  const nikkei=parseCrashIndexDaily(record);
  const x=joinCrashIndexSeries({nikkei,topix:[{date:"2026-10-15",price:3999.34},{date:"2026-10-18",price:99999}],asOf:"2026-10-18"});
  assert.deepEqual(x.map(r=>r.date),["2026-10-14","2026-10-15","2026-10-16"]);
  assert.equal(x[1].topix,3999.34);
  assert.equal(x[0].topix,null);
  assert.ok(x.every(r=>r.date<"2026-10-18"));
});
