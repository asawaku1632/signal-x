import test from 'node:test';
import assert from 'node:assert/strict';
import {argsForMa75PreviewChild,runMa75PreviewChild}
 from '../scripts/research/ma75-jquants-vercel-preview-entry.mjs';

const environment={
 SIGNALX_MA75_LOCAL_FROM:'2026-05-01',
 SIGNALX_MA75_LOCAL_TO:'2026-10-30',
 SIGNALX_MA75_LOCAL_BULK_EXECUTE:'YES',
 SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY:'YES',
 JQUANTS_API_KEY:'test-placeholder-do-not-call',
};

test('Windows no-flag Vercel child passes validated range internally',()=>{
 assert.deepEqual(argsForMa75PreviewChild(environment),[
  '--from=2026-05-01','--to=2026-10-30','--execute'
 ]);
});

test('missing opt-in flags prevents any call into historical provider runner',async()=>{
 for(const key of ['SIGNALX_MA75_LOCAL_BULK_EXECUTE',
  'SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY']){
  const invalid={...environment,[key]:'NO'};
  let invoked=0;
  await assert.rejects(
   ()=>runMa75PreviewChild({env:invalid,run:async()=>{invoked++;}}),
   /EXPLICIT_RESEARCH_EXECUTION_CONSENT_REQUIRED/
  );
  assert.equal(invoked,0);
 }
});

test('missing/redacted Preview key blocks provider activity, never logs value',async()=>{
 for(const key of [undefined,'','[SENSITIVE]','[REDACTED]']){
  let invoked=0;
  const env={...environment,JQUANTS_API_KEY:key};
  await assert.rejects(
   ()=>runMa75PreviewChild({env,run:async()=>{invoked++;}}),
   /PRIVATE_JQUANTS_KEY_NOT_AVAILABLE/
  );
  assert.equal(invoked,0);
 }
});

test('bad date or oversized historical interval is stopped before provider runner',async()=>{
 const bad=[
  {SIGNALX_MA75_LOCAL_FROM:'2026-11-31'},
  {SIGNALX_MA75_LOCAL_TO:'2027-03-01'},
  {SIGNALX_MA75_LOCAL_FROM:'2026-12-01'},
 ];
 for(const change of bad){
  let invoked=0;
  const env={...environment,...change};
  await assert.rejects(
   ()=>runMa75PreviewChild({env,run:async()=>{invoked++;}}),
   /INVALID_BOUNDED_HISTORICAL_DATE_RANGE/
  );
  assert.equal(invoked,0);
 }
});

test('approved child invokes existing research function once without extra CLI flags',async()=>{
 const calls=[];
 const result=await runMa75PreviewChild({env:environment,
  run:async(args,opts)=>{
   calls.push({args,env:opts.env});
   return {status:'MOCK_ONLY',eligibleForProduction:false};
  }
 });
 assert.equal(result.status,'MOCK_ONLY');
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0].args,[
  '--from=2026-05-01','--to=2026-10-30','--execute'
 ]);
 assert.equal(calls[0].env.JQUANTS_API_KEY,'test-placeholder-do-not-call');
});
