import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMa75JQuantsDailyPages} from '../app/lib/research/ma75JQuantsDailyPages.mjs';
import {auditMa75JQuantsDailyWindow} from '../app/lib/research/ma75JQuantsWindowAudit.mjs';
const freeze=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',firstEligibleSignalDate:'2026-11-02',
 populationSize:2,codes:['1301','186A'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'Previously app-observed symbols, not full liquid TSE coverage.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
 splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',liquidityCoverage:'UNVERIFIED'},
 automaticCollectionEnabled:false,liveTradingEligible:false,
 notificationEligible:false,independentlyValidatedForwardReturns:0,
});
const sessions=()=>{
 const arr=[];
 for(let time=Date.parse('2026-07-01T00:00:00Z');
   time<=Date.parse('2026-11-04T00:00:00Z');time+=86400000){
  const d=new Date(time),ymd=d.toISOString().slice(0,10);
  if(d.getUTCDay()!==0&&d.getUTCDay()!==6&&ymd!=='2026-11-03')arr.push(ymd);
 }
 return arr.slice(-76);
};
const page=(d,n=0,mutate=null)=>{
 const codes=['13010','186A0'];
 const daily=codes.map((Code,j)=>{
  const close=j===0&&n===75?105:100;
  const r={Code,Date:d,O:close,H:close+1,L:close-1,C:close,Vo:j===0&&n===75?2000:1000,
   AdjC:close/2};
  if(mutate)mutate(r,j,n);
  return r;
 });
 return parseMa75JQuantsDailyPages(freeze(),{date:d,pages:[{
  requestPaginationKey:null,
  receivedAt:'2026-12-01T10:00:00Z',
  response:{data:daily}}]});
};
const fixture=(change=null)=>{
 const dates=sessions();
 const reports=dates.map((d,i)=>page(d,i,change));
 return {dates,reports};
};
const audit=({dates,reports})=>auditMa75JQuantsDailyWindow(freeze(),{sessions:dates,reports});
test('76 declared sessions give offline cross, slope and previous-20 volume without future outcomes',()=>{
 const data=fixture(),r=audit(data);
 assert.equal(data.dates.length,76);
 assert.equal(data.dates.at(-1),'2026-11-04');
 assert.equal(r.expectedFrozenCodes,2);
 assert.equal(r.structuralCoverageComplete,true);
 assert.equal(r.counts.BREAKOUT_OFFLINE_ONLY,1);
 assert.equal(r.counts.NO_CROSS_OFFLINE_ONLY,1);
 const x=r.rows.find(x=>x.code==='1301').signal;
 assert.equal(x.crossover,true);
 assert.equal(x.prior20VolumeRatio,2);
 assert.equal(x.sma75Rising,true);
 assert.equal(x.priorSma75,100);
 assert.equal(x.sma75,100.06667);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.generatedForwardSignals,0);
});
test('one unobserved date stops all 75-day classifications, not a missing = cash outcome',()=>{
 const data=fixture();data.reports.splice(20,1);
 const r=audit(data);
 assert.equal(r.missingSessions.length,1);
 assert.equal(r.structuralCoverageComplete,false);
 assert.equal(r.counts.HISTORY_INCOMPLETE,2);
 assert.ok(r.rows.every(x=>x.signal===null));
});
test('partial provider pagination cannot be used as a complete historical signal',()=>{
 const data=fixture();
 data.reports[12]={...data.reports[12],paginationComplete:false};
 const r=audit(data);
 assert.equal(r.counts.HISTORY_INCOMPLETE,2);
 assert.ok(r.invalidReports.some(x=>x.reason==='INVALID_OR_INCOMPLETE_PAGE_AUDIT'));
});
test('no-trade and missing provider code stay unavailable rather than a made-up no-cross',()=>{
 const data=fixture((r,j,i)=>{if(j===1&&i===25){r.O=null;r.H=null;r.L=null;r.C=null;r.Vo=null}});
 const r=audit(data);
 assert.equal(r.rows.find(x=>x.code==='186A').status,'HISTORY_INCOMPLETE');
 assert.equal(r.rows.find(x=>x.code==='186A').reason,'NO_TRADE_SESSION');
 assert.equal(r.rows.find(x=>x.code==='1301').status,'BREAKOUT_OFFLINE_ONLY');
});
test('suspicious split-like jump is quarantined, never called a winning breakout',()=>{
 const data=fixture((r,j,i)=>{if(j===0&&i===35){r.O=220;r.H=221;r.L=219;r.C=220}});
 const r=audit(data);
 assert.equal(r.rows.find(x=>x.code==='1301').reason,'SPLIT_OR_CORPORATE_ACTION_UNVERIFIED');
 assert.equal(r.rows.find(x=>x.code==='1301').signal,null);
 assert.equal(r.structuralCoverageComplete,false);
});
test('tampered price and denominator rows or duplicate date report fail closed',()=>{
 const data=fixture();
 data.reports[0].rows[0].bar.close=NaN;
 let r=audit(data);
 assert.equal(r.counts.HISTORY_INCOMPLETE,2);
 assert.equal(r.invalidReports[0].reason,'INCONSISTENT_OR_TAMPERED_CODE_ROWS');
 const dup=fixture();
 dup.reports.push(dup.reports[0]);
 r=audit(dup);
 assert.equal(r.duplicateDates.length,1);
 assert.equal(r.structuralCoverageComplete,false);
});
test('extra report from another date is not silently folded into 76-session study',()=>{
 const data=fixture();data.reports.push({...data.reports[0],date:'2026-11-06'});
 const r=audit(data);
 assert.deepEqual(r.unexpectedDates,['2026-11-06']);
 assert.equal(r.structuralCoverageComplete,false);
});
test('not enough consecutive sessions, invalid calendar or old signal date reject',()=>{
 const data=fixture();
 assert.throws(()=>audit({dates:data.dates.slice(1),reports:data.reports}),TypeError);
 assert.throws(()=>audit({dates:[...data.dates.slice(0,75),'2026-11-31'],reports:data.reports}),TypeError);
 const old={...freeze(),firstEligibleSignalDate:'2026-12-01'};
 assert.throws(()=>auditMa75JQuantsDailyWindow(old,{sessions:data.dates,reports:data.reports}),TypeError);
});
test('late official API retrieval can calculate hypothetical history but never claim real-time entry',()=>{
 const r=audit(fixture());
 assert.equal(r.structuralCoverageComplete,true);
 assert.equal(r.independentlyVerifiedAsOfAvailability,false);
 assert.equal(r.independentlyVerifiedProviderRights,false);
 assert.equal(r.officialCalendarVerified,false);
 assert.equal(r.eligibleForAIPowerScoring,false);
});

