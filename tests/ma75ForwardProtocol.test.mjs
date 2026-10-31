import test from 'node:test';
import assert from 'node:assert/strict';
import {createMa75ForwardManifest, verifyMa75ForwardManifest,
  auditMa75ForwardEvidence, MA75_PREDECLARED_VARIANTS} from '../app/lib/research/ma75ForwardProtocol.mjs';
const options=()=>({
  frozenAt:'2026-10-31T10:00:00+09:00', firstSignalDate:'2026-11-02',
  cohortCodes:['9984','3762'],
  selectionPolicy:'Predeclared exchange-wide liquid stocks, not previously viewed chart stocks',
  source:{provider:'J-Quants',usageRights:'UNVERIFIED',corporateActions:'UNVERIFIED',timestampProvenance:'UNVERIFIED'},
});
const evidence=()=>({
  code:'3762',tradeDate:'2026-11-02',barClosedAt:'2026-11-02T06:30:00Z',
  barCapturedAt:'2026-11-02T06:45:00Z',featuresCapturedAt:'2026-11-02T06:50:00Z',
  signalRecordedAt:'2026-11-02T07:00:00Z',nextOpenAt:'2026-11-04T00:00:00Z',
  sourceProvider:'J-Quants',signalClose:120,priorClose:99,sma75:105,priorSma75:100,
});
test('canonical freeze sorts codes without choosing winners after the fact',()=>{
 const a=createMa75ForwardManifest(options());
 const b=createMa75ForwardManifest({...options(),cohortCodes:['3762','9984']});
 assert.equal(a.manifestSha256,b.manifestSha256);
 assert.deepEqual(a.codes,['3762','9984']);
 assert.equal(verifyMa75ForwardManifest(a),true);
 assert.equal(a.sourceStatus,'BLOCKED');
 assert.equal(a.eligibleForProduction,false);
 assert.ok(MA75_PREDECLARED_VARIANTS.includes('WAIT_FOR_RETEST_OR_CASH'));
});
test('tampering with frozen population fails content hash',()=>{
 const a=createMa75ForwardManifest(options());
 assert.equal(verifyMa75ForwardManifest({...a,codes:['3762']}),false);
 assert.throws(()=>auditMa75ForwardEvidence({...a,codes:['3762']},[evidence()]),TypeError);
});
test('freeze must precede first signal; no duplicate or unknown codes',()=>{
 assert.throws(()=>createMa75ForwardManifest({...options(),firstSignalDate:'2026-10-31'}),TypeError);
 assert.throws(()=>createMa75ForwardManifest({...options(),cohortCodes:['3762','3762']}),TypeError);
 assert.throws(()=>createMa75ForwardManifest({...options(),cohortCodes:['invalid']}),TypeError);
 assert.throws(()=>createMa75ForwardManifest({...options(),firstSignalDate:'2026-11-31'}),TypeError);
});
test('accept auditable same-day close signal but never announce validated profitability',()=>{
 const p=createMa75ForwardManifest(options());
 const r=auditMa75ForwardEvidence(p,[evidence()]);
 assert.equal(r.accepted,1);
 assert.equal(r.outcomeWinRate,null);
 assert.equal(r.readyForForwardCollection,false);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.requiresOfficialTradingCalendarVerification,true);
});
test('delayed 12-day bars cannot create actionable next-open candidate',()=>{
 const p=createMa75ForwardManifest(options());
 const r=auditMa75ForwardEvidence(p,[{...evidence(),barCapturedAt:'2026-11-14T12:00:00Z',
   featuresCapturedAt:'2026-11-14T12:30:00Z',signalRecordedAt:'2026-11-14T13:00:00Z'}]);
 assert.equal(r.accepted,0);
 assert.equal(r.excluded[0].reason,'LOOKAHEAD_OR_LATE_CAPTURE');
});
test('reject same-code/day duplicate, late decision, wrong source, not-crossed, unknown code',()=>{
 const p=createMa75ForwardManifest(options());
 const cases=[[evidence(),evidence()]];
 const dup=auditMa75ForwardEvidence(p,cases[0]);
 assert.equal(dup.accepted,1);
 assert.equal(dup.excluded[0].reason,'DUPLICATE_CODE_DAY');
 const variants=[
  [{...evidence(),sourceProvider:'Yahoo'},'SOURCE_MISMATCH'],
  [{...evidence(),signalClose:95},'NOT_SMA75_BREAKOUT'],
  [{...evidence(),code:'9999'},'NOT_FROZEN_COHORT'],
  [{...evidence(),signalRecordedAt:'2026-11-04T00:00:00Z'},'LOOKAHEAD_OR_LATE_CAPTURE'],
  [{...evidence(),tradeDate:'2026-10-30'},'BEFORE_FROZEN_START'],
 ];
 for(const [sample,reason] of variants)
   assert.equal(auditMa75ForwardEvidence(p,[sample]).excluded[0].reason,reason);
});
test('source verified flag is independent of outcome evidence',()=>{
 const opt=options();
 opt.source={provider:'J-Quants',usageRights:'VERIFIED',corporateActions:'VERIFIED',timestampProvenance:'VERIFIED'};
 const p=createMa75ForwardManifest(opt);
 const r=auditMa75ForwardEvidence(p,[evidence()]);
 assert.equal(r.readyForForwardCollection,true);
 assert.equal(r.eligibleForProduction,false);
});
test('source status cannot be forged by modifying un-hashed presentation fields',()=>{
 const p=createMa75ForwardManifest(options());
 const forged={...p,blockers:[],sourceStatus:'SOURCE_EVIDENCE_RECORDED'};
 const r=auditMa75ForwardEvidence(forged,[evidence()]);
 assert.equal(r.readyForForwardCollection,false);
 assert.equal(r.sourceStatus,'BLOCKED');
});
