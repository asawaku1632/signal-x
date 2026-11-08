import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join,dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { replayNecklineEntryRisk } from "../app/lib/research/necklineEntryRiskReplay.mjs";
import {
  diagnoseNecklineLossRisk,NECKLINE_LOSS_DIAGNOSTICS_VERSION,
  NECKLINE_REFERENCE_EXCLUSION_CODE,
} from "../app/lib/research/necklineRiskDiagnostics.mjs";

const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(join(root,path),"utf8");
const now=new Date("2026-11-09T17:00:00+09:00");
function fixture(count=44) {
  const xs=Array.from({length:count},(_,i)=>({
    time:1700000000+i*86400, open:98,high:100,low:97,close:98,volume:1000,
  }));
  xs[10]={...xs[10],low:90,close:95};
  xs[17]={...xs[17],high:105,close:102};
  xs[24]={...xs[24],low:91,close:92};
  xs[25]={...xs[25],low:92,close:94};
  xs[26]={...xs[26],low:93,close:98};
  if (count>33) xs[33]={...xs[33],high:109,close:108,volume:2500};
  return xs;
}
const stock=(code,candles)=>({code,candles,error:null});

test("3996 outlier sensitivity is reported for all three scenarios, without removing its events from the initial cohort",()=>{
  const winner=fixture();
  winner[31]={...winner[31],open:98,high:105,low:97,close:104};
  const loser=fixture();
  loser[31]={...loser[31],open:95,high:99,low:80,close:85};
  const report=replayNecklineEntryRisk([stock("7164",winner),stock("3996",loser)],now);
  assert.equal(NECKLINE_REFERENCE_EXCLUSION_CODE,"3996");
  assert.equal(report.sample.candidates,2);
  assert.equal(report.diagnostics.candidateCount,2);
  assert.equal(report.diagnostics.exclusion.excludedCandidates,1);
  assert.equal(report.diagnostics.exclusion.all[0].matured,2);
  assert.equal(report.diagnostics.exclusion.withoutReference[0].matured,1);
  assert.equal(report.diagnostics.exclusion.all[0].losses5,1);
  assert.equal(report.diagnostics.exclusion.withoutReference[0].losses5,0);
  assert.ok(report.diagnostics.exclusion.withoutReference[0].returns.mean
    >report.diagnostics.exclusion.all[0].returns.mean);
  assert.equal(report.diagnostics.exclusion.bySymbol.length,2);
  assert.equal(report.diagnostics.exclusion.bySymbol.find(r=>r.code==="3996").removedCandidates,1);
  assert.equal(report.diagnostics.selectedAfterObservingResults,true);
  assert.equal(report.diagnostics.selectionValidated,false);
  assert.equal(report.diagnostics.version,NECKLINE_LOSS_DIAGNOSTICS_VERSION);
});

test("matched entry comparisons use ONLY the same actual event when both five-day outcomes have matured",()=>{
  const full=fixture();
  full[26]={...full[26],high:102,close:101}; // detection-day 5% distance condition
  const pending=fixture(27);
  const report=replayNecklineEntryRisk([stock("7164",full),stock("3774",pending)],now);
  const pair1=report.diagnostics.matched.find(r=>r.first==="DETECTION"&&r.second==="BREAKOUT");
  const pair2=report.diagnostics.matched.find(r=>r.first==="NEAR"&&r.second==="BREAKOUT");
  assert.equal(pair1.n,1);
  assert.equal(pair2.n,1);
  assert.equal(pair1.symbols,1);
  assert.equal(pair1.firstStats.n,1);
  assert.equal(pair1.secondStats.n,1);
  assert.equal(pair1.difference.n,1);
  assert.equal(pair1.secondBetterCount+pair1.sameCount+pair1.secondWorseCount,pair1.n);
  assert.equal(report.diagnostics.detectionNearSameTrade,true);
  assert.equal(report.diagnostics.matched.length,2);
  assert.equal(report.diagnostics.exclusion.excludedCandidates,0);
  assert.equal(report.diagnostics.exclusion.all[0].returns.mean,
    report.diagnostics.exclusion.withoutReference[0].returns.mean);
});

