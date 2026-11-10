#!/usr/bin/env node
/**
 * OWNER-LOCAL SHADOW ONLY. Tomorrow's new 11/11 signal is a DIFFERENT
 * cohort from the forever-pinned 11/02 27/22/3 research. No network,
 * Supabase, cron, downloads, trades or notifications.
 *
 * --plan (default) reads availability metadata only.
 * --lock-new-cohort writes ONE new gitignored manifest with exclusive
 * create on 11/11 after local close-source receipt and BEFORE 11/12 open.
 * --verify-only and --review only READ + HASH originals.
 * Existing 11/02 --freeze must NEVER be re-run.
 */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateMa75FrozenUniverse}
 from '../../app/lib/research/ma75FrozenUniverse.mjs';
import {buildMa75NextDateCohort,verifyMa75NextDateCohort,
 requireMa75ProspectivePolicy}
 from '../../app/lib/research/ma75ProspectiveDateCohort.mjs';
import {evaluateMa75ProspectiveDateOutcomes}
 from '../../app/lib/research/ma75ProspectiveDateOutcomes.mjs';
import {readMa75PrivateSavedDate,validateMa75SavedDailyForReplay}
 from './ma75-jquants-bulk-retrospective.mjs';
import {runMa75LocalCompletionAudit}
 from './ma75-local-coverage-audit.mjs';
import {runMa75FirstDayCohortFreeze}
 from './ma75-freeze-first-forward-day.mjs';
import {PINNED_FIRST_FORWARD_COHORT_SHA256}
 from './ma75-compare-frozen-composite-local.mjs';

const PRIVATE='research-private';
const NEW_LOCK=PRIVATE+'/ma75-2026-11-11-new-signal-lock.json';
const SIGNAL_PATH=PRIVATE+'/ma75-forward-2026-11-11-jquants-daily.json';
const FREEZE=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
const POLICY=new URL('../../docs/ma75-prospective-20261111-predeclared-policy.json',import.meta.url);
const HIST=/^(20\d\d-\d\d-\d\d)-jquants-daily\.json$/;
const error=s=>{throw new TypeError('MA75_NEXT_SIGNAL_LOCAL_'+s)};
const sourcePaths=dates=>dates.map(date=>({
 date,path:PRIVATE+'/'+(date<='2026-10-30'?date:'ma75-forward-'+date)+'-jquants-daily.json'
}));
const safeType=(info,type)=>info&&
 (type==='dir'?info.isDirectory():info.isFile())&&!info.isSymbolicLink();
