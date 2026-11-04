import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 parseMa75ForwardDayArgs,planMa75ForwardDay,runMa75ForwardOneDay
} from '../scripts/research/ma75-forward-local-one-day.mjs';

const freeze=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',
 firstEligibleSignalDate:'2026-11-02',
 populationSize:2,codes:['1301','186A'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'An application snapshot selection, not full TSE historical survivorship.',
 sourceChecks:{
  providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
  splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
  liquidityCoverage:'UNVERIFIED'
 },
 automaticCollectionEnabled:false,liveTradingEligible:false,
 notificationEligible:false,independentlyValidatedForwardReturns:0
});
const clock=date=>()=>new Date(date);
const fileMissing=()=>{const e=new Error('missing');e.code='ENOENT';throw e};
const fileInfo=path=>path.endsWith('research-private')?
 {isDirectory:()=>true,isSymbolicLink:()=>false}:fileMissing();
const read=()=>JSON.stringify(freeze());

test('2026-11-01 readiness is zero network and cannot fetch 2026-11-02 daily bars',async()=>{
 let calls=0;
 const out=await runMa75ForwardOneDay(['--date=2026-11-02'],{
  clock:clock('2026-11-01T09:50:00Z'),read,fileInfo,
  fetchImpl:async()=>{calls++;throw Error('unexpected network');},
  capture:async()=>{calls++;throw Error('unexpected capture');}
 });
 assert.equal(out.status,'DRY_RUN_SESSION_NOT_YET_PUBLISHED');
 assert.equal(out.date,'2026-11-02');
 assert.equal(out.earliestRequestedCaptureUtc,'2026-11-02T07:30:00Z');
 assert.equal(out.networkRequests,0);
 assert.equal(out.filesWritten,0);
 assert.equal(calls,0);
 assert.equal(out.independentForwardOutcomes,0);
 assert.equal(out.eligibleForNotifications,false);
 assert.equal(out.eligibleForProduction,false);
});

test('execute cannot capture a future or pre-release session even with a valid private key',async()=>{
 let calls=0;
 for(const when of ['2026-11-01T23:00:00Z','2026-11-02T07:29:59Z']){
  await assert.rejects(()=>runMa75ForwardOneDay([
   '--date=2026-11-02','--execute'
  ],{clock:clock(when),read,fileInfo,
   env:{JQUANTS_API_KEY:'private',SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY:'YES'},
   capture:async()=>{calls++}
  }),/MA75_FORWARD_DAY_SESSION_NOT_YET_ELIGIBLE_FOR_CAPTURE/);
 }
 assert.equal(calls,0);
});

test('capturing after release requires explicit private environment and exact safe output',async()=>{
 let invoked=0;
 const opts={
  clock:clock('2026-11-02T08:00:00Z'),read,fileInfo,
  env:{JQUANTS_API_KEY:'mock-key',SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY:'YES'},
  capture:async(args,config)=>{
   invoked++;
   assert.deepEqual(args,[
    '--date=2026-11-02',
    '--output=research-private/ma75-forward-2026-11-02-jquants-daily.json',
    '--execute'
   ]);
   assert.equal(config.env.JQUANTS_API_KEY,'mock-key');
   return {status:'ORIGINAL_ONE_DATE_SAVED_PRIVATE',date:'2026-11-02',
    originalRows:4440,pages:2,frozenRows:2};
  }
 };
 const r=await runMa75ForwardOneDay(['--date=2026-11-02','--execute'],opts);
 assert.equal(invoked,1);
 assert.equal(r.status,'ORIGINAL_FORWARD_DAY_CAPTURED_PRIVATE');
 assert.equal(r.originalProviderRows,4440);
 assert.equal(r.originalPages,2);
 assert.equal(r.producesSignal,false);
 assert.equal(r.signalNotGenerated,true);
 assert.equal(r.providerActuallyPublishedVerified,false);
 assert.equal(r.independentForwardOutcomes,0);
 assert.equal(r.eligibleForTrading,false);
 assert.equal(r.eligibleForAIPowerScoring,false);
 assert.equal(JSON.stringify(r).includes('mock-key'),false);
 await assert.rejects(()=>runMa75ForwardOneDay([
  '--date=2026-11-02','--execute'
 ],{...opts,env:{}}),/MA75_FORWARD_DAY_EXPLICIT_PRIVATE_CONSENT_REQUIRED/);
});

