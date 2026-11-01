#!/usr/bin/env node
/**
 * Explicit, bounded, owner-local capture of a NEW post-freeze MA75 study day.
 *
 * DRY RUN by default. No automatic scheduler, app/DB writes, scoring,
 * notifications, broker orders or production changes. A successful capture is
 * just a locally stored original J-Quants V2 page envelope, NOT an as-of
 * investment signal or independently validated provider provenance.
 */
import {readFileSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateMa75FrozenUniverse} from '../../app/lib/research/ma75FrozenUniverse.mjs';
import {runMa75OneDateCapture} from './ma75-jquants-one-date-capture.mjs';

const FREEZE=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
const DAY=/^20\d\d-\d\d-\d\d$/;
const validDay=s=>typeof s==='string'&&DAY.test(s)&&
 Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const RELEASE_FLOOR_UTC='T07:30:00Z'; // 16:30 Japan local, planning floor only
const fail=code=>{throw new TypeError('MA75_FORWARD_DAY_'+code)};
export function parseMa75ForwardDayArgs(argv){
 if(!Array.isArray(argv))fail('ARGS_REQUIRED');
 let date=null,execute=false;
 for(const arg of argv){
  if(arg==='--execute'){
   if(execute)fail('DUPLICATE_EXECUTE');
   execute=true;
  }else if(typeof arg==='string'&&arg.startsWith('--date=')){
   if(date!==null)fail('DUPLICATE_DATE');
   date=arg.slice('--date='.length);
  }else fail('ONLY_DATE_AND_OPTIONAL_EXECUTE');
 }
 if(!validDay(date))fail('INVALID_DATE');
 return {date,execute};
}
export function planMa75ForwardDay(argv,{
 freeze,clock=()=>new Date(),existingFile=false
}={}){
 const args=parseMa75ForwardDayArgs(argv);
 validateMa75FrozenUniverse(freeze);
 const current=clock();
 if(!(current instanceof Date)||!Number.isFinite(current.getTime()))fail('CLOCK_INVALID');
 const now=current.getTime();
 if(args.date<freeze.firstEligibleSignalDate)fail('PRE_FREEZE_CAPTURE_NOT_ALLOWED');
 const publishedFloor=Date.parse(args.date+RELEASE_FLOOR_UTC);
 const afterPlannedRelease=now>=publishedFloor;
 if(args.execute&&!afterPlannedRelease)fail('SESSION_NOT_YET_ELIGIBLE_FOR_CAPTURE');
 if(args.execute&&existingFile)fail('EXISTING_PRIVATE_CAPTURE_NO_OVERWRITE');
 return {
  version:'ma75_postfreeze_one_day_capture_plan_v1',
  status:args.execute?'EXPLICIT_LOCAL_CAPTURE_REQUEST':
   afterPlannedRelease?'DRY_RUN_PAST_RELEASE_FLOOR':'DRY_RUN_SESSION_NOT_YET_PUBLISHED',
  date:args.date,earliestRequestedCaptureUtc:args.date+RELEASE_FLOOR_UTC,
  firstFrozenEligibleDate:freeze.firstEligibleSignalDate,
  execute:args.execute,
  approvedEndpoint:'/v2/equities/bars/daily',
  requestedScope:'ALL_LISTED_ONE_DATE',
  output:'research-private/ma75-forward-'+args.date+'-jquants-daily.json',
  alreadyStored:existingFile,
  providerActuallyPublishedVerified:false,
  sourceAndRightsIndependentlyVerified:false,
  postCloseTimestampIndependentlyAuthenticated:false,
  nextExchangeOpenNotIndependentlyVerified:true,
  producesSignal:false,independentForwardOutcomes:0,
  eligibleForProduction:false,eligibleForNotifications:false,
  eligibleForTrading:false,eligibleForAIPowerScoring:false
 };
}
export async function runMa75ForwardOneDay(argv,{
 env=process.env,clock=()=>new Date(),
 read=readFileSync,fileInfo=lstatSync,
 capture=runMa75OneDateCapture,
 fetchImpl=fetch
}={}){
 const args=parseMa75ForwardDayArgs(argv);
 const freeze=JSON.parse(read(FREEZE,'utf8'));
 validateMa75FrozenUniverse(freeze);
 // The only permitted local output is a flat file under the existing ignored
 // research-private directory. A file/symlink at that path is never replaced.
 const output='research-private/ma75-forward-'+args.date+'-jquants-daily.json';
 const existingFile=(()=>{
  try{return Boolean(fileInfo(resolve(output)))}catch(e){
   if(e?.code==='ENOENT')return false;
   throw e;
  }
 })();
 const plan=planMa75ForwardDay(argv,{freeze,clock,existingFile});
 if(!args.execute)return {...plan,networkRequests:0,filesWritten:0};
 const privateDir=resolve('research-private');
 const dir=fileInfo(privateDir);
 if(!dir.isDirectory()||dir.isSymbolicLink())fail('PRIVATE_DIRECTORY_UNSAFE');
 if(env.SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY!=='YES'||
    typeof env.JQUANTS_API_KEY!=='string'||env.JQUANTS_API_KEY.length===0)
   fail('EXPLICIT_PRIVATE_CONSENT_REQUIRED');
 const result=await capture([
  '--date='+args.date,'--output='+output,'--execute'
 ],{env,clock,fetchImpl});
 if(result?.status!=='ORIGINAL_ONE_DATE_SAVED_PRIVATE'||result.date!==args.date)
  fail('CAPTURE_DID_NOT_VERIFY_OR_SAVE');
 return {...plan,status:'ORIGINAL_FORWARD_DAY_CAPTURED_PRIVATE',
  originalProviderRows:result.originalRows,
  originalPages:result.pages,
  frozenRows:result.frozenRows,
  providerActuallyPublishedVerified:false,
  signalNotGenerated:true,
  independentForwardOutcomes:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runMa75ForwardOneDay(process.argv.slice(2))
  .then(data=>process.stdout.write(JSON.stringify(data)+'\n'))
  .catch(()=>{
   // Avoid leaking tokens, env variables, provider pages or raw prices.
   process.stderr.write('MA75_FORWARD_LOCAL_CAPTURE_BLOCKED_OR_FAILED\n');
   process.exitCode=1;
  });
}
