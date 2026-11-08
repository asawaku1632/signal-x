import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { auditNecklineQuality } from "../app/lib/research/necklineQualityAudit.mjs";
import {
  NECKLINE_FEATURE_VERSION,
  NECKLINE_FEATURE_AXES,
  frozenNecklineFeatures,
  summarizeFrozenNecklineFeatures,
} from "../app/lib/research/necklineFrozenFeatures.mjs";
import { analyzeNecklineTimeline } from "../app/lib/research/necklineEarlyStudy.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = name => readFileSync(join(dir, name), "utf8");
const now = new Date("2026-11-09T17:00:00+09:00");
function sample(count=44) {
  const bars = Array.from({length:count},(_,i)=>({
    time:1700000000+i*86400, open:98, high:100, low:97, close:98, volume:1000,
  }));
  bars[10] = {...bars[10], low:90, close:95};
  bars[17] = {...bars[17], high:105, close:102};
  bars[24] = {...bars[24], low:91, close:92};
  bars[25] = {...bars[25], low:92, close:94};
  bars[26] = {...bars[26], low:93, close:98};
  if(count>33)bars[33] = {...bars[33], high:109, close:108, volume:2500};
  return bars;
}
const stock=(code,candles)=>({code,candles,error:null});

test("the five shape/volume bins are predeclared and calculated strictly as of firstSeenIndex",()=>{
  const a=sample();
  const event=analyzeNecklineTimeline(a).events[0];
  assert.equal(event.firstSeenIndex,26);
  const baseline=frozenNecklineFeatures(event,a.slice(0,27));
  const futureChange=[...a];
  futureChange[34]={...a[34],high:500,low:10,close:499,volume:200000};
  const extended=frozenNecklineFeatures(event,futureChange);
  assert.deepEqual(extended,baseline);
  assert.equal(baseline.observedAtTime,a[26].time);
  assert.equal(baseline.measurements.bottomGap,14);
  assert.deepEqual(baseline.buckets,{
    bottomGap:"FAR",lowDifferencePercent:"SIMILAR",heightPercent:"HIGH",
    necklineDistancePercent:"FAR",volumeRatio:"NORMAL",
  });
  assert.equal(baseline.measurements.volumeRatio,1);
  assert.equal(NECKLINE_FEATURE_AXES.length,5);
  assert.ok(NECKLINE_FEATURE_VERSION.endsWith("V1"));
});

test("future success and failure have the SAME candidate-day buckets",()=>{
  const success=sample();
  const failed=sample();
  failed[33]={...failed[33],open:95,high:99,low:80,close:85};
  const a=auditNecklineQuality([stock("7164",success),stock("3774",failed)],now);
  assert.equal(a.candidates,2);
  const e1=a.events.find(e=>e.code==="7164");
  const e2=a.events.find(e=>e.code==="3774");
  assert.equal(e1.status,"BREAKOUT");
  assert.equal(e2.status,"INVALIDATED");
  assert.deepEqual(e1.frozenFeatures,e2.frozenFeatures);
  for(const axis of a.featureAnalysis.axes){
    assert.equal(axis.groups.reduce((sum,g)=>sum+g.candidates,0),2,axis.id);
    const group=axis.groups.find(g=>g.candidates===2);
    assert.ok(group,axis.id);
    assert.equal(group.breakout,1);
    assert.equal(group.invalidated,1);
    assert.equal(group.resolved,2);
    assert.equal(group.resolvedBreakoutPercent,50);
    assert.equal(group.early5.completed,2);
    assert.equal(group.descriptiveSampleReady,false);
    assert.equal(group.selectionValidated,false);
  }
  assert.equal(a.featureAnalysis.selectionValidated,false);
  assert.equal(a.featureAnalysis.exploratoryOnly,true);
});

test("unfinished outcomes and unknown volume are reported, not silently dropped",()=>{
  const partial=sample(27).map(bar=>({...bar,volume:0}));
  const a=auditNecklineQuality([stock("7164",partial)],now);
  assert.equal(a.candidates,1);
  assert.equal(a.events[0].status,"WATCH");
  assert.equal(a.events[0].frozenFeatures.buckets.volumeRatio,"UNKNOWN");
  const vol=a.featureAnalysis.axes.find(a=>a.id==="volumeRatio");
  const unknown=vol.groups.find(g=>g.id==="UNKNOWN");
  assert.equal(unknown.candidates,1);
  assert.equal(unknown.pending,1);
  assert.equal(unknown.resolved,0);
  assert.equal(unknown.resolvedBreakoutPercent,null);
  assert.equal(unknown.early3.completed,0);
  assert.equal(unknown.early5.completed,0);
  assert.equal(vol.groups.reduce((sum,g)=>sum+g.candidates,0),1);
  assert.equal(summarizeFrozenNecklineFeatures([]).sampleCandidates,0);
});

test("early cohort does not select only winners or use breakout-day volume",()=>{
  const withUnobserved={...sample()[26],volume:1000};
  const event={first:10,second:24,firstSeenIndex:26,low1:90,low2:91,neckline:105};
  assert.equal(frozenNecklineFeatures(event,[...sample().slice(0,26),withUnobserved]).measurements.volumeRatio,1);
  assert.equal(frozenNecklineFeatures({...event,firstSeenIndex:25},sample()),null);
  const component=read("app/components/analysis/NecklineFeatureComparison.tsx");
  const page=read("app/admin/neckline-quality/page.tsx");
  const engine=read("app/lib/research/necklineFrozenFeatures.mjs");
  assert.match(component,/上抜けしなかった候補も含む/);
  assert.match(component,/5項目の組み合わせ探索や閾値の最適化は行いません/);
  assert.match(component,/独立した別期間の前向き検証/);
  assert.match(page,/<NecklineFeatureComparison analysis=\{result\.featureAnalysis\}/);
  assert.match(engine,/completedBars\.slice\(Math\.max\(0, seen - 20\), seen\)/);
  assert.doesNotMatch(engine,/breakoutVolumeRatio|breakoutIndex/);
  assert.doesNotMatch(component,/絶対買い|必ず上がる/);
});