const existing=(path,fileInfo)=>{
 try{return fileInfo(resolve(path))}catch(e){if(e?.code==='ENOENT')return null;throw e}
};
const rawSha=(read,rows)=>{
 const h=createHash('sha256');
 for(const {date,path} of rows){
  const raw=read(path);
  if(!(Buffer.isBuffer(raw)||typeof raw==='string')||
      raw.length<1||raw.length>30000000)
   error('ORIGINAL_SOURCE_NOT_READABLE_OR_UNSAFE');
  h.update(date+'\n');h.update(raw);h.update('\nEND_CAPTURE\n');
 }
 return h.digest('hex');
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const utc=x=>{const m=Date.parse(x);return Number.isFinite(m)?m:NaN};
const receipt=saved=>{
 const pages=saved?.pages;
 if(!Array.isArray(pages)||!pages.length||pages.length>12)
  error('SOURCE_PAGES_MISSING');
 const ts=pages.map(p=>utc(p.receivedAt));
 if(ts.some((t,i)=>!Number.isFinite(t)||(i>0&&t<ts[i-1])))
  error('ORIGINAL_PAGE_RECEIPTS_UNTRUSTED');
 return pages.at(-1).receivedAt;
};
export function runMa75NextSignalLocal(argv=[],{
 clock=()=>new Date(),read=readFileSync,list=readdirSync,
 fileInfo=lstatSync,write=writeFileSync,
 readSaved=readMa75PrivateSavedDate,
 project=validateMa75SavedDailyForReplay,
 auditArchive=runMa75LocalCompletionAudit,
 verifyNov02=runMa75FirstDayCohortFreeze,
 expectedOldSha=PINNED_FIRST_FORWARD_COHORT_SHA256
}={}){
 const mode=argv.length===0||same(argv,['--plan'])?'plan':
  same(argv,['--lock-new-cohort'])?'lock':
  same(argv,['--verify-only'])?'verify':
  same(argv,['--review'])?'review':null;
 if(mode===null)error('ONLY_PLAN_LOCK_VERIFY_OR_REVIEW_ALLOWED');
 const now=clock();
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))
  error('INVALID_CLOCK');
 const policy=JSON.parse(read(POLICY,'utf8'));
 const policySha256=requireMa75ProspectivePolicy(policy);
 const sourceInfo=existing(SIGNAL_PATH,fileInfo);
 const lockInfo=existing(NEW_LOCK,fileInfo);
 if(mode==='plan'){
  return {status:'SHADOW_NOT_APPROVED',mode:'PREDECLARED_PLAN_ONLY',
   policySha256,signalDate:policy.signalSession,
   nextMarketOpenTimeSelfReported:policy.followingOpenDeadlineUtc,
   signalSourceAlreadyStored:sourceInfo!==null,
   nextCohortLocked:lockInfo!==null,
   futureOutcomeSourcesRequired:policy.horizonSessions,
   originalNov02CohortUnaffected:true,
   requiresManualSourceCapture:true,networkRequests:0,filesWritten:0,
   eligibleForProduction:false,eligibleForNotifications:false,
   eligibleForTrading:false};
 }
 if(!safeType(existing(PRIVATE,fileInfo),'dir')||
    (sourceInfo&&!safeType(sourceInfo,'file'))||
    (lockInfo&&!safeType(lockInfo,'file'))||
    (lockInfo&&lockInfo.size>2000000))
  error('PRIVATE_PATH_OR_LOCK_UNSAFE');
 const freeze=JSON.parse(read(FREEZE,'utf8'));
 validateMa75FrozenUniverse(freeze);
 if(freeze.populationSize!==953)error('ORIGINAL_FROZEN_UNIVERSE_NOT_953');
 const old=verifyNov02(['--verify']);
 if(old.status!=='LOCAL_FROZEN_SHADOW_COHORT_INTEGRITY_MATCH'||
    old.freezeSha256!==expectedOldSha||
    old.allBreakouts!==27||old.risingBreakouts!==22)
  error('NOV02_FIXED_27_BASELINE_INTEGRITY_FAILED');
 const archive=auditArchive();
 if(archive.status!=='OFFLINE_HISTORICAL_DIAGNOSTIC_ONLY'||
    archive.from!=='2026-05-01'||archive.to!=='2026-10-30'||
    archive.dates!==122)
  error('ORIGINAL_HISTORICAL_ARCHIVE_CHANGED');
 const names=list(resolve(PRIVATE));
 const dates=names.map(x=>HIST.exec(x)?.[1]??null)
  .filter(x=>x!==null&&x>=archive.from&&x<=archive.to).sort();
 if(dates.length!==122||new Set(dates).size!==122||
    dates[0]!==archive.from||dates.at(-1)!==archive.to)
  error('HISTORICAL_122_SESSION_POPULATION_CHANGED');
 const priorDates=[...dates.slice(-69),...policy.precedingPostfreezeSessions];
 if(priorDates.length!==75||
    priorDates.some((d,i)=>i>0&&d<=priorDates[i-1]))
  error('NEW_DATE_PRIOR_75_SESSIONS_CHANGED');
 if(!sourceInfo)error('NOV11_SIGNAL_ORIGINAL_NOT_YET_CAPTURED');
 const originals=sourcePaths([...priorDates,policy.signalSession]);
 const saved=originals.map(({date,path})=>{
  const source=readSaved(path);
  if(!source)error('REQUIRED_PRIOR_OR_SIGNAL_ORIGINAL_MISSING');
  return {date,source,projection:project(freeze,date,source)};
 });
 const last=saved.at(-1);
 const sourceReceipt=receipt(last.source);
 if(utc(sourceReceipt)>now.getTime()||
    utc(sourceReceipt)<utc(policy.sameDaySourceEarliestUtc))
  error('IMPOSSIBLE_SIGNAL_ORIGINAL_CAPTURE_TIME');
 const fingerprint=rawSha(read,originals);
 let locked=lockInfo?JSON.parse(read(NEW_LOCK,'utf8')):null;
 if(mode==='lock'){
  if(locked)error('NEW_SIGNAL_COHORT_ALREADY_LOCKED');
  if(now.getTime()<utc(policy.sameDaySourceEarliestUtc)||
     now.getTime()>=utc(policy.followingOpenDeadlineUtc))
   error('NOT_IN_SIGNAL_CLOSE_TO_NEXT_OPEN_WINDOW');
  locked=buildMa75NextDateCohort(freeze,policy,{
   priorDates,priorProjections:saved.slice(0,-1).map(x=>x.projection),
   signalProjection:last.projection,sourceSha256:fingerprint,
   lockedAt:now.toISOString(),signalLastReceiptAt:sourceReceipt
  });
  write(NEW_LOCK,JSON.stringify(locked,null,2)+'\n',{
   flag:'wx',mode:0o600,encoding:'utf8'
  });
  return {status:'NEW_MA75_SIGNAL_DATE_LOCKED_SHADOW_ONLY',
   signalDate:policy.signalSession,lockSha256:locked.lockSha256,
   policySha256,allBreakouts:locked.allBreakouts,
   risingBreakouts:locked.risingBreakouts,
   nonRisingBreakouts:locked.nonRisingBreakouts,
   notEvaluableCodes:locked.notEvaluableCodes,
   outcomeDates:policy.horizonSessions,
   independentlyCertifiedCaptureTime:false,
   noOriginalSourceModified:true,
   networkRequests:0,filesWritten:1,eligibleForTrading:false,
   eligibleForNotifications:false,eligibleForProduction:false};
 }
 if(!locked)error('NEW_SIGNAL_NOT_LOCKED_BEFORE_OUTCOMES');
 if(!verifyMa75NextDateCohort(locked,policy)||
    locked.originalsSha256!==fingerprint||
    !same(locked.priorSourceDates,priorDates))
  error('NEW_SIGNAL_LOCK_ORIGINAL_SOURCE_FINGERPRINT_CHANGED');
 const recomputed=buildMa75NextDateCohort(freeze,policy,{
  priorDates,priorProjections:saved.slice(0,-1).map(x=>x.projection),
  signalProjection:last.projection,sourceSha256:fingerprint,
  lockedAt:locked.lockedAt,signalLastReceiptAt:sourceReceipt
 });
 if(!same(recomputed,locked))error('LOCKED_NEW_SIGNAL_MEMBERSHIP_CHANGED');
 if(mode==='verify'){
  return {status:'NEW_MA75_SIGNAL_LOCK_INTEGRITY_MATCH',
   signalDate:policy.signalSession,originalsHashed:76,
   originalBreakouts:locked.allBreakouts,
   risingBreakouts:locked.risingBreakouts,
   nonRisingBreakouts:locked.nonRisingBreakouts,
   lockSha256:locked.lockSha256,filesWritten:0,networkRequests:0,
   eligibleForTrading:false,eligibleForProduction:false};
 }
 const sourceByDate={},receiptByDate={};
 for(const date of policy.horizonSessions){
  const path=PRIVATE+'/ma75-forward-'+date+'-jquants-daily.json';
  const s=readSaved(path);
  if(!s)continue;
  const captured=receipt(s);
  if(utc(captured)<Date.parse(date+'T07:30:00Z')||
     utc(captured)>now.getTime())
   error('FUTURE_OR_EARLY_OUTCOME_CAPTURE');
  sourceByDate[date]=project(freeze,date,s);
  receiptByDate[date]=captured;
 }
 const codes=new Set(locked.candidates.map(x=>x.code));
 const signalCloseByCode=new Map(last.projection.audit.rows
  .filter(x=>codes.has(x.code)&&x.status==='DAILY_BAR')
  .map(x=>[x.code,x.bar.close]));
 if(signalCloseByCode.size!==locked.allBreakouts)
  error('LOCKED_SIGNAL_CLOSING_PRICES_UNAVAILABLE');
 const result=evaluateMa75ProspectiveDateOutcomes(locked,policy,{
  sourceByDate,receiptByDate,signalCloseByCode,now:now.toISOString()
 });
 return {...result,ownerLocalOriginalsFingerprintMatched:true,
  oldNov02CohortUnmodified:true,policySha256,originalsHashed:76,
  filesWritten:0,networkRequests:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  process.stdout.write(JSON.stringify(
   runMa75NextSignalLocal(process.argv.slice(2)),null,2)+'\n');
 }catch(e){
  const code=typeof e?.message==='string'&&
   /^[A-Z][A-Z0-9_]{5,140}$/.test(e.message)?
   e.message:'MA75_NEXT_SIGNAL_UNCLASSIFIED_LOCAL_ERROR';
  process.stderr.write('MA75_NEXT_SIGNAL_LOCAL_BLOCKED: '+code+'\n');
  process.exitCode=1;
 }
}
