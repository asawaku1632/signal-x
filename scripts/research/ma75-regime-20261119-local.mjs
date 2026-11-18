#!/usr/bin/env node
/**
 * Manual owner-local next independent MA75 regime signal date, Nov 19 only.
 * --plan is dry-run; --lock-before-next-open exclusive local one-file write;
 * --verify-only and --review read but never fetch/replace data or place trades.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateMa75FrozenUniverse}
 from '../../app/lib/research/ma75FrozenUniverse.mjs';
import {buildMa75Nov19RegimeLock,verifyMa75Nov19RegimeLock,
 evaluateMa75Nov19RegimeOutcomes,checkMa75Nov19RegimePolicy}
 from '../../app/lib/research/ma75ProspectiveRegimeNov19.mjs';
import {readMa75PrivateSavedDate,validateMa75SavedDailyForReplay}
 from './ma75-jquants-bulk-retrospective.mjs';
import {runMa75NextSignalLocal} from './ma75-next-signal-local.mjs';

const PRIVATE='research-private';
const LOCK=PRIVATE+'/ma75-2026-11-19-regime-lock.json';
const FREEZE=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
const POLICY=new URL('../../docs/ma75-regime-20261119-predeclared-policy.json',import.meta.url);
const HIST=/^(20\d\d-\d\d-\d\d)-jquants-daily\.json$/;
const POSTFIX=['2026-11-02','2026-11-04','2026-11-05','2026-11-06',
 '2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13',
 '2026-11-16','2026-11-17','2026-11-18'];
const fail=x=>{throw new TypeError('MA75_1119_LOCAL_'+x)};
const existing=(p,fileInfo)=>{try{return fileInfo(resolve(p))}
 catch(e){if(e?.code==='ENOENT')return null;throw e}};
const safeFile=x=>x?.isFile()&&!x.isSymbolicLink()&&x.size<30000000;
const readSavedPath=(date)=>PRIVATE+'/'+(date<='2026-10-30'?date:
 'ma75-forward-'+date)+'-jquants-daily.json';
const getReceipt=(s)=>{
 if(!Array.isArray(s?.pages)||!s.pages.length||s.pages.length>12)
  fail('MISSING_JQUANTS_PAGE_RECEIPTS');
 const stamps=s.pages.map(x=>Date.parse(x.receivedAt));
 if(stamps.some((t,i)=>!Number.isFinite(t)||(i>0&&t<stamps[i-1])))
  fail('INVALID_JQUANTS_PAGE_RECEIPTS');
 return s.pages.at(-1).receivedAt;
};
const getProjection=(freeze,date,source,project)=>{
 const sourceReceipt=Date.parse(getReceipt(source));
 if(sourceReceipt<Date.parse(date+'T07:30:00Z'))
  fail('ORIGINAL_CAPTURE_BEFORE_CONSERVATIVE_RELEASE_FLOOR');
 return project(freeze,date,source);
};
const shaOriginals=(files,read)=>{
 const hash=createHash('sha256');
 for(const {date,path} of files){
  const raw=read(path);
  if((!Buffer.isBuffer(raw)&&typeof raw!=='string')||raw.length<1||raw.length>30000000)
   fail('ORIGINAL_RAW_FILE_UNSAFE');
  hash.update(date+'\n');hash.update(raw);hash.update('\nEND_CAPTURE\n');
 }
 return hash.digest('hex');
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function runMa75Nov19Local(argv=[],{
 clock=()=>new Date(),read=readFileSync,write=writeFileSync,
 fileInfo=lstatSync,list=readdirSync,
 readSaved=readMa75PrivateSavedDate,
 project=validateMa75SavedDailyForReplay,
 verifyPrior=runMa75NextSignalLocal
}={}){
 const mode=argv.length===0||same(argv,['--plan'])?'plan':
  same(argv,['--lock-before-next-open'])?'lock':
  same(argv,['--verify-only'])?'verify':
  same(argv,['--review'])?'review':null;
 if(!mode)fail('ONLY_PLAN_LOCK_VERIFY_REVIEW_ALLOWED');
 const now=clock();
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))fail('INVALID_CLOCK');
 const policy=JSON.parse(read(POLICY,'utf8'));
 const policySha256=checkMa75Nov19RegimePolicy(policy);
 const lockInfo=existing(LOCK,fileInfo);
 if(mode==='plan'){
  return {status:'SHADOW_NOT_APPROVED',mode:'NOV19_PREDECLARED_PLAN_ONLY',
   signalDate:policy.signalDate,policySha256,
   lockDeadlineUtc:policy.lockDeadlineUtc,
   futureSessions:policy.futureSessions,
   originalNov02AndNov11CohortsUnmodified:true,
   lockAlreadyExists:lockInfo!==null,
   ownerMustCaptureNov19After1630:true,networkRequests:0,filesWritten:0,
   eligibleForTrading:false,eligibleForProduction:false,
   eligibleForNotifications:false};
 }
 const dirInfo=existing(PRIVATE,fileInfo);
 if(!dirInfo?.isDirectory()||dirInfo.isSymbolicLink()||
  (lockInfo&&!safeFile(lockInfo))||
  (lockInfo&&lockInfo.size>2000000))fail('PRIVATE_PATH_UNSAFE');
 const freeze=JSON.parse(read(FREEZE,'utf8'));
 validateMa75FrozenUniverse(freeze);
 if(freeze.populationSize!==953)fail('FROZEN_COHORT_CHANGED');
 // Preserve BOTH existing November cohorts; no edit, no re-lock.
 const prev=verifyPrior(['--verify-only']);
 if(prev.status!=='NEW_MA75_SIGNAL_LOCK_INTEGRITY_MATCH'||
  prev.lockSha256!=='84bed698421ead22ebbce3fac0cb0aab08505332541acd1316957bb4151f3cab'||
  prev.originalBreakouts!==25)fail('ORIGINAL_NOV11_COHORT_CHANGED');
 const historic=list(resolve(PRIVATE)).map(n=>HIST.exec(n)?.[1]??null)
  .filter(d=>d!==null&&d>='2026-05-01'&&d<='2026-10-30').sort();
 if(historic.length!==122||new Set(historic).size!==122||
  historic[0]!=='2026-05-01'||historic.at(-1)!=='2026-10-30')
  fail('HISTORICAL_122_ORIGINAL_SESSIONS_CHANGED');
 const priorDates=[...historic.slice(-63),...POSTFIX];
 if(priorDates.length!==75||priorDates.at(-1)!=='2026-11-18'||
  priorDates.some((d,i)=>i>0&&d<=priorDates[i-1]))
  fail('PRIOR_75_ORIGINAL_SESSION_SEQUENCE_CHANGED');
 const allDates=[...priorDates,policy.signalDate];
 const files=allDates.map(date=>({date,path:readSavedPath(date)}));
 const saved=files.map(x=>{
  const source=readSaved(x.path);
  if(!source)fail('ORIGINAL_PRIOR_OR_SIGNAL_DAY_MISSING_'+x.date);
  return {date:x.date,source,projection:getProjection(freeze,x.date,source,project)};
 });
 const originalSha=shaOriginals(files,read);
 const current=saved.at(-1),receipt=getReceipt(current.source);
 if(Date.parse(receipt)>now.getTime())fail('IMPOSSIBLE_CAPTURE_RECEIPT');
 let lock=lockInfo?JSON.parse(read(LOCK,'utf8')):null;
 if(mode==='lock'){
  if(lock)fail('ALREADY_FROZEN_NEVER_RELOCK');
  if(now.getTime()<Date.parse(policy.sourceFirstPermittedUtc)||
   now.getTime()>=Date.parse(policy.lockDeadlineUtc))
   fail('OUTSIDE_SIGNAL_CLOSE_TO_NEXT_OPEN');
  lock=buildMa75Nov19RegimeLock(freeze,policy,{
   priorDates,priorProjections:saved.slice(0,-1).map(x=>x.projection),
   signalProjection:current.projection,originalsSha256:originalSha,
   signalReceiptAt:receipt,lockedAt:now.toISOString()
  });
  write(LOCK,JSON.stringify(lock,null,2)+'\n',{flag:'wx',mode:0o600,encoding:'utf8'});
  return {status:'NEW_MA75_REGIME_DATE_LOCKED_SHADOW_ONLY',signalDate:policy.signalDate,
   regime:lock.market.regime,priorFiveMedianPercent:lock.market.trailingFiveMedianPercent,
   proxyValidCodes:lock.market.validCodes,
   breakouts:lock.allBreakouts,rising:lock.risingBreakouts,
   nonRising:lock.nonRisingBreakouts,notEvaluableCodes:lock.notEvaluableCodes,
   lockSha256:lock.lockSha256,policySha256,
   filesWritten:1,networkRequests:0,eligibleForTrading:false,
   eligibleForNotifications:false,eligibleForProduction:false};
 }
 if(!lock||!verifyMa75Nov19RegimeLock(lock,policy)||
  lock.originalsSha256!==originalSha||!same(lock.priorDates,priorDates))
  fail('LOCK_OR_SOURCE_FINGERPRINT_FAILED');
 const recomputed=buildMa75Nov19RegimeLock(freeze,policy,{
  priorDates,priorProjections:saved.slice(0,-1).map(x=>x.projection),
  signalProjection:current.projection,originalsSha256:originalSha,
  signalReceiptAt:receipt,lockedAt:lock.lockedAt
 });
 if(!same(recomputed,lock))fail('LOCK_MEMBERSHIP_OR_REGIME_CHANGED');
 if(mode==='verify')return {
  status:'MA75_NOV19_LOCK_INTEGRITY_MATCH',signalDate:policy.signalDate,
  breakouts:lock.allBreakouts,rising:lock.risingBreakouts,
  nonRising:lock.nonRisingBreakouts,priorMarketRegime:lock.market.regime,
  lockSha256:lock.lockSha256,networkRequests:0,filesWritten:0,
  eligibleForTrading:false,eligibleForProduction:false};
 const sourceByDate={};
 for(const date of policy.futureSessions){
  const s=readSaved(readSavedPath(date));
  if(!s)continue;
  const receivedAt=getReceipt(s);
  if(Date.parse(receivedAt)>now.getTime())fail('FUTURE_CAPTURE_RECEIPT');
  sourceByDate[date]={projection:getProjection(freeze,date,s,project),receivedAt};
 }
 return evaluateMa75Nov19RegimeOutcomes(freeze,policy,lock,{
  signalProjection:current.projection,sourceByDate,now:now.toISOString()
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{process.stdout.write(JSON.stringify(runMa75Nov19Local(process.argv.slice(2)),null,2)+'\n')}
 catch(e){
  const code=typeof e?.message==='string'&&
   /^[A-Z0-9_]{8,160}$/.test(e.message)?e.message:'MA75_1119_READONLY_OR_LOCK_BLOCKED';
  process.stderr.write(code+'\n');process.exitCode=1;
 }
}
