import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMa75Chronology,validatedAiAtClose} from '../app/lib/research/ma75ChronologicalAudit.mjs';
const t=Date.parse('2026-10-15T00:00:00Z')/1000;
const input={version:'shadow',observations:[
 {code:'3762',kind:'BREAKOUT',signalTime:t,signalIndex:75,ma75Rising:true,volumeRatio:2,
  outcome5Status:'COMPLETED',return5Percent:5,budgetEligible:true},
 {code:'3762',kind:'RETEST',signalTime:t+86400,signalIndex:76,ma75Rising:false,volumeRatio:.8,
  outcome5Status:'PENDING',return5Percent:null,budgetEligible:true},
 {code:'9984',kind:'BREAKOUT',signalTime:Date.parse('2026-10-01T00:00:00Z')/1000,signalIndex:80,
  ma75Rising:false,volumeRatio:null,outcome5Status:'COMPLETED',return5Percent:-1,budgetEligible:false},
]};
const evidence={code:'3762',tradeDate:'2026-10-15',timeSlot:'15:15',aiPower:95,
 quoteTimestamp:'2026-10-15T06:00:00Z',snapshotSavedAt:'2026-10-15T06:14:00Z',createdAt:'2026-10-15T06:19:00Z'};
test('splits by event date without joining future outcomes into predicates',()=>{
 const r=auditMa75Chronology(input,{splitDate:'2026-10-10'});
 const late=r.groups.find(x=>x.period==='LATE'&&x.kind==='BREAKOUT'&&x.variant==='BOTH');
 assert.equal(late.completed,1);assert.equal(late.average5Percent,5);
 assert.equal(late.codes,1);assert.equal(late.adequateForDescriptiveComparison,false);
 assert.equal(r.groups.find(x=>x.period==='EARLY'&&x.kind==='BREAKOUT'&&x.variant==='ALL').average5Percent,-1);
 assert.equal(r.groups.find(x=>x.period==='LATE'&&x.kind==='RETEST'&&x.variant==='ALL').pending,1);
 assert.equal(r.eligibleForProduction,false);
});
test('no AI history produces unavailable statistics rather than zero win-rate',()=>{
 const r=auditMa75Chronology(input,{splitDate:'2026-10-10'});
 assert.equal(r.aiCoverage.observedAsOf,0);
 assert.equal(r.aiCoverage.ai90FiveDayAverage,null);
});
test('strict as-of timestamp chain; stale, after close and duplicate rejected',()=>{
 const row=input.observations[0];
 assert.equal(validatedAiAtClose(row,[evidence]).status,'OBSERVED_ASOF');
 assert.equal(validatedAiAtClose(row,[{...evidence,createdAt:'2026-10-15T06:31:00Z'}]).status,'INVALID_ASOF');
 assert.equal(validatedAiAtClose(row,[{...evidence,quoteTimestamp:'2026-10-14T06:00:00Z'}]).status,'INVALID_ASOF');
 assert.equal(validatedAiAtClose(row,[evidence,evidence]).status,'DUPLICATE');
 assert.equal(validatedAiAtClose(row,[{...evidence,aiPower:110}]).status,'INVALID_SCORE');
});
test('AI observed before close is counted only on matching day and completed outcomes',()=>{
 const a=auditMa75Chronology(input,{splitDate:'2026-10-10',aiEvidence:[evidence]});
 assert.equal(a.aiCoverage.observedAsOf,1);
 assert.equal(a.aiCoverage.scored90Complete,1);
 assert.equal(a.aiCoverage.ai90FiveDayAverage,5);
});
test('input validation rejects malformed cutoff',()=>{
 assert.throws(()=>auditMa75Chronology(input,{splitDate:'yesterday'}),TypeError);
});
