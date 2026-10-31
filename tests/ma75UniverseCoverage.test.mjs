import test from 'node:test';
import assert from 'node:assert/strict';
import {createMa75ForwardManifest} from '../app/lib/research/ma75ForwardProtocol.mjs';
import {auditMa75UniverseCoverage} from '../app/lib/research/ma75UniverseCoverage.mjs';
const sessions=['2026-11-02','2026-11-04'];
const manifest=()=>createMa75ForwardManifest({
 frozenAt:'2026-10-31T10:00:00+09:00',firstSignalDate:'2026-11-02',
 cohortCodes:['3762','9984'],selectionPolicy:'All frozen liquid stocks, including negative future performances',
 source:{provider:'J-Quants',usageRights:'UNVERIFIED',
 corporateActions:'UNVERIFIED',timestampProvenance:'UNVERIFIED'},
});
const observation=(code,tradeDate,classification='NO_CROSS')=>({
 code,tradeDate,classification,sourceProvider:'J-Quants',
 barClosedAt:tradeDate+'T06:30:00Z',
 capturedAt:tradeDate+'T06:45:00Z',
 classifiedAt:tradeDate+'T06:50:00Z',
 nextOpenAt:'2026-11-05T00:00:00Z',
 close:100,priorClose:100,sma75:100,priorSma75:100,
});
const breakout=()=>({...observation('3762','2026-11-02','BREAKOUT'),close:105});
const rows=()=>[breakout(),
 observation('9984','2026-11-02'),observation('3762','2026-11-04'),
 observation('9984','2026-11-04')];
const replay=p=>({manifestSha256:p.manifestSha256,
 candidates:[{id:'3762:2026-11-02',code:'3762',tradeDate:'2026-11-02'}]});
const run=(obs,alternateReplay=null,dates=sessions)=>{
 const p=manifest();
 return auditMa75UniverseCoverage(p,{exchangeSessions:dates,
  observations:obs,replay:alternateReplay??replay(p)});
};
test('tracks every frozen code-day, including no-cross, without claiming profits',()=>{
 const r=run(rows());
 assert.equal(r.expectedCodeDates,4);
 assert.equal(r.validObservedCodeDates,4);
 assert.equal(r.observedBreakouts,1);
 assert.equal(r.observedNoCross,3);
 assert.equal(r.coveragePercent,100);
 assert.equal(r.integrityPass,true);
 assert.equal(r.validatedWinRate,null);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.independentlyAuthenticatedCoverage,false);
});
test('missing losers or non-signals reduce denominator-based coverage',()=>{
 const list=rows().filter(x=>x.code!=='9984');
 const r=run(list);
 assert.equal(r.coveragePercent,50);
 assert.equal(r.unavailableCodeDates,2);
 assert.equal(r.integrityPass,false);
 assert.ok(r.missingSamples.includes('9984:2026-11-02'));
});
test('explicit unavailable and quarantined rows never count as observed crossovers',()=>{
 const list=rows();
 list[1]={code:'9984',tradeDate:'2026-11-02',classification:'DATA_MISSING',reason:'no captured provider bar'};
 list[3]={code:'9984',tradeDate:'2026-11-04',classification:'QUARANTINED',reason:'unverified split factor'};
 const r=run(list);
 assert.equal(r.validObservedCodeDates,2);
 assert.equal(r.declaredMissing,1);
 assert.equal(r.declaredQuarantined,1);
 assert.equal(r.integrityPass,false);
});
test('duplicate all-cohort observation rows are excluded even with one breakout',()=>{
 const list=rows();
 const r=run([...list,list[2]]);
 assert.equal(r.integrityPass,false);
 assert.ok(r.excluded.some(x=>x.reason==='DUPLICATE_CODE_DAY'));
 assert.equal(r.validObservedCodeDates,3);
});
test('silent breakout omission or invented replay breakout is an integrity violation',()=>{
 const a=rows();
 const p=manifest();
 const without=auditMa75UniverseCoverage(p,{exchangeSessions:sessions,
  observations:a,replay:{manifestSha256:p.manifestSha256,candidates:[]}});
 assert.equal(without.integrityPass,false);
 assert.ok(without.excluded.some(x=>x.reason==='LEDGER_BREAKOUT_NOT_IN_REPLAY'));
 const invented=run(a,{manifestSha256:p.manifestSha256,candidates:[
  {code:'9984',tradeDate:'2026-11-02'}]});
 assert.equal(invented.integrityPass,false);
 assert.ok(invented.excluded.some(x=>x.reason==='REPLAY_SIGNAL_NOT_IN_FROZEN_LEDGER'));
});
test('failed crossover math, wrong provider and future-time capture are excluded',()=>{
 const list=rows();
 list[0]={...list[0],close:99};
 list[1]={...list[1],sourceProvider:'Other'};
 list[2]={...list[2],classifiedAt:'2026-11-06T08:00:00Z'};
 const r=run(list);
 assert.equal(r.integrityPass,false);
 assert.ok(r.excluded.some(x=>x.reason==='INCONSISTENT_CROSSOVER'));
 assert.ok(r.excluded.some(x=>x.reason==='SOURCE_MISMATCH'));
 assert.ok(r.excluded.some(x=>x.reason==='INVALID_ASOF_TRACE'));
});
test('invalid session ordering and dates fail closed',()=>{
 assert.throws(()=>run(rows(),null,['2026-11-04','2026-11-02']),TypeError);
 assert.throws(()=>run(rows(),null,['2026-11-31']),TypeError);
 assert.throws(()=>run(rows(),null,['2026-10-30']),TypeError);
});
test('data missing without reason is rejected, not converted into a no-cross',()=>{
 const a=rows();
 a[1]={code:'9984',tradeDate:'2026-11-02',classification:'DATA_MISSING'};
 const r=run(a);
 assert.ok(r.excluded.some(x=>x.reason==='MISSING_EXCLUSION_REASON'));
 assert.equal(r.integrityPass,false);
});
