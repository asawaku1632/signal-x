import test from 'node:test';
import assert from 'node:assert/strict';
import {projectMa75FullDateSource} from '../app/lib/research/ma75FullDateProjection.mjs';
const freeze=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',firstEligibleSignalDate:'2026-11-02',
 populationSize:2,codes:['1301','186A'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'Application observed subset, not independently certified all TSE listings.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
 splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
 liquidityCoverage:'UNVERIFIED'},automaticCollectionEnabled:false,
 liveTradingEligible:false,notificationEligible:false,
 independentlyValidatedForwardReturns:0
});
const date='2026-11-04';
const row=(Code,d=date)=>({Code,Date:d,O:100,H:101,L:99,C:100,Vo:100,
 AdjFactor:1,ExRT:null});
const page=(data,req=null,next=undefined)=>({
 requestPaginationKey:req,receivedAt:'2026-11-04T10:00:00Z',
 response:{data,...(next===undefined?{}:{pagination_key:next})}
});
test('date-only all-listed rows retain total provenance and exact selected denominator',()=>{
 const r=projectMa75FullDateSource(freeze(),{date,pages:[
  page([row('13010'),row('99990')],null,'PAGE2'),
  page([row('186A0'),row('99991')],'PAGE2')
 ]});
 assert.equal(r.originalAllListedRows,4);
 assert.equal(r.projectedFrozenRows,2);
 assert.equal(r.excludedUnselectedListingRows,2);
 assert.equal(r.audit.rawProviderRows,2);
 assert.equal(r.audit.paginationComplete,true);
 assert.equal(r.audit.rows.length,2);
 assert.equal(r.audit.rows[0].status,'DAILY_BAR');
 assert.equal(r.audit.eligibleForProduction,false);
});
test('missing final provider pagination cannot be hidden by selected subset',()=>{
 const r=projectMa75FullDateSource(freeze(),{date,pages:[
  page([row('13010'),row('99990')],null,'NEXT')
 ]});
 assert.equal(r.completeProviderPagination,false);
 assert.equal(r.audit.rows.every(x=>x.bar===null),true);
});
test('duplicate source symbols outside frozen population are also prohibited',()=>{
 assert.throws(()=>projectMa75FullDateSource(freeze(),{date,pages:[
  page([row('13010'),row('99990')]),
  page([row('99990')])
 ]}),TypeError);
});
test('wrong-date extra security never disappears during projection',()=>{
 assert.throws(()=>projectMa75FullDateSource(freeze(),{date,pages:[
  page([row('13010'),row('99990','2026-11-02')])
 ]}),TypeError);
});
test('duplicate normalization of ordinary frozen share class fails closed',()=>{
 assert.throws(()=>projectMa75FullDateSource(freeze(),{date,pages:[
  page([row('13010'),row('1301'),row('186A0')])
 ]}),TypeError);
});
test('future stock-rights other class cannot satisfy a missing frozen ordinary code',()=>{
 const r=projectMa75FullDateSource(freeze(),{date,pages:[
  page([row('13011'),row('186A0')])
 ]});
 assert.equal(r.projectedFrozenRows,1);
 assert.equal(r.audit.counts.MISSING_PROVIDER_ROW,1);
});
