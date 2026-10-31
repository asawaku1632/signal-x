import test from 'node:test';
import assert from 'node:assert/strict';
import {planMa75JQuantsAcquisition} from '../app/lib/research/ma75DataAcquisitionPreflight.mjs';
const freeze=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',firstEligibleSignalDate:'2026-11-02',
 populationSize:3,codes:['1301','186A','9984'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'Previously app-observed subset of 953 not proven all TSE symbols.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
 splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',liquidityCoverage:'UNVERIFIED'},
 automaticCollectionEnabled:false,liveTradingEligible:false,notificationEligible:false,
 independentlyValidatedForwardReturns:0,
});
const sessions=()=>{
 const out=[];
 for(let t=Date.parse('2026-11-02T00:00:00Z');out.length<76;t-=86400000){
  const day=new Date(t),week=day.getUTCDay();
  if(week!==0&&week!==6&&day.toISOString().slice(0,10)!=='2026-11-03')
   out.unshift(day.toISOString().slice(0,10));
 }
 return out;
};
const archive=date=>({
 date,version:'ma75_jquants_v2_offline_daily_v3',
 firstReceivedAt:'2026-11-02T07:40:00Z',
 lastReceivedAt:'2026-11-02T07:45:00Z',
 readPages:1,rawProviderRows:3,
 paginationComplete:true,failures:[],expectedFrozenCodes:3,
 structurallyUsableRawBars:3,counts:{DAILY_BAR:3},
 eligibleForForwardSignal:false,providerRightsVerified:false,
 rows:freeze().codes.map(code=>({code,tradeDate:date,
   status:'DAILY_BAR',bar:{code,tradeDate:date,unadjusted:true,
     open:100,high:102,low:99,close:100,volume:1000}})),
});
const calendar=s=>{
 const set=new Set(s),records=[];
 for(let t=Date.parse(s[0]+'T00:00:00Z');t<=Date.parse(s.at(-1)+'T00:00:00Z');t+=86400000){
  const date=new Date(t).toISOString().slice(0,10);
  records.push({Date:date,HolDiv:set.has(date)?'1':'0'});
 }
 return {requestFrom:s[0],requestTo:s.at(-1),
   capturedAt:'2026-11-02T07:45:00Z',records};
};
const after='2026-11-02T08:10:00Z';
const plan=(opts={})=>{
 const dates=opts.sessions??sessions();
 return planMa75JQuantsAcquisition(freeze(),{
  asOf:opts.asOf??after,sessions:dates,audits:opts.audits??[],
  calendarSnapshot:opts.calendarSnapshot===undefined?calendar(dates):opts.calendarSnapshot,
  minuteAddonStatus:opts.minuteAddonStatus??'PLANNED'
 });
};
test('76 date-scope requests cover 3 frozen codes without 3*76 separate first calls',()=>{
 const r=plan();
 assert.equal(r.expectedDailySessions,76);
 assert.equal(r.expectedCodeSessionCells,228);
 assert.equal(r.archivedUsableBarCells,0);
 assert.equal(r.archivedNoTradeCells,0);
 assert.equal(r.unverifiedOrMissingBarCells,228);
 assert.equal(r.baselineRequestsForAllMissingDates,76);
 assert.equal(r.initialDateRequestsPotentiallyNeeded,76);
 assert.equal(r.states.pendingFetch,76);
 assert.equal(r.requestGranularity,'ONE_DATE_ALL_LISTED_WITH_PAGINATION');
 assert.equal(r.extraPaginationRequests,'UNKNOWN_UNTIL_REAL_RESPONSES');
 assert.equal(r.officialStandardPerMinuteCeiling,120);
 assert.equal(r.planningSafetyTargetRequestsPerMinute,30);
 assert.equal(r.allowedToRunApiCalls,false);
 assert.equal(r.allowedToSpendMoney,false);
});
test('future eligible trade day cannot be acquired as a completed close on Oct 31',()=>{
 const r=plan({asOf:'2026-10-31T15:00:00Z'});
 assert.equal(r.states.notYetClosed,1);
 assert.equal(r.states.pendingFetch,75);
 assert.equal(r.initialDateRequestsPotentiallyNeeded,75);
 assert.equal(r.dates.at(-1).state,'SESSION_NOT_YET_CLOSED');
 assert.equal(r.eligibleForProduction,false);
});
test('all archived 76 complete date reports may be structural, never independently validated forward',()=>{
 const r=plan({audits:sessions().map(archive)});
 assert.equal(r.structuralHistoricalInputsPresent,true);
 assert.equal(r.states.archivedOfflineOnly,76);
 assert.equal(r.archivedUsableBarCells,228);
 assert.equal(r.archivedNoTradeCells,0);
 assert.equal(r.unverifiedOrMissingBarCells,0);
 assert.equal(r.initialDateRequestsPotentiallyNeeded,0);
 assert.equal(r.providerRightsVerified,false);
 assert.equal(r.pointInTimeProviderAvailabilityVerified,false);
 assert.equal(r.generatedFutureSignals,0);
 assert.equal(r.eligibleForNotifications,false);
});
test('incomplete pages and a missing provider code block archive reuse',()=>{
 const a=sessions().map(archive);
 a[1].paginationComplete=false;
 a[2].rows[0].status='MISSING_PROVIDER_ROW';
 const r=plan({audits:a});
 assert.equal(r.states.incompleteExisting,2);
 assert.equal(r.states.archivedOfflineOnly,74);
 assert.equal(r.structuralHistoricalInputsPresent,false);
 assert.equal(r.initialDateRequestsPotentiallyNeeded,2);
});
test('duplicate archival reports and unexpected out-of-window dates fail closed',()=>{
 const a=sessions().map(archive);
 a.push(a[0],archive('2026-11-05'));
 const r=plan({audits:a});
 assert.equal(r.states.duplicateExisting,1);
 assert.equal(r.states.unexpectedAuditDates,1);
 assert.equal(r.structuralHistoricalInputsPresent,false);
 assert.equal(r.initialDateRequestsPotentiallyNeeded,1);
});
test('an archived dataset with swapped code order cannot pass structural readiness',()=>{
 const a=sessions().map(archive);
 [a[9].rows[0],a[9].rows[1]]=[a[9].rows[1],a[9].rows[0]];
 const r=plan({audits:a});
 assert.equal(r.states.incompleteExisting,1);
 assert.equal(r.structuralHistoricalInputsPresent,false);
});
test('user plans 5500 yen add-on but no entitlement or API access is inferred',()=>{
 for(const status of ['PLANNED','USER_REPORTED_ACTIVE','NOT_PLANNED']){
  const r=plan({minuteAddonStatus:status});
  assert.equal(r.minuteAddonStatus,status);
  assert.equal(r.minuteAddonConfirmedByProvider,false);
  assert.equal(r.minuteResearchCanBeginWithExistingEntitlement,false);
  assert.equal(r.minuteAddonUpdatesOnlyDaily,true);
  assert.equal(r.minuteAddonRealtimeSupported,false);
  assert.equal(r.minuteAddonHistoricalRetentionYears,2);
  assert.equal(r.minuteBarsWithNoTransactionsAreOmitted,true);
  assert.equal(r.minuteResearchEndpoint,'/v2/equities/bars/minute');
  assert.equal(r.eligibleForProduction,false);
 }
});
test('invalid schedule/date, incomplete 76 sessions or as-of before freeze throws',()=>{
 assert.throws(()=>plan({sessions:sessions().slice(0,75)}),TypeError);
 const s=sessions();s[20]='2026-11-31';
 assert.throws(()=>plan({sessions:s}),TypeError);
 assert.throws(()=>plan({asOf:'2026-10-30T06:00:00Z'}),TypeError);
 assert.throws(()=>plan({minuteAddonStatus:'ACTIVATED_BY_SYSTEM'}),TypeError);
});
test('a mismatched or revised frozen population cannot trigger acquisition plans',()=>{
 const f=freeze();f.codes=['1301','1301','9984'];
 assert.throws(()=>planMa75JQuantsAcquisition(f,{asOf:after,sessions:sessions()}),TypeError);
});

