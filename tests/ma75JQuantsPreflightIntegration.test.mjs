import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMa75JQuantsDailyPages} from '../app/lib/research/ma75JQuantsDailyPages.mjs';
import {planMa75JQuantsAcquisition} from '../app/lib/research/ma75DataAcquisitionPreflight.mjs';

/**
 * Integration fixtures use the REAL page parser output, not hand-written
 * report counts. Synthetic inputs never become real historical observations.
 */
const f=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',firstEligibleSignalDate:'2026-11-02',
 populationSize:3,codes:['1301','186A','9984'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'Previous user-app observations only; does not prove TSE liquidity.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
 splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
 liquidityCoverage:'UNVERIFIED'},
 automaticCollectionEnabled:false,liveTradingEligible:false,
 notificationEligible:false,independentlyValidatedForwardReturns:0,
});
const getSessions=()=>{
 const arr=[];
 for(let t=Date.parse('2026-11-02T00:00:00Z');arr.length<76;t-=86400000){
  const day=new Date(t),week=day.getUTCDay();
  if(week!==0&&week!==6&&day.toISOString().slice(0,10)!=='2026-11-03')
    arr.unshift(day.toISOString().slice(0,10));
 }
 return arr;
};
const providerBar=(Code,Date)=>({
 Date,Code,O:100,H:105,L:95,C:101,Vo:1200,
 AdjO:25,AdjH:25,AdjL:25,AdjC:25,AdjVo:999999
});
const getArchive=(config={})=>{
 const sessions=getSessions(),freeze=f();
 const reports=sessions.map((date,index)=>{
  const records=['13010','186A0','99840'].map(code=>providerBar(code,date));
  if(config.noTradeIndex===index){
    Object.assign(records[1],{O:null,H:null,L:null,C:null,Vo:null});
  }
  const pages=[{
    requestPaginationKey:null,
    receivedAt:config.futureReceivedIndex===index?'2026-11-10T08:00:00Z':'2026-11-02T07:45:00Z',
    response:{data:records},
  }];
  if(config.truncatedIndex===index){
    pages[0].response.pagination_key='UNFETCHED_SECOND_PAGE';
  }
  return parseMa75JQuantsDailyPages(freeze,{date,pages});
 });
 if(config.removeIndex!==undefined)reports.splice(config.removeIndex,1);
 return {freeze,sessions,reports};
};
const preflight=x=>planMa75JQuantsAcquisition(x.freeze,{
 sessions:x.sessions,audits:x.reports,asOf:'2026-11-02T08:10:00Z',
 minuteAddonStatus:'PLANNED',
});
test('all 76 real-parser audit outputs reconcile to 228 frozen stock-day cells',()=>{
 const r=preflight(getArchive());
 assert.equal(r.expectedCodeSessionCells,228);
 assert.equal(r.archivedUsableBarCells,228);
 assert.equal(r.archivedNoTradeCells,0);
 assert.equal(r.unverifiedOrMissingBarCells,0);
 assert.equal(r.states.archivedOfflineOnly,76);
 assert.equal(r.structuralHistoricalInputsPresent,true);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.providerRightsVerified,false);
 assert.equal(r.generatedFutureSignals,0);
});
test('real-parser NO_TRADE remains an observed no-trade cell but blocks full 75-day warmup',()=>{
 const r=preflight(getArchive({noTradeIndex:20}));
 assert.equal(r.archivedUsableBarCells,227);
 assert.equal(r.archivedNoTradeCells,1);
 assert.equal(r.states.archivedNoTradeGap,1);
 assert.equal(r.structuralHistoricalInputsPresent,false);
 assert.equal(r.initialDateRequestsPotentiallyNeeded,0);
});
test('removing one archived date retains all three unavailable stock-day cells',()=>{
 const r=preflight(getArchive({removeIndex:25}));
 assert.equal(r.archivedUsableBarCells,225);
 assert.equal(r.unverifiedOrMissingBarCells,3);
 assert.equal(r.initialDateRequestsPotentiallyNeeded,1);
 assert.equal(r.structuralHistoricalInputsPresent,false);
});
test('truncated provider pagination blocks the date for every frozen stock',()=>{
 const r=preflight(getArchive({truncatedIndex:35}));
 assert.equal(r.archivedUsableBarCells,225);
 assert.equal(r.unverifiedOrMissingBarCells,3);
 assert.equal(r.states.incompleteExisting,1);
 assert.equal(r.eligibleForNotifications,false);
});
test('a valid page parser output received after the preflight clock is retrospective only',()=>{
 const r=preflight(getArchive({futureReceivedIndex:60}));
 assert.equal(r.archivedUsableBarCells,225);
 assert.equal(r.unverifiedOrMissingBarCells,3);
 assert.equal(r.states.incompleteExisting,1);
 assert.equal(r.structuralHistoricalInputsPresent,false);
});
