import test from "node:test";
import assert from "node:assert/strict";
import {summarizeMatureFeatures} from "../scripts/research/bb-all-mature-feature-audit.mjs";
const f={bbWidthPct:1,volumeVsPrior20:0.8,bodyToRangePct:100,last5BarsPct:0.5};
const row=(code,date,slot,dip,profit)=>({code,date,slot,
 frozenAsOf:{"09:20":"09:15","11:20":"11:15","14:15":"14:10"}[slot],
 priorMarket:"DOWN",patterns:["MARUBOZU"],features:f,
 worstDip5dPct:dip,after5dPct:profit});
test("descriptive adverse buckets count events and independent dates separately",()=>{
 const r=summarizeMatureFeatures([
  row("6326","2026-11-04","14:15",-10.0899,-3.5519),
  row("8410","2026-11-04","14:15",-1.1617,3.4245),
  row("8053","2026-10-27","14:15",-10.5667,-6.7667)],3);
 assert.equal(r.matureEvents,3);
 assert.equal(r.uniqueTradingDates,2);
 assert.equal(r.predeclaredAdverseBuckets[0].observations,2);
 assert.equal(r.predeclaredAdverseBuckets[0].distinctDates,2);
 assert.equal(r.noFeatureThresholdTuning,true);
 assert.equal(r.eligibleForProduction,false);
});
test("wrong frozen bar time and missing feature block results",()=>{
 const x=row("8410","2026-11-04","14:15",-1,3);
 assert.throws(()=>summarizeMatureFeatures([{...x,frozenAsOf:"14:15"}],1),/INVALID_MATURE_EVENT_FEATURES|LOOKAHEAD/);
 assert.throws(()=>summarizeMatureFeatures([{...x,features:{...f,bbWidthPct:null}}],1),/INVALID_MATURE_EVENT_FEATURES/);
 assert.throws(()=>summarizeMatureFeatures([x,x],2),/INVALID_MATURE_EVENT_FEATURES/);
});