test('daily close at 15:30 is NOT same as provider update around 16:30 JST',()=>{
 const early=plan({asOf:'2026-11-02T07:00:00Z'});
 assert.equal(early.states.waitingForProviderDailyUpdate,1);
 assert.equal(early.states.pendingFetch,75);
 assert.equal(early.initialDateRequestsPotentiallyNeeded,75);
 assert.equal(early.dates.at(-1).state,'WAIT_FOR_DAILY_PROVIDER_UPDATE');
 const later=plan({asOf:'2026-11-02T07:45:00Z'});
 assert.equal(later.states.waitingForProviderDailyUpdate,0);
 assert.equal(later.states.pendingFetch,76);
 assert.equal(later.pointInTimeProviderAvailabilityVerified,false);
});
test('paying for the minute add-on still cannot enable an actual 09:05 historical API alert',()=>{
 const r=plan({minuteAddonStatus:'USER_REPORTED_ACTIVE'});
 assert.equal(r.minuteAddonUpdatesOnlyDaily,true);
 assert.equal(r.minuteAddonRealtimeSupported,false);
 assert.equal(r.minuteAddonConfirmedByProvider,false);
 assert.equal(r.generatedFutureSignals,0);
 assert.equal(r.allowedToRunApiCalls,false);
 assert.equal(r.eligibleForNotifications,false);
});