test("unmatured outcomes never enter severe loss denominators; missing volume stays in UNKNOWN",()=>{
  const recent=fixture(27).map(bar=>({...bar,volume:0}));
  const report=replayNecklineEntryRisk([stock("7164",recent)],now);
  assert.equal(report.diagnostics.exclusion.all[0].pending,1);
  assert.equal(report.diagnostics.exclusion.all[0].matured,0);
  assert.equal(report.diagnostics.exclusion.all[0].losses5Rate,null);
  assert.equal(report.diagnostics.matched[0].n,0);
  assert.equal(report.diagnostics.matched[0].difference.mean,null);
  const volume=report.diagnostics.riskStrata.find(axis=>axis.id==="volumeRatio");
  const unknown=volume.groups.find(g=>g.id==="UNKNOWN");
  assert.equal(unknown.events,1);
  assert.equal(unknown.matured,0);
  assert.equal(unknown.pending,1);
  assert.equal(unknown.loss5Rate,null);
  for(const axis of report.diagnostics.riskStrata){
    assert.equal(axis.groups.reduce((n,g)=>n+g.events,0),1);
  }
});

test("all five predeclared features preserve full cohort and no future price affects risk classification",()=>{
  const baseline=fixture(),modified=fixture();
  modified[36]={...modified[36],open:20,high:800,low:10,close:700,volume:200000};
  const a=replayNecklineEntryRisk([stock("7164",baseline)],now);
  const b=replayNecklineEntryRisk([stock("7164",modified)],now);
  assert.equal(a.diagnostics.riskStrata.length,5);
  for(let i=0;i<5;i++){
    const axisA=a.diagnostics.riskStrata[i],axisB=b.diagnostics.riskStrata[i];
    assert.equal(axisA.id,axisB.id);
    assert.deepEqual(axisA.groups.map(g=>({id:g.id,events:g.events})),
      axisB.groups.map(g=>({id:g.id,events:g.events})));
    assert.equal(axisA.groups.reduce((n,g)=>n+g.events,0),a.sample.candidates);
  }
  const changed=b.records[0].scenarios.DETECTION.hold5.returnPercent;
  assert.equal(changed,a.records[0].scenarios.DETECTION.hold5.returnPercent);
});

test("single-stock and zero-candidate displays remain fail-closed and do not invent comparative performance",()=>{
  assert.equal(diagnoseNecklineLossRisk([]).candidateCount,0);
  assert.equal(diagnoseNecklineLossRisk([]).matched[0].difference.mean,null);
  assert.throws(()=>diagnoseNecklineLossRisk([{code:"bad",scenarios:{}}]));
  const xs=fixture().map(bar=>({...bar,open:98,high:99,low:97,close:98}));
  const report=replayNecklineEntryRisk([stock("7164",xs)],now);
  assert.equal(report.sample.candidates,0);
  assert.equal(report.diagnostics.exclusion.bySymbol.length,0);
  assert.equal(report.diagnostics.exclusion.all[0].returns.mean,null);
  assert.equal(report.diagnostics.riskStrata[0].groups.reduce((n,g)=>n+g.events,0),0);
});

test("owner-only route presents sensitivity and conditional matched comparisons without trade hooks",()=>{
  const page=read("app/admin/neckline-entry-risk/page.tsx");
  const ui=read("app/components/analysis/NecklineLossDiagnostics.tsx");
  const core=read("app/lib/research/necklineRiskDiagnostics.mjs");
  assert.match(page,/getLearningOwnerSession/);
  assert.ok(page.indexOf("if(!isOwner)notFound()") < page.indexOf("fetchNecklineExtendedCohort(codes)"));
  assert.match(page,/<NecklineLossDiagnostics analysis=\{report\.diagnostics\}/);
  assert.match(ui,/3996を除くと成績は変わる/);
  assert.match(ui,/同じ候補なら、どの買い時刻が有利/);
  assert.match(ui,/大きな損失と関連する形を比較/);
  assert.match(ui,/上抜けした.*事後条件/);
  assert.match(core,/NECKLINE_FEATURE_AXES/);
  assert.match(core,/row\.scenarios\?\.\[first\]\?\.qualified === true/);
  assert.doesNotMatch(page,/update.*public\.|pool\.|INSERT INTO|pushNotification|sendNotification|tradeOrder/);
  assert.doesNotMatch(core,/Math\.random\(|fetch\(|futureFeatures|selectedWinStocks/);
});
