#!/usr/bin/env node
/**
 * Owner-local, offline optional cohort freeze for 2026-11-02 MA75 SHADOW ONLY.
 * Reads original archived pages and first postfreeze page; never accesses API.
 * Default is read-only preview; --freeze writes once to a git-ignored
 * research-private filename with exclusive create. --verify is read-only.
 * Neither a local clock nor an SHA256 independently authenticates a provider.
 */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runMa75LocalFirstForwardReview}
 from './ma75-local-first-forward-review.mjs';
import {buildMa75FirstDayResearchFreeze,verifyMa75FirstDayResearchFreeze}
 from '../../app/lib/research/ma75FirstDayResearchFreeze.mjs';

const DIR='research-private';
const OUTPUT=DIR+'/ma75-first-forward-2026-11-02-cohort-freeze.json';
const FIRST_DAY='2026-11-02';
const FIRST_PUBLISH_EARLIEST=Date.parse('2026-11-02T07:30:00Z');
const FOLLOWING_TSE_OPEN=Date.parse('2026-11-04T00:00:00Z'); // Tue Nov 3 is JPX cash-market holiday
const ARCHIVE=/^(20\d\d-\d\d-\d\d)-jquants-daily\.json$/;
const MAX_FILE_BYTES=30000000;
const error=code=>{throw new TypeError('MA75_FIRST_DAY_COHORT_'+code)};
export function parseMa75FirstDayFreezeArgs(args){
 if(!Array.isArray(args))error('INVALID_ARGUMENTS');
 if(args.length===0)return 'preview';
 if(args.length===1&&args[0]==='--freeze')return 'freeze';
 if(args.length===1&&args[0]==='--verify')return 'verify';
 error('ONLY_FREEZE_OR_VERIFY_ALLOWED');
}
const digest=source=>createHash('sha256').update(source).digest('hex');
const sourceChunk=(read,path)=>{
 const bytes=read(path);
 if(!(typeof bytes==='string'||Buffer.isBuffer(bytes))||
    bytes.length===0||bytes.length>MAX_FILE_BYTES)
  error('ORIGINAL_CAPTURE_SIZE_INVALID');
 return bytes;
};
export function hashMa75FirstDayOriginals(report,{
 fileNames,read,dir=DIR
}){
 if(report?.requestedSignalDate!==FIRST_DAY||!Array.isArray(fileNames)||
    typeof read!=='function')
  error('REQUIRE_RECONCILED_FIRST_DATE');
 // Only original 2026-05-01..2026-10-30 archival sessions contribute
 // to the previously pinned historical hash. Later day captures may
 // coexist in the private folder but cannot affect this fingerprint.
 const dates=fileNames.map(name=>ARCHIVE.exec(name)?.[1]??null)
  .filter(date=>date!==null&&date>='2026-05-01'&&date<='2026-10-30').sort();
 if(dates.length!==122||new Set(dates).size!==dates.length||
    dates[0]!=='2026-05-01'||dates.at(-1)!=='2026-10-30')
  error('BASELINE_ARCHIVE_NOT_EXACT');
 const last75=dates.slice(-75);
 if(last75[0]!==report.historicalWarmupFirst||
    last75.at(-1)!==report.historicalWarmupLast)
  error('HISTORY_DATE_CHANGED');
 const hash=createHash('sha256');
 for(const date of last75){
  const file=dir+'/'+date+'-jquants-daily.json';
  hash.update('ARCHIVED_DAY:'+date+'\n');
  hash.update(sourceChunk(read,file));hash.update('\nEND_DAY\n');
 }
 const currentFile=dir+'/ma75-forward-'+FIRST_DAY+'-jquants-daily.json';
 if(!fileNames.includes('ma75-forward-'+FIRST_DAY+'-jquants-daily.json'))
  error('POSTFREEZE_ORIGINAL_FILE_NOT_FOUND');
 return {
  historicalSha256:hash.digest('hex'),
  currentSha256:digest(sourceChunk(read,currentFile)),
  archivedSessionsHashed:last75.length
 };
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function runMa75FirstDayCohortFreeze(args,{
 now=()=>new Date(),read=readFileSync,
 list=readdirSync,fileInfo=lstatSync,write=writeFileSync,
 review=runMa75LocalFirstForwardReview
}={}){
 const mode=parseMa75FirstDayFreezeArgs(args);
 const stamp=now();
 if(!(stamp instanceof Date)||!Number.isFinite(stamp.getTime()))
  error('INVALID_LOCAL_CLOCK');
 const dirInfo=fileInfo(resolve(DIR));
 if(!dirInfo.isDirectory()||dirInfo.isSymbolicLink())
  error('PRIVATE_DIRECTORY_UNSAFE');
 const report=review();
 if(report?.status!=='OFFLINE_SHADOW_PATTERN_REVIEW_ONLY'||
    report.capturedOriginalPageCount<1||
    report.capturedOriginalPageCount>12||
    report.snapshotAsOfNextOpenIndependentlyAuthenticated!==false)
  error('UNVERIFIED_LOCAL_SHADOW_REVIEW');
 const receipts=[report.localReceiptFirst,report.localReceiptLast]
  .map(v=>Date.parse(v));
 if(receipts.some(v=>!Number.isFinite(v))||
    receipts[0]<FIRST_PUBLISH_EARLIEST||
    receipts[1]<receipts[0]||receipts[1]>stamp.getTime())
  error('IMPOSSIBLE_CAPTURE_RECEIPT');
 const originals=hashMa75FirstDayOriginals(report,{
  fileNames:list(resolve(DIR)),read
 });
 const old=(()=>{
  try{
   const info=fileInfo(resolve(OUTPUT));
   if(info.isSymbolicLink()||!info.isFile())error('DESTINATION_UNSAFE');
   return JSON.parse(read(OUTPUT,'utf8'));
  }catch(e){if(e?.code==='ENOENT')return null;throw e}
 })();
 if(mode==='verify'){
  if(!old)error('FROZEN_COHORT_NOT_FOUND');
  if(!verifyMa75FirstDayResearchFreeze(old))error('FROZEN_MANIFEST_INVALID');
  const regenerated=buildMa75FirstDayResearchFreeze(report,{
   sourceSha256:originals.currentSha256,
   historySha256:originals.historicalSha256,
   recordedAt:old.createdAt
  });
  if(!same(regenerated,old))error('SOURCE_OR_SIGNAL_COHORT_CHANGED');
  return {
   status:'LOCAL_FROZEN_SHADOW_COHORT_INTEGRITY_MATCH',
   firstForwardDate:FIRST_DAY,freezeSha256:old.freezeSha256,
   allBreakouts:old.breakoutsTotal,risingBreakouts:old.risingBreakoutCount,
   originalFilesHashed:originals.archivedSessionsHashed+1,
   independentlyAuthenticatedTiming:false,
   validatedForwardWinRate:null,
   eligibleForProduction:false,eligibleForNotifications:false,
   filesWritten:0
  };
 }
 const withinPreEntryWindow=stamp.getTime()>=FIRST_PUBLISH_EARLIEST&&
   stamp.getTime()<FOLLOWING_TSE_OPEN;
 if(mode==='freeze'&&!withinPreEntryWindow)
  error('NOT_BEFORE_FIRST_NEXT_TSE_OPEN');
 if(mode==='freeze'&&old)error('IMMUTABLE_FROZEN_COHORT_ALREADY_EXISTS');
 const candidate=buildMa75FirstDayResearchFreeze(report,{
  sourceSha256:originals.currentSha256,
  historySha256:originals.historicalSha256,
  recordedAt:stamp.toISOString()
 });
 if(mode==='freeze'){
  write(OUTPUT,JSON.stringify(candidate,null,2)+'\n',{
   flag:'wx',mode:0o600,encoding:'utf8'
  });
 }
 return {
  status:mode==='freeze'?'LOCAL_RESEARCH_COHORT_FROZEN_ONCE':
    'PREVIEW_ONLY_NO_SNAPSHOT_WRITTEN',
  firstForwardDate:FIRST_DAY,
  allBreakouts:candidate.breakoutsTotal,
  risingBreakouts:candidate.risingBreakoutCount,
  excluded:candidate.excludedCount,
  sourceSha256:originals.currentSha256,
  historicalWarmupSha256:originals.historicalSha256,
  freezeSha256:candidate.freezeSha256,
  timestampSelfReportedByOwnerMachine:true,
  preFollowingOpenWindow:withinPreEntryWindow,
  independentProofOfCaptureTime:false,
  filesWritten:mode==='freeze'?1:0,
  eligibleForProduction:false,eligibleForNotifications:false,
  validatedForwardWinRate:null,
  nextOpenPriceKnown:false,
  note:'A local hash locks the current file content for later comparisons but does not independently establish provider rights, original timestamp, or trading eligibility.'
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  process.stdout.write(JSON.stringify(
   runMa75FirstDayCohortFreeze(process.argv.slice(2)),null,2)+'\n');
 }catch{
  process.stderr.write('MA75_FIRST_DAY_COHORT_FREEZE_BLOCKED_OR_INVALID\n');
  process.exitCode=1;
 }
}