test('tampered provider bar counts cannot pass a complete 76-session audit',()=>{
 const data=fixture();
 data.reports[5].counts.DAILY_BAR=999;
 let r=audit(data);
 assert.equal(r.structuralCoverageComplete,false);
 assert.ok(r.invalidReports.some(x=>x.reason==='TAMPERED_PROVIDER_ROW_COUNTS'));
 const second=fixture();
 second.reports[5].structurallyUsableRawBars=0;
 r=audit(second);
 assert.ok(r.invalidReports.some(x=>x.reason==='TAMPERED_PROVIDER_ROW_COUNTS'));
});
test('swapped frozen code row cannot silently reassign an SMA75 winner',()=>{
 const data=fixture();
 data.reports[17].rows[0].code='186A';
 const r=audit(data);
 assert.equal(r.structuralCoverageComplete,false);
 assert.ok(r.invalidReports.some(x=>x.reason==='INCONSISTENT_OR_TAMPERED_CODE_ROWS'));
});

test('small split factor 0.8 with less than 45-percent price move blocks offline crossover',()=>{
 const data=fixture((r,j,i)=>{
  if(j===0&&i===40){r.AdjFactor=0.8;r.ExRT='1';}
 });
 const r=audit(data);
 const code=r.rows.find(x=>x.code==='1301');
 assert.equal(code.status,'HISTORY_INCOMPLETE');
 assert.equal(code.reason,'EXPLICIT_SPLIT_OR_RIGHTS_REVIEW');
 assert.equal(code.signal,null);
 assert.equal(r.counts.NO_CROSS_OFFLINE_ONLY,1);
 assert.equal(r.structuralCoverageComplete,false);
});
test('explicit rights issue blocks only the affected stock and preserves no-signal denominator',()=>{
 const data=fixture((r,j,i)=>{
  if(j===1&&i===60){r.ExRT='3';r.AdjFactor=1;}
 });
 const r=audit(data);
 assert.equal(r.rows.find(x=>x.code==='186A').reason,'EXPLICIT_SPLIT_OR_RIGHTS_REVIEW');
 assert.equal(r.rows.find(x=>x.code==='1301').status,'BREAKOUT_OFFLINE_ONLY');
 assert.equal(r.generatedForwardSignals,0);
 assert.equal(r.eligibleForNotifications,false);
});
