import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMa75JQuantsDailyPages} from '../app/lib/research/ma75JQuantsDailyPages.mjs';
import {auditMa75JQuantsPageRevisions} from '../app/lib/research/ma75JQuantsPageRevisionAudit.mjs';

const date='2026-11-04';
const frozen=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',firstEligibleSignalDate:'2026-11-02',
 populationSize:2,codes:['1301','186A'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'An existing app-observed universe, not the entire TSE liquidity universe.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
 splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',liquidityCoverage:'UNVERIFIED'},
 automaticCollectionEnabled:false,liveTradingEligible:false,
 notificationEligible:false,independentlyValidatedForwardReturns:0,
});
const price=(Code='13010',C=102)=>({
 Date:date,Code,O:100,H:106,L:98,C,Vo:20000,
 AdjO:1,AdjH:1,AdjL:1,AdjC:1,AdjVo:999,
});
const parse=(rows=[price('13010'),price('186A0')],receivedAt='2026-11-05T07:40:00Z')=>
 parseMa75JQuantsDailyPages(frozen(),{date,pages:[{
  requestPaginationKey:null,receivedAt,response:{data:rows,pagination_key:''},
 }]});
const clone=x=>JSON.parse(JSON.stringify(x));
const inspect=(a,b)=>auditMa75JQuantsPageRevisions(frozen(),{previous:a,current:b});
test('identical frozen provider code-days have matching SHA256 audit fingerprint and no changes',()=>{
 const a=parse(),b=clone(a);
 const r=inspect(a,b);
 assert.equal(r.structurallyConsistent,true);
 assert.equal(r.revisionDetected,false);
 assert.equal(r.changedCodeCount,0);
 assert.match(r.previousSnapshotSha256,/^[0-9a-f]{64}$/);
 assert.equal(r.previousSnapshotSha256,r.currentSnapshotSha256);
 assert.equal(r.approvedToOverwriteOriginal,false);
 assert.equal(r.eligibleForNotifications,false);
});
test('after-the-fact corrected close is visible rather than silently turning into success',()=>{
 const a=parse(),b=parse([price('13010',104),price('186A0')]);
 const r=inspect(a,b);
 assert.equal(r.structurallyConsistent,false);
 assert.equal(r.revisionDetected,true);
 assert.deepEqual(r.changedCodes,['1301']);
 assert.ok(r.issues.some(x=>x.reason==='FROZEN_CODE_DAY_VALUES_CHANGED'));
 assert.equal(r.independentlyValidatedForwardWinRate,null);
});
test('volume revision alone changes the source fingerprint and affected code ID',()=>{
 const a=parse(),b=clone(a);
 b.rows[1].bar.volume=23000;
 const r=inspect(a,b);
 assert.deepEqual(r.changedCodes,['186A']);
 assert.notEqual(r.previousSnapshotSha256,r.currentSnapshotSha256);
 assert.equal(r.replaysRequireIndependentReanalysis,true);
});
test('a later provider receipt timestamp cannot rewrite original as-of signal history',()=>{
 const a=parse(),b=parse(undefined,'2026-11-06T07:50:00Z');
 const r=inspect(a,b);
 assert.equal(r.changedCodeCount,0);
 assert.equal(r.receiptChanged,true);
 assert.equal(r.structurallyConsistent,false);
 assert.ok(r.issues.some(x=>x.reason==='RECEIPT_PROVENANCE_CHANGED'));
});
test('a missing stock-day on a complete page is not a validated unchanged trade',()=>{
 const a=parse(),b=parse([price('13010')]);
 const r=inspect(a,b);
 assert.equal(r.changedCodeCount,1);
 assert.equal(r.structurallyConsistent,false);
 assert.ok(r.issues.some(x=>x.reason==='UNUSABLE_CODE_DAY'));
});
test('a source with forged price geometry or copied stock code fails closed',()=>{
 const a=parse(),b=clone(a);
 b.rows[0].bar.high=20;
 const r=inspect(a,b);
 assert.equal(r.structurallyConsistent,false);
 assert.ok(r.issues.some(x=>x.reason==='INVALID_OR_INCONSISTENT_BAR'));
 const c=clone(a);c.rows[0].code='186A';
 assert.ok(inspect(a,c).issues.some(x=>x.reason==='MISMATCHED_CODE_OR_TRADE_DATE'));
});
test('tampered count, incomplete page and 76-session population errors fail closed',()=>{
 const a=parse(),b=clone(a);
 b.counts.DAILY_BAR=10;
 assert.ok(inspect(a,b).issues.some(x=>x.reason==='INVALID_REPORTED_COUNTS'));
 const c=clone(a);c.paginationComplete=false;
 assert.ok(inspect(a,c).issues.some(x=>x.reason==='BAD_ENVELOPE_OR_FROZEN_DENOMINATOR'));
 const f=frozen();f.populationSize=100;
 assert.throws(()=>auditMa75JQuantsPageRevisions(f,{previous:a,current:a}),TypeError);
});
test('cross-date comparisons are rejected rather than combined into a purported history',()=>{
 const a=parse(),b=clone(a);b.date='2026-11-05';
 assert.throws(()=>inspect(a,b),TypeError);
});
test('invalid calendar date and missing original receipt cannot count as structurally stable',()=>{
 const a=parse(),b=clone(a);b.date='2026-11-31';a.date='2026-11-31';
 assert.equal(inspect(a,b).structurallyConsistent,false);
 assert.ok(inspect(a,b).issues.some(x=>x.reason==='INVALID_TRADE_DATE'));
 const first=parse(),missing=clone(first);delete missing.firstReceivedAt;
 assert.ok(inspect(first,missing).issues.some(x=>x.reason==='INVALID_PAGE_PROVENANCE'));
});
