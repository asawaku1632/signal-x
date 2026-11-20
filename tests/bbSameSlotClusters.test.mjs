import test from "node:test";
import assert from "node:assert/strict";
import {studySameSlotClusters} from "../scripts/research/bb-same-slot-clusters.mjs";
const e=(code,date,time,after5dPct,priorMarket="DOWN")=>({
 code,date,time,after5dPct,worstDip5dPct:after5dPct===null?null:-8,priorMarket
});
test("same date and same slot groups two stocks, not two dates or different slots",()=>{
 const r=studySameSlotClusters([
  e("7752","2026-10-27","14:15",-7.9034),
  e("8053","2026-10-27","14:15",-6.7667),
  e("8053","2026-10-29","14:15",null),
  e("3762","2026-10-27","09:20",3)
 ]);
 assert.equal(r.totalDistinctBuyEvents,4);
 assert.equal(r.multipleSignalGroups,1);
 assert.equal(r.multiClusters[0].distinctStocks,2);
 assert.deepEqual(r.multiClusters[0].codes,["7752","8053"]);
 assert.equal(r.multiClusters[0].nonpositive5d,2);
 assert.equal(r.comparativeRates,null);
 assert.equal(r.eligibleForProduction,false);
});
test("future returns do not change cluster membership; duplicate records rejected",()=>{
 const original=[e("7752","2026-10-27","14:15",-7),e("8053","2026-10-27","14:15",-6)];
 const a=studySameSlotClusters(original);
 const b=studySameSlotClusters(original.map(x=>({...x,after5dPct:9})));
 assert.deepEqual(a.multiClusters.map(x=>[x.date,x.time,x.codes]),
   b.multiClusters.map(x=>[x.date,x.time,x.codes]));
 assert.throws(()=>studySameSlotClusters([...original,original[0]]),/DUPLICATE_CLUSTER_EVENT/);
});
test("missing or conflicting prior market classification blocks",()=>{
 assert.throws(()=>studySameSlotClusters([
  e("7752","2026-10-27","14:15",-7),
  e("8053","2026-10-27","14:15",-6,"UP")
 ]),/MISMATCHED_MARKET_CONTEXT/);
});
