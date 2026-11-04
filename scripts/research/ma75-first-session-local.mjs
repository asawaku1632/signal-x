#!/usr/bin/env node
/**
 * OFFLINE, read-only November 4 first-session retrospective study.
 * The owner must separately use the existing manual daily one-date capture.
 * No API call, source rewrite, scheduled process, broker order or notification.
 * If no 11/04 capture exists, report 27 pending codes, not fictitious returns.
 */
import {readFileSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyMa75FirstDayResearchFreeze} from
 '../../app/lib/research/ma75FirstDayResearchFreeze.mjs';
import {evaluateMa75FirstSessionForward} from
 '../../app/lib/research/ma75FirstSessionForwardOutcome.mjs';
import {runMa75FrozenCompositeLocal,PINNED_FIRST_FORWARD_COHORT_SHA256}
 from './ma75-compare-frozen-composite-local.mjs';
import {readMa75PrivateSavedDate,validateMa75SavedDailyForReplay}
 from './ma75-jquants-bulk-retrospective.mjs';

const DIR='research-private';
const MANIFEST=DIR+'/ma75-first-forward-2026-11-02-cohort-freeze.json';
const NOV4=DIR+'/ma75-forward-2026-11-04-jquants-daily.json';
const UNIVERSE=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
const fail=s=>{throw new TypeError('MA75_FIRST_SESSION_LOCAL_'+s)};
export function runMa75FirstSessionLocal({
 read=readFileSync,fileInfo=lstatSync,readSaved=readMa75PrivateSavedDate,
 validateSaved=validateMa75SavedDailyForReplay,
 compare=runMa75FrozenCompositeLocal,clock=()=>new Date()
}={}){
 const now=clock();
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))
  fail('INVALID_CLOCK');
 const dir=fileInfo(resolve(DIR));
 if(!dir.isDirectory()||dir.isSymbolicLink())
  fail('PRIVATE_DIRECTORY_UNSAFE');
 const stat=fileInfo(resolve(MANIFEST));
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)
  fail('FROZEN_MANIFEST_FILE_UNSAFE');
 const frozen=JSON.parse(read(MANIFEST,'utf8'));
 if(!verifyMa75FirstDayResearchFreeze(frozen)||
    frozen.freezeSha256!==PINNED_FIRST_FORWARD_COHORT_SHA256)
  fail('ORIGINAL_NOV02_FREEZE_INVALID');
 const comparison=compare();
 if(comparison.frozenCohortSha256!==frozen.freezeSha256||
    comparison.originalAllBreakouts!==27||
    comparison.originalRisingBreakouts!==22||
    comparison.firstDayWickAndVolumeComposite!==3||
    comparison.firstDayRisingAndComposite!==3||
    comparison.notEvaluableBreakouts!==0)
  fail('ORIGINAL_NOV02_THREE_GROUPS_CHANGED');
 const saved=readSaved(NOV4);
 let projection=null,receipt=null;
 if(saved!==null){
  if(now.getTime()<Date.parse('2026-11-04T07:30:00Z'))
   fail('OUTCOME_CAPTURE_BEFORE_RESEARCH_RELEASE_FLOOR');
  const original=JSON.parse(read(UNIVERSE,'utf8'));
  projection=validateSaved(original,'2026-11-04',saved);
  if(!Array.isArray(saved.pages)||saved.pages.length<1)
   fail('INVALID_OUTCOME_PAGES');
  const timestamps=saved.pages.map(x=>Date.parse(x.receivedAt));
  if(timestamps.some((t,i)=>!Number.isFinite(t)||
      t<Date.parse('2026-11-04T07:30:00Z')||
      t>now.getTime()||(i>0&&t<timestamps[i-1])))
   fail('IMPOSSIBLE_OUTCOME_RECEIPT');
  receipt=saved.pages.at(-1).receivedAt;
 }
 const result=evaluateMa75FirstSessionForward(frozen,comparison,{
  outcomeDay:'2026-11-04',projection,sourceReceiptAt:receipt,
  asOf:now.toISOString()
 });
 return {...result,
  outcomeOriginalPresent:projection!==null,
  outcomeSourceCapturedPageCount:saved?.pages?.length??0,
  localObservationAt:now.toISOString(),
  sourceTimestampIsSelfReported:true,
  originalNov02Sha256Pinned:true,ownerLocalFilesChanged:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==2){
  process.stderr.write('MA75_FIRST_SESSION_LOCAL_NO_ARGUMENTS_ALLOWED\n');
  process.exitCode=1;
 }else{
  try{
   process.stdout.write(JSON.stringify(runMa75FirstSessionLocal(),null,2)+'\n');
  }catch(err){
   const code=typeof err?.message==='string'&&
    /^[A-Z][A-Z0-9_]{5,120}$/.test(err.message)?
    err.message:'LOCAL_READ_ONLY_INTEGRITY_ERROR';
   process.stderr.write('MA75_FIRST_SESSION_LOCAL_BLOCKED_OR_FAILED: '+code+'\n');
   process.exitCode=1;
  }
 }
}
