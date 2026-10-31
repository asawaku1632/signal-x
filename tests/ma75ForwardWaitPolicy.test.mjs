import test from 'node:test';
import assert from 'node:assert/strict';
import {createMa75ForwardManifest} from '../app/lib/research/ma75ForwardProtocol.mjs';
import {auditMa75ForwardWaitPolicy} from '../app/lib/research/ma75ForwardWaitPolicy.mjs';
const sessions=['2026-11-02','2026-11-04','2026-11-05','2026-11-06','2026-11-09','2026-11-10',
 '2026-11-11','2026-11-12','2026-11-13','2026-11-16','2026-11-17','2026-11-18',
 '2026-11-19','2026-11-20','2026-11-24','2026-11-25'];
const bar=(d,close=110,open=close,low=close-1)=>({tradeDate:d,open,high:Math.max(open,close)+2,
 low,close,volume:1000,closedAt:d+'T06:30:00Z',capturedAt:d+'T06:45:00Z'});
const manifest=()=>createMa75ForwardManifest({frozenAt:'2026-10-31T10:00:00+09:00',
 firstSignalDate:'2026-11-02',cohortCodes:['3762'],selectionPolicy:'Universe fixed before the first upcoming trade date',
 source:{provider:'J-Quants',usageRights:'UNVERIFIED',corporateActions:'UNVERIFIED',timestampProvenance:'UNVERIFIED'}});
const fixture=(mode='CASH')=>{
 const start=Date.parse('2026-07-01T00:00:00Z');
 const history=Array.from({length:76},(_,i)=>bar(new Date(start+i*86400000).toISOString().slice(0,10),100));
 history[75]=bar('2026-11-02',105,100,99);
 const future=sessions.slice(1).map(d=>bar(d,110,110,109));
 if(mode==='RETEST')future[0]=bar(sessions[1],106,102,100);
 if(mode==='INVALIDATED')future[0]=bar(sessions[1],90,100,89);
 const ma75=(74*100+105)/75;
 const candidate={id:'3762:2026-11-02',code:'3762',tradeDate:'2026-11-02',
   signalRecordedAt:'2026-11-02T07:00:00Z',closingPrice:105,sma75:ma75,
   variantMatches:{BREAKOUT_ALL:true}};
 const batch={code:'3762',signalDate:'2026-11-02',sourceProvider:'J-Quants',
   receivedAt:'2026-11-25T07:00:00Z',historyCapturedAt:'2026-11-02T06:45:00Z',history,future};
 return {candidate,batch};
};
const evaluate=(mode='CASH',opts={})=>{
 const p=manifest(),f=fixture(mode);
 return auditMa75ForwardWaitPolicy(p,{manifestSha256:p.manifestSha256,
  candidates:opts.candidates??[f.candidate]},
  {exchangeSessions:opts.sessions??sessions,batches:opts.batches??[f.batch]});
};
test('all-matured breakout without retest remains a cash opportunity, not a win',()=>{
 const r=evaluate('CASH');
 assert.equal(r.complete,1);
 assert.equal(r.tradedRetests,0);
 assert.equal(r.cashOpportunities,1);
 assert.equal(r.hypotheticalWaitOrCashMean,0);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.validatedForwardWinRate,null);
});
test('first retest is traded at the following open and exited at retest plus five sessions',()=>{
 const r=evaluate('RETEST');
 assert.equal(r.complete,1);
 assert.equal(r.tradedRetests,1);
 const x=r.observations[0].detail;
 assert.equal(x.retestSession,'2026-11-04');
 assert.equal(x.waitEntrySession,'2026-11-05');
 assert.equal(x.waitExitSession,'2026-11-11');
 assert.equal(x.waitCash,false);
});
test('close below SMA75 invalidates later retests, keeps no-trade denominator',()=>{
 const r=evaluate('INVALIDATED');
 assert.equal(r.complete,1);
 assert.equal(r.cashOpportunities,1);
 assert.equal(r.observations[0].detail.invalidated,true);
});
test('unfinished fifteen-session horizon and incomplete bars remain pending',()=>{
 assert.equal(evaluate('CASH',{sessions:sessions.slice(0,8)}).observations[0].status,'PENDING_HORIZON');
 const x=fixture('CASH');x.batch.future=x.batch.future.slice(0,14);
 assert.equal(evaluate('CASH',{batches:[x.batch]}).observations[0].status,'PENDING_BARS');
 assert.equal(evaluate('CASH',{batches:[]}).hypotheticalWaitOrCashMean,null);
});
test('duplicate candidates or batches fail closed instead of double-counting winners',()=>{
 const x=fixture();
 assert.equal(evaluate('CASH',{candidates:[x.candidate,x.candidate]}).quarantined,2);
 assert.equal(evaluate('CASH',{batches:[x.batch,x.batch]}).observations[0].status,'QUARANTINED_DUPLICATE_BATCH');
});
test('bars after wrong sessions, invalid OHLC, provenance and corporate-action gaps quarantine',()=>{
 let x=fixture();x.batch.future[0].tradeDate='2026-11-03';
 assert.equal(evaluate('CASH',{batches:[x.batch]}).observations[0].status,'QUARANTINED_BARS');
 x=fixture();x.batch.future[2].high=1;
 assert.equal(evaluate('CASH',{batches:[x.batch]}).observations[0].status,'QUARANTINED_BARS');
 x=fixture();x.batch.future[2].capturedAt='2026-11-04T02:00:00Z';
 assert.equal(evaluate('CASH',{batches:[x.batch]}).observations[0].status,'QUARANTINED_CAPTURE');
 x=fixture();x.batch.future[2]=bar(sessions[3],250,250,249);
 assert.equal(evaluate('CASH',{batches:[x.batch]}).observations[0].status,'QUARANTINED_CORPORATE_ACTION');
});
test('invalid as-of input cannot retroactively qualify a purchased breakout',()=>{
 let x=fixture();x.candidate.sma75=200;
 assert.equal(evaluate('CASH',{candidates:[x.candidate]}).observations[0].status,'QUARANTINED_ASOF_RECALC');
 x=fixture();x.candidate.signalRecordedAt='2026-11-04T00:00:00Z';
 assert.equal(evaluate('CASH',{candidates:[x.candidate]}).observations[0].status,'QUARANTINED_ASOF');
 x=fixture();x.batch.historyCapturedAt='2026-11-10T06:45:00Z';
 assert.equal(evaluate('CASH',{batches:[x.batch]}).observations[0].status,'QUARANTINED_ASOF');
});
test('unfrozen code and wrong provider are excluded',()=>{
 const x=fixture();x.candidate.code='9999';x.candidate.id='9999:2026-11-02';
 assert.equal(evaluate('CASH',{candidates:[x.candidate]}).observations[0].status,'QUARANTINED_SIGNAL');
 const y=fixture();y.batch.sourceProvider='Other';
 assert.equal(evaluate('CASH',{batches:[y.batch]}).observations[0].status,'QUARANTINED_SOURCE');
});
