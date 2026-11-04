import test from 'node:test';
import assert from 'node:assert/strict';
import {createMa75ForwardManifest} from '../app/lib/research/ma75ForwardProtocol.mjs';
import {settleMa75ForwardOutcomes} from '../app/lib/research/ma75ForwardOutcome.mjs';
const sessions=['2026-11-02','2026-11-04','2026-11-05','2026-11-06','2026-11-09','2026-11-10','2026-11-11'];
const close=d=>d+'T06:30:00Z';
const capture=d=>d+'T06:40:00Z';
const manifest=()=>createMa75ForwardManifest({
 frozenAt:'2026-10-31T09:00:00+09:00',firstSignalDate:'2026-11-02',
 cohortCodes:['3762'],selectionPolicy:'Frozen before outcomes: liquid securities selected by fixed algorithm',
 source:{provider:'J-Quants',usageRights:'UNVERIFIED',corporateActions:'UNVERIFIED',timestampProvenance:'UNVERIFIED'},
});
const candidate=()=>({id:'3762:2026-11-02',code:'3762',tradeDate:'2026-11-02',
 signalRecordedAt:'2026-11-02T07:00:00Z',closingPrice:2000});
const replay=(p,c=[candidate()])=>({manifestSha256:p.manifestSha256,candidates:c});
const bar=(d,i)=>({tradeDate:d,open:2000+i*10,close:2010+i*10,
 high:2030+i*10,low:1990+i*10,volume:10000,barClosedAt:close(d),capturedAt:capture(d)});
const batch=()=>({code:'3762',signalDate:'2026-11-02',sourceProvider:'J-Quants',
 receivedAt:'2026-11-10T06:50:00Z',
 candles:sessions.slice(1,6).map(bar)});
const run=(opts={},c=[candidate()],p=manifest())=>settleMa75ForwardOutcomes(p,replay(p,c),{
 exchangeSessions:opts.sessions??sessions,outcomeBatches:opts.batches??[batch()]});
test('five exchange sessions skip Japan holiday and settle with friction',()=>{
 const result=run();
 assert.equal(result.completed,1);
 assert.equal(result.pending,0);
 assert.equal(result.quarantined,0);
 assert.equal(result.results[0].status,'COMPLETED');
 const d=result.results[0].details;
 assert.equal(d.entrySession,'2026-11-04');
 assert.equal(d.exitSession5,'2026-11-10');
 assert.equal(d.budgetEligible,true);
 assert.equal(d.profit5Yen100,Math.round(((2050*.999)-(2000*1.001))*100));
 assert.equal(result.eligibleForProduction,false);
 assert.equal(result.sourceIndependentlyVerified,false);
 assert.equal(result.validatedForwardWinRate,null);
 assert.equal(result.validatedForwardOutcomes,0);
 assert.equal(result.independentlyReproduced,false);
 assert.equal(typeof d.evidenceDigest,'string');
 assert.equal(d.evidenceDigest.length,64);
});
test('without outcome batch return remains null, never invented as 0%',()=>{
 const r=run({batches:[]});
 assert.equal(r.pending,1);assert.equal(r.completed,0);
 assert.equal(r.average5Percent,null);
 assert.equal(r.positive5Percent,null);
 assert.equal(r.results[0].status,'PENDING_DATA');
});
test('calendar ends too early or omits original signal => pending',()=>{
 assert.equal(run({sessions:sessions.slice(0,5)}).results[0].status,'PENDING_CALENDAR_HORIZON');
 assert.equal(run({sessions:sessions.slice(1)}).results[0].status,'PENDING_CALENDAR_SIGNAL');
});
test('missing fifth bar stays pending and does not distort win rate',()=>{
 const b=batch();b.candles=b.candles.slice(0,4);
 const r=run({batches:[b]});
 assert.equal(r.results[0].status,'PENDING_MISSING_BARS');
 assert.equal(r.positive5Percent,null);
});
test('duplicate candidates quarantine all duplicates, duplicate batches quarantine',()=>{
 const duplicate=run({},[candidate(),candidate()]);
 assert.equal(duplicate.completed,0);assert.equal(duplicate.quarantined,2);
 assert.ok(duplicate.results.every(x=>x.status==='QUARANTINED_DUPLICATE_CANDIDATE'));
 const dupBatch=run({batches:[batch(),batch()]});
 assert.equal(dupBatch.results[0].status,'QUARANTINED_DUPLICATE_BATCH');
});
test('invalid and mismatched dates never count as completed',()=>{
 const wrong=batch();wrong.candles[0].tradeDate='2026-11-03';
 assert.equal(run({batches:[wrong]}).results[0].status,'QUARANTINED_WRONG_OR_DUPLICATE_SESSION');
 const dup=batch();dup.candles[4]={...dup.candles[4],tradeDate:dup.candles[3].tradeDate};
 assert.equal(run({batches:[dup]}).results[0].status,'QUARANTINED_WRONG_OR_DUPLICATE_SESSION');
 const badCalendar=[sessions[0],sessions[1],sessions[1]];
 assert.throws(()=>run({sessions:badCalendar}),TypeError);
});
test('late receipt claims, preclose bar captures and invalid prices are quarantined',()=>{
 const early=batch();early.receivedAt='2026-11-09T05:00:00Z';
 assert.equal(run({batches:[early]}).results[0].status,'QUARANTINED_INVALID_RECEIPT');
 const before=batch();before.candles[2].capturedAt='2026-11-06T05:59:00Z';
 assert.equal(run({batches:[before]}).results[0].status,'QUARANTINED_BAR_OR_PROVENANCE');
 const invalid=batch();invalid.candles[0].low=10000;
 assert.equal(run({batches:[invalid]}).results[0].status,'QUARANTINED_BAR_OR_PROVENANCE');
});
test('wrong provider or suspicious split cannot create a win',()=>{
 const wrong=batch();wrong.sourceProvider='Other';
 assert.equal(run({batches:[wrong]}).results[0].status,'QUARANTINED_SOURCE_MISMATCH');
 const split=batch();split.candles[3]={...split.candles[3],open:4500,close:4500,high:4550,low:4450};
 assert.equal(run({batches:[split]}).results[0].status,'QUARANTINED_CORPORATE_ACTION');
});
test('decision must be after close and before next exchange open',()=>{
 const late=candidate();late.signalRecordedAt='2026-11-04T00:00:00Z';
 assert.equal(run({},[late]).results[0].status,'QUARANTINED_INVALID_SIGNAL');
 const early=candidate();early.signalRecordedAt='2026-11-02T05:00:00Z';
 assert.equal(run({},[early]).results[0].status,'QUARANTINED_INVALID_SIGNAL');
});
test('tampered manifest/replay and unauthorized candidate are blocked',()=>{
 const p=manifest();const r=replay(p);
 assert.throws(()=>settleMa75ForwardOutcomes({...p,codes:['9999']},r,{exchangeSessions:sessions}),TypeError);
 assert.throws(()=>settleMa75ForwardOutcomes(p,{...r,manifestSha256:'wrong'},{exchangeSessions:sessions}),TypeError);
 const outside={...candidate(),code:'9999',id:'9999:2026-11-02'};
 assert.equal(run({},[outside]).results[0].status,'QUARANTINED_OUT_OF_COHORT');
});
