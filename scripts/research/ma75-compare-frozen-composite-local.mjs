#!/usr/bin/env node
/**
 * Owner-only, offline, READ-ONLY comparison of existing 2026-11-02 freeze:
 * MA75 breakout 27 / rising 22 / wick>=35% + volume>=1.5x.
 * Does NOT call API, save source, overwrite freeze, or infer later returns.
 * Original J-Quants V2 private pages must NEVER be pasted into GitHub.
 */
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyMa75FirstDayResearchFreeze} from
 '../../app/lib/research/ma75FirstDayResearchFreeze.mjs';
import {compareMa75FirstDayComposite} from
 '../../app/lib/research/ma75FirstDayCompositeComparison.mjs';
import {runMa75FirstDayCohortFreeze} from './ma75-freeze-first-forward-day.mjs';
import {readMa75PrivateSavedDate,validateMa75SavedDailyForReplay} from
 './ma75-jquants-bulk-retrospective.mjs';

export const PINNED_FIRST_FORWARD_COHORT_SHA256=
 '1ba1aee5ac05b2c0fd114d3cabe5463bde4409b203544722cf03c04fc0a6612b';
const DIR='research-private';
const COHORT=DIR+'/ma75-first-forward-2026-11-02-cohort-freeze.json';
const UNIVERSE=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
const HIST=/^(20\d\d-\d\d-\d\d)-jquants-daily\.json$/;
const fail=code=>{throw new TypeError('MA75_COMPOSITE_LOCAL_'+code)};
const asDayUnix=date=>Math.floor(Date.parse(date+'T00:00:00Z')/1000);

export function runMa75FrozenCompositeLocal({
 read=readFileSync,list=readdirSync,fileInfo=lstatSync,
 loadSource=readMa75PrivateSavedDate,
 verifyOriginals=runMa75FirstDayCohortFreeze
}={}){
 const info=fileInfo(resolve(DIR));
 if(!info.isDirectory()||info.isSymbolicLink())
  fail('PRIVATE_DIRECTORY_NOT_REAL');
 const manifestInfo=fileInfo(resolve(COHORT));
 if(!manifestInfo.isFile()||manifestInfo.isSymbolicLink()||
    manifestInfo.size>2*1024*1024)
  fail('FROZEN_COHORT_FILE_UNSAFE');
 const manifest=JSON.parse(read(COHORT,'utf8'));
 if(!verifyMa75FirstDayResearchFreeze(manifest)||
    manifest.freezeSha256!==PINNED_FIRST_FORWARD_COHORT_SHA256||
    manifest.breakoutsTotal!==27||manifest.risingBreakoutCount!==22||
    manifest.frozenPopulation!==953)
  fail('COHORT_DOES_NOT_MATCH_NOV2_APPROVED_FREEZE');
 const check=verifyOriginals(['--verify']);
 if(check?.status!=='LOCAL_FROZEN_SHADOW_COHORT_INTEGRITY_MATCH'||
    check.freezeSha256!==manifest.freezeSha256||
    check.originalFilesHashed!==76||
    check.allBreakouts!==27||check.risingBreakouts!==22)
  fail('ORIGINAL_SOURCE_FINGERPRINT_MISMATCH');
 const names=list(resolve(DIR)),dates=names.map(x=>HIST.exec(x)?.[1]??null)
  .filter(Boolean).sort();
 if(dates.length!==122||new Set(dates).size!==122||
    dates[0]!=='2026-05-01'||dates.at(-1)!=='2026-10-30')
  fail('HISTORICAL_DATE_POPULATION_CHANGED');
 const priorDates=dates.slice(-75);
 if(priorDates[0]!=='2026-07-10'||priorDates.at(-1)!==manifest.priorHistoryLast)
  fail('WARMUP_SOURCE_DATE_CHANGED');
 const freeze=JSON.parse(read(UNIVERSE,'utf8'));
 if(freeze.populationSize!==manifest.frozenPopulation||
    freeze.firstEligibleSignalDate!==manifest.firstForwardDate)
  fail('FROZEN_UNIVERSE_CHANGED');
 const series=new Map(manifest.breakoutsAll.map(item=>[item.code,[]]));
 for(const date of [...priorDates,manifest.firstForwardDate]){
  const path=DIR+'/'+(date===manifest.firstForwardDate?
   'ma75-forward-'+date+'-jquants-daily.json':
   date+'-jquants-daily.json');
  const saved=loadSource(path);
  if(!saved)fail('ONE_OF_76_SOURCE_DAYS_MISSING');
  const projection=validateMa75SavedDailyForReplay(freeze,date,saved);
  const found=new Map(projection.audit.rows.map(x=>[x.code,x]));
  for(const [code,bars] of series){
   const row=found.get(code);
   bars.push(row?.status==='DAILY_BAR'?{
    time:asDayUnix(date),
    open:row.bar.open,high:row.bar.high,low:row.bar.low,
    close:row.bar.close,volume:row.bar.volume
   }:null);
  }
 }
 const result=compareMa75FirstDayComposite(manifest,{
  priorDates,series:[...series].map(([code,bars])=>({code,bars}))
 });
 if(result.frozenCohortSha256!==PINNED_FIRST_FORWARD_COHORT_SHA256||
    result.originalCapturedSourceSha256!==manifest.capturedSourceSha256||
    result.originalHistoricalWarmupSha256!==manifest.historicalWarmupSourceSha256)
  fail('SOURCE_DIGEST_RECONCILIATION_FAILED');
 return {
  ...result,
  ownerLocalOriginalFilesVerified:76,
  sourceStructuralReconciliationPassed:true,
  allReportedStatsFromFrozenSingleDayOnly:true,
  cachedLicensedRawProviderRowsDisplayed:false,
  networkRequests:0,filesWritten:0
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==2){
  process.stderr.write('MA75_COMPOSITE_LOCAL_NO_ARGUMENTS_SUPPORTED\n');
  process.exitCode=1;
 }else{
  try{
   const result=runMa75FrozenCompositeLocal();
   process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch{
   process.stderr.write('MA75_COMPOSITE_LOCAL_AUDIT_BLOCKED_OR_FAILED\n');
   process.exitCode=1;
  }
 }
}