test('never replace existing post-freeze page or follow local output directory symlink',async()=>{
 let count=0;
 const options={clock:clock('2026-11-02T08:00:00Z'),read,
  env:{JQUANTS_API_KEY:'private',SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY:'YES'},
  capture:async()=>{count++;throw Error('must not execute')}
 };
 await assert.rejects(()=>runMa75ForwardOneDay([
  '--date=2026-11-02','--execute'
 ],{...options,fileInfo:()=>({isFile:()=>true})}),
 /MA75_FORWARD_DAY_EXISTING_PRIVATE_CAPTURE_NO_OVERWRITE/);
 await assert.rejects(()=>runMa75ForwardOneDay([
  '--date=2026-11-02','--execute'
 ],{...options,fileInfo:path=>path.endsWith('research-private')?
  {isDirectory:()=>true,isSymbolicLink:()=>true}:fileMissing()}),
 /MA75_FORWARD_DAY_PRIVATE_DIRECTORY_UNSAFE/);
 assert.equal(count,0);
});

test('freeze date and argument schema prohibit backfill disguised as forward',()=>{
 assert.throws(()=>planMa75ForwardDay(['--date=2026-10-30'],{
  freeze:freeze(),clock:clock('2026-11-02T10:00:00Z')
 }),/MA75_FORWARD_DAY_PRE_FREEZE_CAPTURE_NOT_ALLOWED/);
 for(const argv of [
  [],['--execute'],['--date=2026-11-31'],
  ['--date=2026-11-02','--date=2026-11-04'],
  ['--date=2026-11-02','--execute','--execute'],
  ['--date=2026-11-02','--output=private.json'],
  ['--date=2026-11-02','--api-key=secret']
 ])assert.throws(()=>parseMa75ForwardDayArgs(argv),TypeError);
});

test('provider response integrity failure never becomes a completed forward study',async()=>{
 const opts={
  clock:clock('2026-11-02T08:00:00Z'),read,fileInfo,
  env:{JQUANTS_API_KEY:'mock',SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY:'YES'}
 };
 await assert.rejects(()=>runMa75ForwardOneDay([
  '--date=2026-11-02','--execute'
 ],{...opts,capture:async()=>{throw Error('provider rejected pagination')}}),
 /provider rejected pagination/);
 await assert.rejects(()=>runMa75ForwardOneDay([
  '--date=2026-11-02','--execute'
 ],{...opts,capture:async()=>({status:'ORIGINAL_ONE_DATE_SAVED_PRIVATE',
  date:'2026-11-04'})}),
 /MA75_FORWARD_DAY_CAPTURE_DID_NOT_VERIFY_OR_SAVE/);
});

test('the private wrapper only prompts after dry-run and restores key on exit',()=>{
 const script=readFileSync(new URL(
  '../scripts/research/ma75-run-forward-day-local.ps1',import.meta.url),'utf8');
 const active=script.split('\n').filter(s=>!s.trimStart().startsWith('#')).join('\n');
 assert.match(script,/\[switch\]\$Execute/);
 assert.match(script,/if \(-not \$Execute\)/);
 assert.match(script,/Read-Host .* -AsSecureString/);
 assert.match(script,/ZeroFreeBSTR\(\$ptr\)/);
 assert.match(script,/SetEnvironmentVariable\('JQUANTS_API_KEY',\$oldKey,'Process'\)/);
 assert.match(script,/SetEnvironmentVariable\('SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY',\$oldConsent,'Process'\)/);
 assert.doesNotMatch(active,/vercel env|env pull|Set-Content|Out-File|Invoke-WebRequest|curl/);
});
