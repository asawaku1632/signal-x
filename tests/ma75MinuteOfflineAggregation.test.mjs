import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const script=resolve('scripts/research/summarize-minute-reports.mjs');
const report=(date,bars,up,down)=>({
 status:'HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH',code:'3762',date,
 dailyReconciliationMatched:true,metricsReleasedForHistoricalResearch:true,
 eligibleForProduction:false,eligibleForNotifications:false,parsedMinuteBars:300,
 post905:{code:'3762',date,pre905BarCount:bars,
 upsideFromReferencePercent:up,downsideFromReferencePercent:down}
});
test('offline minute aggregation separates complete and partial pre-905 coverage',()=>{
 const dir=mkdtempSync(join(tmpdir(),'signalx-minute-test-'));
 try{
  const a=join(dir,'a.json'),b=join(dir,'b.json');
  writeFileSync(a,JSON.stringify(report('2026-10-27',5,2,-0.5)));
  writeFileSync(b,JSON.stringify(report('2026-10-29',2,0.1,-2)));
  const r=spawnSync(process.execPath,[script,a,b],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const x=JSON.parse(r.stdout);
  assert.equal(x.count,2);
  assert.equal(x.pre905Coverage.fiveObservedBars.count,1);
  assert.equal(x.pre905Coverage.fewerThanFiveObservedBars.count,1);
  assert.equal(x.pre905Coverage.fiveObservedBars.averageMaximumMorningUpsidePct,2);
  assert.equal(x.pre905Coverage.fewerThanFiveObservedBars.averageMaximumMorningDownsidePct,-2);
  assert.equal(x.eligibleForProduction,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('offline aggregation refuses duplicate code/date and unverified reconciliation',()=>{
 const dir=mkdtempSync(join(tmpdir(),'signalx-minute-test-'));
 try{
  const a=join(dir,'a.json'),b=join(dir,'b.json');
  writeFileSync(a,JSON.stringify(report('2026-10-27',5,2,-0.5)));
  writeFileSync(b,JSON.stringify(report('2026-10-27',2,0.1,-2)));
  const duplicate=spawnSync(process.execPath,[script,a,b],{encoding:'utf8'});
  assert.notEqual(duplicate.status,0);
  assert.match(duplicate.stderr,/DUPLICATE_CODE_DATE/);
  const invalid=report('2026-10-28',5,1,-1);
  invalid.dailyReconciliationMatched=false;
  writeFileSync(b,JSON.stringify(invalid));
  const bad=spawnSync(process.execPath,[script,a,b],{encoding:'utf8'});
  assert.notEqual(bad.status,0);
  assert.match(bad.stderr,/INVALID_OR_UNRECONCILED_REPORT/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