test('no future-dated historical report can be reused as of the earlier audit clock',()=>{
 const prior=sessions().map(archive);
 prior[15].lastReceivedAt='2026-11-06T07:45:00Z';
 const r=plan({audits:prior,asOf:'2026-11-02T08:10:00Z'});
 assert.equal(r.states.incompleteExisting,1);
 assert.equal(r.structuralHistoricalInputsPresent,false);
 const missing=sessions().map(archive);
 delete missing[15].lastReceivedAt;
 const q=plan({audits:missing,asOf:'2026-11-02T08:10:00Z'});
 assert.equal(q.states.incompleteExisting,1);
});

test('archived NO_TRADE is a real day with insufficient SMA75 warm-up, not all-codes complete',()=>{
 const a=sessions().map(archive);
 a[17].rows[1].status='NO_TRADE';
 a[17].rows[1].bar=null;
 a[17].counts={DAILY_BAR:2,NO_TRADE:1};
 a[17].structurallyUsableRawBars=2;
 const r=plan({audits:a});
 assert.equal(r.states.archivedNoTradeGap,1);
 assert.equal(r.states.archivedOfflineOnly,75);
 assert.equal(r.archivedUsableBarCells,227);
 assert.equal(r.archivedNoTradeCells,1);
 assert.equal(r.unverifiedOrMissingBarCells,0);
 assert.equal(r.states.incompleteExisting,0);
 assert.equal(r.structuralHistoricalInputsPresent,false);
 assert.equal(r.initialDateRequestsPotentiallyNeeded,0);
 assert.equal(r.dates[17].state,'ARCHIVED_NO_TRADE_GAP');
 assert.equal(r.eligibleForNotifications,false);
});
test('inconsistent archived provider counts never justify all-953-symbol SMA75 coverage',()=>{
 const a=sessions().map(archive);
 a[8].counts.DAILY_BAR=2;
 const r=plan({audits:a});
 assert.equal(r.states.incompleteExisting,1);
 assert.equal(r.structuralHistoricalInputsPresent,false);
 assert.equal(r.initialDateRequestsPotentiallyNeeded,1);
});
test('tampered per-date usable bar count blocks historical reuse',()=>{
 const a=sessions().map(archive);
 a[5].structurallyUsableRawBars=2;
 const r=plan({audits:a});
 assert.equal(r.states.incompleteExisting,1);
 assert.equal(r.structuralHistoricalInputsPresent,false);
});

test('stock-day gap accounting never makes a missing date look like observed bars',()=>{
 const a=sessions().map(archive);
 a.splice(8,1);
 const r=plan({audits:a});
 assert.equal(r.archivedUsableBarCells,225);
 assert.equal(r.archivedNoTradeCells,0);
 assert.equal(r.unverifiedOrMissingBarCells,3);
 assert.equal(r.expectedCodeSessionCells,
   r.archivedUsableBarCells+r.archivedNoTradeCells+r.unverifiedOrMissingBarCells);
});
test('future receipt source data cannot raise as-of archived bar coverage',()=>{
 const a=sessions().map(archive);
 a[10].lastReceivedAt='2026-11-12T07:45:00Z';
 const r=plan({audits:a});
 assert.equal(r.archivedUsableBarCells,225);
 assert.equal(r.unverifiedOrMissingBarCells,3);
 assert.equal(r.structuralHistoricalInputsPresent,false);
});

test('a fake daily bar with only close and unadjusted flag is not sufficient to reuse',()=>{
 const audits=sessions().map(archive);
 audits[4].rows[0].bar={code:'1301',tradeDate:audits[4].date,
   unadjusted:true,close:100};
 const r=plan({audits});
 assert.equal(r.states.incompleteExisting,1);
 assert.equal(r.archivedUsableBarCells,225);
 assert.equal(r.unverifiedOrMissingBarCells,3);
 assert.equal(r.structuralHistoricalInputsPresent,false);
});
test('invalid price geometry, nonfinite OHLCV, zero volume and wrong code/date quarantine',()=>{
 for(const mutate of [
  bar=>{bar.high=10;},bar=>{bar.low=120;},bar=>{bar.close=NaN;},
  bar=>{bar.volume=0;},bar=>{bar.volume=-5;},
  bar=>{bar.code='9984';},bar=>{bar.tradeDate='2026-12-31';}
 ]){
   const a=sessions().map(archive);
   mutate(a[10].rows[0].bar);
   const r=plan({audits:a});
   assert.equal(r.states.incompleteExisting,1);
   assert.equal(r.structuralHistoricalInputsPresent,false);
 }
});
test('first received page after last page or before close rejects reused date',()=>{
 for(const firstReceivedAt of ['2026-11-02T08:00:00Z',sessions()[7]+'T06:00:00Z','invalid']){
  const a=sessions().map(archive);
  a[7].firstReceivedAt=firstReceivedAt;
  const r=plan({audits:a});
  assert.equal(r.states.incompleteExisting,1);
 }
});
test('missing first receipt, missing readPages and impossible provider count are not archived',()=>{
 for(const field of ['firstReceivedAt','readPages','rawProviderRows']){
  const a=sessions().map(archive);
  delete a[8][field];
  const r=plan({audits:a});
  assert.equal(r.states.incompleteExisting,1);
 }
 const a=sessions().map(archive);
 a[8].rawProviderRows=2;
 assert.equal(plan({audits:a}).states.incompleteExisting,1);
});

