#!/usr/bin/env node
/**
 * One read-only owner-local 1/3/5 MA75 horizon ledger.
 * No requests to provider, writes, git push, Supabase, notifications, orders.
 * Saved Nov5, Nov6, Nov9 and Nov10 sources are OPTIONAL and independently
 * captured by the owner through the existing explicit one-day script.
 */
import {readFileSync,lstatSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {runMa75FirstSessionLocal} from './ma75-first-session-local.mjs';
import {PINNED_FIRST_FORWARD_COHORT_SHA256} from
 './ma75-compare-frozen-composite-local.mjs';
import {verifyMa75FirstDayResearchFreeze} from
 '../../app/lib/research/ma75FirstDayResearchFreeze.mjs';
import {evaluateMa75FrozenHorizonLedger,MA75_FROZEN_SESSIONS}
 from '../../app/lib/research/ma75FrozenForwardHorizons.mjs';
import {readMa75PrivateSavedDate,validateMa75SavedDailyForReplay}
 from './ma75-jquants-bulk-retrospective.mjs';

const FREEZE=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
const DIR='research-private';
const MANIFEST=DIR+'/ma75-first-forward-2026-11-02-cohort-freeze.json';
const fail=s=>{throw new TypeError('MA75_135_LOCAL_'+s)};
export function runMa75Frozen135Local({
 clock=()=>new Date(),read=readFileSync,fileInfo=lstatSync,
 first=runMa75FirstSessionLocal,readSaved=readMa75PrivateSavedDate,
 validateSaved=validateMa75SavedDailyForReplay,
 expectedFreezeSha256=PINNED_FIRST_FORWARD_COHORT_SHA256
}={}){
 const now=clock();
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))
  fail('INVALID_CLOCK');
 const firstDay=first();
 if(firstDay.status!=='SHADOW_NOT_APPROVED'||
    firstDay.frozenCohortSha256!==expectedFreezeSha256)
  fail('IMMUTABLE_FIRST_DAY_INVALID');
 const manifestInfo=fileInfo(resolve(MANIFEST));
 if(!manifestInfo.isFile()||manifestInfo.isSymbolicLink()||
    manifestInfo.size>2*1024*1024)
  fail('FROZEN_MANIFEST_UNSAFE');
 const manifest=JSON.parse(read(MANIFEST,'utf8'));
 if(!verifyMa75FirstDayResearchFreeze(manifest)||
    manifest.freezeSha256!==expectedFreezeSha256||
    manifest.breakoutsTotal!==27||manifest.risingBreakoutCount!==22)
  fail('FROZEN_MANIFEST_CHANGED');
 const freeze=JSON.parse(read(FREEZE,'utf8'));
 if(freeze.populationSize!==953||
    freeze.firstEligibleSignalDate!=='2026-11-02')
  fail('RESEARCH_UNIVERSE_CHANGED');
 const originalDayProjections={},sourceReceipts={};
 for(const date of MA75_FROZEN_SESSIONS){
  const source=readSaved(DIR+'/ma75-forward-'+date+'-jquants-daily.json');
  if(!source)continue;
  if(!Array.isArray(source.pages)||!source.pages.length)
   fail('INVALID_ORIGINAL_CAPTURE_PAGES');
  const times=source.pages.map(p=>Date.parse(p.receivedAt));
  const floor=Date.parse(date+'T07:30:00Z');
  if(times.some((x,i)=>!Number.isFinite(x)||x<floor||
     x>now.getTime()||(i>0&&x<times[i-1])))
   fail('IMPOSSIBLE_ORIGINAL_SOURCE_RECEIPT');
  const projection=validateSaved(freeze,date,source);
  originalDayProjections[date]=projection;
  sourceReceipts[date]=source.pages.at(-1).receivedAt;
 }
 if(firstDay.firstDayObservedSource!==
    Object.hasOwn(originalDayProjections,'2026-11-04'))
  fail('FIRST_DAY_SOURCE_PRESENCE_CHANGED');
 const report=evaluateMa75FrozenHorizonLedger(firstDay,{
  originalDayProjections,sourceReceipts,
  asOf:now.toISOString(),expectedFreezeSha256,
  expectedOriginalCodes:manifest.breakoutsAll.map(x=>x.code)
 });
 return {...report,localAuditClock:now.toISOString(),
  localSourceReceiptIndependentlyAuthenticated:false,
  frozenOriginalSha256MatchesPinned:true,
  providerQueries:0,writtenFiles:0,
  noNewJQuantsCaptureRequested:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==2){
  process.stderr.write('MA75_135_LOCAL_NO_ARGUMENTS_ALLOWED\n');
  process.exitCode=1;
 }else{
  try{
   process.stdout.write(JSON.stringify(runMa75Frozen135Local(),null,2)+'\n');
  }catch(e){
   const code=typeof e?.message==='string'&&
    /^[A-Z][A-Z0-9_]{5,120}$/.test(e.message)?
    e.message:'MA75_135_LOCAL_UNCLASSIFIED_ERROR';
   process.stderr.write('MA75_135_LOCAL_READ_ONLY_BLOCKED: '+code+'\n');
   process.exitCode=1;
  }
 }
}
