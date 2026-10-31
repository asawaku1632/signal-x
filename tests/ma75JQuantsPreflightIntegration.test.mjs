import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMa75JQuantsDailyPages} from '../app/lib/research/ma75JQuantsDailyPages.mjs';
import {planMa75JQuantsAcquisition} from '../app/lib/research/ma75DataAcquisitionPreflight.mjs';
import {auditMa75JQuantsPageRevisions} from '../app/lib/research/ma75JQuantsPageRevisionAudit.mjs';

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
 AdjO:25,AdjH:25,AdjL:25,AdjC:25,AdjVo:999999,AdjFactor:1,ExRT:null
});
const getArchive=(config={})=>{
 const sessions=getSessions(),freeze=f();
 const reports=sessions.map((date,index)=>{
  const records=['13010','186A0','99840'].map(code=>providerBar(code,date));
  if(config.noTradeIndex===index){
    Object.assign(records[1],{O:null,H:null,L:null,C:null,Vo:null});
  }
  if(config.corporateActionIndex===index){
    Object.assign(records[0],{AdjFactor:0.8,ExRT:'1'});
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
const preflight=(x,revisions=[])=>planMa75JQuantsAcquisition(x.freeze,{
 sessions:x.sessions,audits:x.reports,pageRevisionAudits:revisions,
 asOf:'2026-11-02T08:10:00Z',minuteAddonStatus:'PLANNED',
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

test('genuine changed close from the page parser quarantines that historical date',()=>{
 const archive=getArchive();
 const original=archive.reports[12];
 const updated=JSON.parse(JSON.stringify(original));
 updated.rows[0].bar.close=104;
 const revised=auditMa75JQuantsPageRevisions(archive.freeze,{
   previous:original,current:updated});
 assert.equal(revised.revisionDetected,true);
 const r=preflight(archive,[revised]);
 assert.equal(r.states.sourceRevisionReview,1);
 assert.equal(r.states.archivedOfflineOnly,75);
 assert.equal(r.archivedUsableBarCells,225);
 assert.equal(r.unverifiedOrMissingBarCells,3);
 assert.equal(r.structuralHistoricalInputsPresent,false);
 assert.equal(r.allowedToRunApiCalls,false);
});
test('identical archived date revisions cannot authorize execution, but do not discard valid bars',()=>{
 const archive=getArchive();
 const same=archive.reports[12];
 const stable=auditMa75JQuantsPageRevisions(archive.freeze,{
   previous:same,current:JSON.parse(JSON.stringify(same))});
 assert.equal(stable.structurallyConsistent,true);
 const result=preflight(archive,[stable]);
 assert.equal(result.states.sourceRevisionReview,0);
 assert.equal(result.structuralHistoricalInputsPresent,true);
 assert.equal(result.eligibleForProduction,false);
});
test('different frozen-population fingerprint or duplicate audit reports quarantine source date',()=>{
 const archive=getArchive();
 const same=archive.reports[12];
 const stable=auditMa75JQuantsPageRevisions(archive.freeze,{previous:same,current:same});
 const forged={...stable,frozenPopulationSha256:'fake'};
 const q=preflight(archive,[forged]);
 assert.equal(q.states.sourceRevisionReview,1);
 assert.equal(q.structuralHistoricalInputsPresent,false);
 const duplicated=preflight(archive,[stable,stable]);
 assert.equal(duplicated.states.sourceRevisionReview,1);
});
test('outside-of-76-session source revisions cannot slip into complete full-universe study',()=>{
 const archive=getArchive();
 const same=archive.reports[12];
 const stable=auditMa75JQuantsPageRevisions(archive.freeze,{previous:same,current:same});
 const r=preflight(archive,[{...stable,tradeDate:'2027-01-05'}]);
 assert.equal(r.states.unexpectedRevisionDates,1);
 assert.equal(r.structuralHistoricalInputsPresent,false);
});

test('a real-parser split/rights record is archived as blocked, not as a completed daily bar',()=>{
 const archive=getArchive({corporateActionIndex:19});
 const row=archive.reports[19].rows[0];
 assert.equal(row.status,'CORPORATE_ACTION_REVIEW');
 assert.equal(row.actionDetails.adjustmentFactor,0.8);
 const r=preflight(archive);
 assert.equal(r.states.archivedCorporateActionReview,1);
 assert.equal(r.archivedUsableBarCells,227);
 assert.equal(r.archivedCorporateActionCells,1);
 assert.equal(r.blockedOrMissingBarCells,1);
 assert.equal(r.structuralHistoricalInputsPresent,false);
 assert.equal(r.initialDateRequestsPotentiallyNeeded,0);
 assert.equal(r.eligibleForNotifications,false);
});