test('explicit split/rights event is archived but not a completed SMA75 candle',()=>{
 const a=sessions().map(archive);
 a[8].rows[0]={code:'1301',tradeDate:a[8].date,status:'CORPORATE_ACTION_REVIEW',
   bar:null,actionDetails:{adjustmentFactor:0.5,exRightsType:'1',
    reason:'EX_RIGHTS_EVENT',independentlyVerified:false}};
 a[8].counts={DAILY_BAR:2,CORPORATE_ACTION_REVIEW:1};
 a[8].structurallyUsableRawBars=2;
 const result=plan({audits:a});
 assert.equal(result.states.archivedCorporateActionReview,1);
 assert.equal(result.archivedUsableBarCells,227);
 assert.equal(result.archivedCorporateActionCells,1);
 assert.equal(result.archivedNoTradeCells,0);
 assert.equal(result.blockedOrMissingBarCells,1);
 assert.equal(result.unverifiedOrMissingBarCells,0);
 assert.equal(result.initialDateRequestsPotentiallyNeeded,0);
 assert.equal(result.structuralHistoricalInputsPresent,false);
});
test('legacy corporate-action-blind page parser v1 and v2 archives cannot pass v3',()=>{
 for(const legacyVersion of ['ma75_jquants_v2_offline_daily_v1',
   'ma75_jquants_v2_offline_daily_v2']){
 const a=sessions().map(archive);
 a[0].version=legacyVersion;
 const r=plan({audits:a});
 assert.equal(r.states.incompleteExisting,1);
 assert.equal(r.archivedUsableBarCells,225);
 assert.equal(r.structuralHistoricalInputsPresent,false);
 }
});
test('corporate-action review must have no tradable bar and unverified action detail',()=>{
 for(const modify of [
  r=>{r.bar={code:'1301'};},
  r=>{delete r.actionDetails;},
  r=>{r.actionDetails.independentlyVerified=true;},
 ]){
  const a=sessions().map(archive);
  a[7].rows[0]={code:'1301',tradeDate:a[7].date,
   status:'CORPORATE_ACTION_REVIEW',bar:null,
   actionDetails:{adjustmentFactor:0.5,independentlyVerified:false}};
  a[7].counts={DAILY_BAR:2,CORPORATE_ACTION_REVIEW:1};
  a[7].structurallyUsableRawBars=2;
  modify(a[7].rows[0]);
  assert.equal(plan({audits:a}).states.incompleteExisting,1);
 }
});

test('structural full-archive readiness requires raw TSE calendar, not a claimed 76-day list',()=>{
 const audits=sessions().map(archive);
 const r=plan({audits,calendarSnapshot:null});
 assert.equal(r.calendarStructuralPass,false);
 assert.deepEqual(r.calendarIssues,['MISSING_RAW_TSE_CALENDAR']);
 assert.equal(r.structuralHistoricalInputsPresent,false);
 assert.equal(r.archivedUsableBarCells,228);
 assert.equal(r.allowedToRunApiCalls,false);
});
test('valid 76-date bars with a TSE holiday mismatch still cannot pass preflight',()=>{
 const raw=calendar(sessions());
 raw.records.find(r=>r.Date===sessions()[15]).HolDiv='3';
 const r=plan({audits:sessions().map(archive),calendarSnapshot:raw});
 assert.equal(r.calendarStructuralPass,false);
 assert.ok(r.calendarIssues.includes('TSE_SESSION_LIST_MISMATCH'));
 assert.equal(r.structuralHistoricalInputsPresent,false);
});
test('complete price and calendar structure is not proof of original data-provider timestamp',()=>{
 const r=plan({audits:sessions().map(archive)});
 assert.equal(r.calendarStructuralPass,true);
 assert.equal(r.independentlyAuthenticatedCalendar,false);
 assert.equal(r.providerRightsVerified,false);
 assert.equal(r.eligibleForProduction,false);
});
