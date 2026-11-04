import test from 'node:test';
import assert from 'node:assert/strict';
import {auditReport,auditDirectory} from './post905-coverage-audit.mjs';
const base=()=>({code:'1301',date:'2026-10-29',
 status:'HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH',
 dailyReconciliationMatched:true,pageChainComplete:true,
 historicalQualityHold:false,metricsReleasedForHistoricalResearch:true,
 post905:{pre905BarCount:3,post905MorningBarCount:19,
 eligibleForProduction:false,eligibleForNotifications:false}});
test('old saved report cannot invent missing timestamps',()=>{
 const x=auditReport(base());
 assert.equal(x.timestampEvidence,'NOT_RETAINED_IN_REPORT');
 assert.equal(x.missingPre905Minutes,null);
 assert.equal(x.cohortCandidate,false);
});
test('new report records missing slots but cannot claim no-trade',()=>{
 const r=base();r.post905.observedPre905Minutes=['09:00','09:02','09:04'];
 const x=auditReport(r);
 assert.deepEqual(x.missingPre905Minutes,['09:01','09:03']);
 assert.equal(x.missingMinuteCause,'UNKNOWN_NO_TRADE_OR_DATA_GAP');
 assert.equal(x.eligibleForProduction,false);
});
test('directory audit checks code and date filename scope',()=>{
 const listing=()=>['1301_2026-10-29.json','not-a-report.json'];
 const reader=()=>JSON.stringify(base());
 const x=auditDirectory('unused',reader,listing);
 assert.equal(x.reports.length,1);
 assert.equal(x.missingClockEvidenceCount,1);
 assert.throws(()=>auditDirectory('unused',()=>JSON.stringify({...base(),code:'1332'}),listing));
});
