import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 analyzeMa75SavedCompletion
} from '../scripts/research/ma75-local-coverage-audit.mjs';

const dates=Array.from({length:91},(_,i)=>
 new Date(Date.parse('2026-05-01T00:00:00Z')+86400000*i).toISOString().slice(0,10));
const frozen=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',
 firstEligibleSignalDate:'2026-11-02',
 populationSize:2,
 codes:['1301','186A'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'App-observed sample, selected after retrospective dates.',
 sourceChecks:{
  providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
  splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
  liquidityCoverage:'UNVERIFIED'
 },
 automaticCollectionEnabled:false,
 liveTradingEligible:false,notificationEligible:false,
 independentlyValidatedForwardReturns:0
});
const records=()=>dates.map((date,i)=>{
 const bar=(code)=>({
  code,tradeDate:date,open:i>=80?105:100,high:i>=80?106:101,
  low:i>=80?104:99,close:i>=80?105:100,volume:1000,unadjusted:true
 });
 const issue=i<2?'MISSING_PROVIDER_ROW':i===40?'CORPORATE_ACTION_REVIEW':null;
 return {date,project:{
  date,completeProviderPagination:true,
  originalAllListedRows:i<2?1:2,
  audit:{rows:[
   {code:'1301',status:'DAILY_BAR',bar:bar('1301')},
   issue?{code:'186A',status:issue,bar:null}:
    {code:'186A',status:'DAILY_BAR',bar:bar('186A')}
  ]}
 }};
});
const baseline=(rs=records())=>({
 version:'ma75_jquants_bulk_retrospective_v1',
 status:'HISTORICAL_ONLY',provider:'JQUANTS_V2_ORIGINAL_DAILY',
 from:rs[0].date,to:rs.at(-1).date,sessions:rs.length,
 freezeSize:2,providerDateCaptures:rs.length,
 expectedCodeSessions:2*rs.length,
 fullHistoryCodes:1,incompleteCodes:1,
 originalAllListedRows:rs.reduce((total,r)=>total+r.project.originalAllListedRows,0),
 unavailableFrozenCodeSessionCounts:{MISSING_PROVIDER_ROW:2,CORPORATE_ACTION_REVIEW:1},
 structurallyCompleteFrozenUniverse:false,
 results:null,paired:null,independentlyValidatedWinRate:null,
 eligibleForProduction:false,eligibleForNotifications:false
});

test('audit reconciles complete cases, missing months and corporate action without pretending full-cohort edge',()=>{
 const rs=records();
 const report=analyzeMa75SavedCompletion({
  freeze:frozen(),baselineSummary:baseline(rs),dateRecords:rs
 });
 assert.equal(report.status,'OFFLINE_HISTORICAL_DIAGNOSTIC_ONLY');
 assert.equal(report.dates,91);
 assert.equal(report.frozenCodes,2);
 assert.equal(report.completeHistoryCodes,1);
 assert.equal(report.incompleteHistoryCodes,1);
 assert.deepEqual(report.unavailableCodeSessions,{
  CORPORATE_ACTION_REVIEW:1,MISSING_PROVIDER_ROW:2
 });
 assert.deepEqual(report.missingByCode,[{
  code:'186A',missingSessions:3,
  reasonCounts:{MISSING_PROVIDER_ROW:2,CORPORATE_ACTION_REVIEW:1},
  firstIssue:dates[0],lastIssue:dates[40],
  unavailableAtStart:2,unavailableAtEnd:0
 }]);
 assert.equal(report.historicalCompleteCaseDiagnostic.codesWithCompleteHistories,1);
 assert.equal(report.historicalCompleteCaseDiagnostic.acceptedByStudy,1);
 assert.ok(report.historicalCompleteCaseDiagnostic.stats.find(x=>x.kind==='BREAKOUT').completed>=1);
 assert.equal(report.historicalCompleteCaseDiagnostic.forwardIndependentValidation,false);
 assert.equal(report.historicalCompleteCaseDiagnostic.pairSelectionUsesFutureRetest,true);
 const x=report.historicalCompleteCaseDiagnostic.precloseConditions;
 assert.equal(x.trueIndependentChronologicalHoldout,false);
 assert.equal(x.featureCutoff,'BREAKOUT_SIGNAL_DAY_COMPLETED_CLOSE');
 assert.equal(x.full953HeadlineResults,null);
 assert.ok(x.conditions.find(g=>g.condition==='ALL_BREAKOUTS').completed>=1);
 assert.equal(x.eligibleForProduction,false);
 assert.equal(report.full953HeadlineResults,null);
 assert.equal(report.full953HeadlinePaired,null);
 assert.equal(report.independentlyValidatedWinRate,null);
 assert.equal(report.eligibleForProduction,false);
 assert.equal(report.eligibleForNotifications,false);
 assert.equal(report.eligibleForAIPowerScoring,false);
 assert.equal(report.eligibleForTrading,false);
});

test('original frozen denominator cannot be shrunk to rebrand complete-case as full cohort',()=>{
 const rs=records(),s=baseline(rs);
 assert.throws(()=>analyzeMa75SavedCompletion({
  freeze:frozen(),baselineSummary:{...s,freezeSize:1},dateRecords:rs
 }),/BASELINE_SUMMARY_UNTRUSTED/);
 assert.throws(()=>analyzeMa75SavedCompletion({
  freeze:frozen(),baselineSummary:{...s,results:[{winRatePercent:100}]},
  dateRecords:rs
 }),/BASELINE_SUMMARY_UNTRUSTED/);
 assert.throws(()=>analyzeMa75SavedCompletion({
  freeze:frozen(),baselineSummary:{...s,fullHistoryCodes:2,incompleteCodes:0},
  dateRecords:rs
 }),/FROZEN_DENOMINATOR_MISMATCH/);
});

test('missing cached date, out-of-sequence date, provider row count mismatch fail closed',()=>{
 const rs=records(),s=baseline(rs);
 for(const manipulated of [
  rs.slice(1),
  [rs[1],rs[0],...rs.slice(2)],
  rs.map((v,i)=>i===3?{...v,project:{...v.project,originalAllListedRows:9999}}:v),
  rs.map((v,i)=>i===5?{...v,project:{...v.project,audit:{rows:v.project.audit.rows.slice(0,1)}}}:v)
 ]){
  assert.throws(()=>analyzeMa75SavedCompletion({
   freeze:frozen(),baselineSummary:s,dateRecords:manipulated
  }),/LOCAL_CAPTURE_AUDIT_/);
 }
});

test('no API, credential, filesystem writes, deployments or broker interaction in audit source',()=>{
 const source=readFileSync(new URL(
  '../scripts/research/ma75-local-coverage-audit.mjs',import.meta.url),'utf8');
 const executable=source.split('\n').filter(line=>!line.trim().startsWith('*')&&!line.trim().startsWith('//')).join('\n');
 assert.doesNotMatch(executable,/\bfetch\s*\(|writeFileSync|unlinkSync|renameSync|vercel deploy|supabase|JQUANTS_API_KEY/);
 assert.match(executable,/validateMa75SavedDailyForReplay\(freeze,date,stored\)/);
 assert.match(executable,/readMa75PrivateSavedDate/);
});
