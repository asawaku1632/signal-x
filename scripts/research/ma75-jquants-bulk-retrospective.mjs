#!/usr/bin/env node
/**
 * Retrospective ONE-COMMAND J-Quants Standard daily research.
 * DRY-RUN unless --execute AND private consent environment are supplied.
 * No GitHub artifact, cloud upload, DB, cron, plan switch, or notification.
 */
import {mkdirSync,lstatSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {acquireMa75OneDatePages} from './ma75-jquants-one-date-capture.mjs';
import {projectMa75FullDateSource} from '../../app/lib/research/ma75FullDateProjection.mjs';
import {studyMa75BreakoutRetest} from '../../app/lib/research/ma75BreakoutRetest.mjs';
import {validateMa75FrozenUniverse} from '../../app/lib/research/ma75FrozenUniverse.mjs';
const FREEZE=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
const CALENDAR='https://api.jquants.com/v2/markets/calendar';
const YEAR_DAY=/^20\d\d-\d\d-\d\d$/;
const isDay=s=>typeof s==='string'&&YEAR_DAY.test(s)&&
 Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const DAY_MS=86400000;
const MAX_SESSIONS=130;
const MAX_CAPTURE_BYTES=16*1024*1024;
export function parseMa75BulkArgs(args){
 const values={execute:false};const seen=new Set();
 for(const arg of args){
  if(arg==='--execute'){
   if(values.execute)throw new TypeError('DUPLICATE_EXECUTE');values.execute=true;continue;
  }
  const m=/^--(from|to)=(.+)$/.exec(arg);
  if(!m||seen.has(m[1]))throw new TypeError('ONLY_FROM_TO_AND_OPTIONAL_EXECUTE');
  seen.add(m[1]);values[m[1]]=m[2];
 }
 if(!isDay(values.from)||!isDay(values.to)||values.from>=values.to||
  Date.parse(values.to+'T00:00:00Z')-Date.parse(values.from+'T00:00:00Z')>240*DAY_MS)
  throw new TypeError('INVALID_BOUNDED_HISTORICAL_DATE_RANGE');
 return values;
}
export function validateMa75OriginalTseCalendar(records,from,to){
 if(!Array.isArray(records))throw new TypeError('INVALID_CALENDAR_RESPONSE');
 const dates=[],divisions=new Set(['0','1','2','3']),seen=new Set();
 for(const r of records){
  if(!isDay(r?.Date)||r.Date<from||r.Date>to||
   !divisions.has(r.HolDiv)||seen.has(r.Date))
   throw new TypeError('CALENDAR_DUPLICATE_OR_UNEXPECTED_ROW');
  seen.add(r.Date);dates.push(r.Date);
 }
 const all=[];
 for(let t=Date.parse(from+'T00:00:00Z');t<=Date.parse(to+'T00:00:00Z');t+=DAY_MS)
  all.push(new Date(t).toISOString().slice(0,10));
 if(seen.size!==all.length||all.some(d=>!seen.has(d)))
  throw new TypeError('CALENDAR_HAS_MISSING_NONTRADING_DATES');
 const days=records.filter(r=>r.HolDiv==='1'||r.HolDiv==='2')
  .map(r=>r.Date).sort();
 if(days.length<91)throw new TypeError('SMA75_PLUS_RETEST_OUTCOME_INSUFFICIENT_SESSIONS');
 return days.slice(-MAX_SESSIONS);
}
const privateDir=()=>resolve('research-private');
const privatePath=p=>{
 const rel=relative(privateDir(),resolve(p));
 return rel!==''&&rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel);
};
const realPrivate=()=>{
 try{const s=lstatSync(privateDir());if(!s.isDirectory()||s.isSymbolicLink())
  throw new TypeError('RESEARCH_PRIVATE_NOT_A_REAL_DIRECTORY')}
 catch(e){if(e.code!=='ENOENT')throw e;mkdirSync(privateDir(),{recursive:false,mode:0o700})}
};
export function validateMa75SavedDailyForReplay(freeze,date,saved){
  validateMa75FrozenUniverse(freeze);
  if(saved?.version!=='ma75_one_date_original_capture_v1'||
     saved.date!==date||saved.requestScope!=='ALL_LISTED_ONE_DATE'||
     saved.completeProviderPagination!==true||
     saved.eligibleForProduction!==false||saved.eligibleForNotifications!==false||
     !Array.isArray(saved.pages)||saved.pages.length<1||saved.pages.length>12)
    throw new TypeError('UNTRUSTED_PREEXISTING_DATE_CAPTURE');
  const projected=projectMa75FullDateSource(freeze,{date,pages:saved.pages});
  if(!projected.completeProviderPagination||projected.audit.failures.length||
     projected.originalAllListedRows!==saved.originalProviderRows||
     projected.projectedFrozenRows!==saved.frozenRows||
     projected.excludedUnselectedListingRows!==saved.outsideFrozenRows||
     projected.audit.rows.some(r=>['INVALID_OHLCV','DUPLICATE_CODE_DATE',
       'BLOCKED_PAGINATION'].includes(r.status)))
    throw new TypeError('PREEXISTING_CAPTURE_INTEGRITY_MISMATCH');
  return projected;
}
export function readMa75PrivateSavedDate(path){
  if(!privatePath(path))throw new TypeError('CAPTURE_OUTSIDE_PRIVATE');
  let info;
  try{info=lstatSync(path)}catch(e){
    if(e.code==='ENOENT')return null;
    throw e;
  }
  if(!info.isFile()||info.isSymbolicLink()||info.size<1||info.size>MAX_CAPTURE_BYTES)
    throw new TypeError('PREEXISTING_CAPTURE_UNSAFE_FILE');
  const raw=readFileSync(path,'utf8');
  if(Buffer.byteLength(raw,'utf8')>MAX_CAPTURE_BYTES)
    throw new TypeError('PREEXISTING_CAPTURE_UNSAFE_SIZE');
  return JSON.parse(raw);
}
const safeWrite=(path,value)=>{
 if(!privatePath(path))throw new TypeError('OUTPUT_OUTSIDE_PRIVATE_DIRECTORY');
 writeFileSync(path,JSON.stringify(value)+'\n',{flag:'wx',mode:0o600,encoding:'utf8'});
};
export async function runMa75BulkResearch(argv,{
 env=process.env,fetchImpl=fetch,clock=()=>new Date(),
 pause=ms=>new Promise(done=>setTimeout(done,ms)),
 readFreeze=()=>JSON.parse(readFileSync(FREEZE,'utf8')),
 readCached=readMa75PrivateSavedDate,
 writePrivate=safeWrite,ensurePrivate=realPrivate,
 persist=true
}={}){
 const opts=parseMa75BulkArgs(argv);
 const now=clock();
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())||
   now.getTime()<Date.parse(opts.to+'T07:30:00Z'))
  throw new TypeError('DATE_NOT_COMMITTED_BEFORE_READ');
 if(!opts.execute)return {status:'DRY_RUN',networkRequests:0,
  willUseAlreadyAuthorizedDailyApiOnly:true,eligibleForProduction:false};
 if(env.SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY!=='YES'||
    typeof env.JQUANTS_API_KEY!=='string'||!env.JQUANTS_API_KEY)
  throw new TypeError('EXPLICIT_CONSENT_AND_PRIVATE_API_KEY_REQUIRED');
 const key=env.JQUANTS_API_KEY,freeze=readFreeze();
 validateMa75FrozenUniverse(freeze);
 const calUrl=new URL(CALENDAR);
 calUrl.searchParams.set('from',opts.from);calUrl.searchParams.set('to',opts.to);
 let reply;
 try{reply=await fetchImpl(calUrl,{method:'GET',
  headers:{'x-api-key':key,accept:'application/json'},
  credentials:'omit',redirect:'error',cache:'no-store',
  signal:AbortSignal.timeout(12000)});
 }catch{throw new Error('CALENDAR_NETWORK_FAILED')}
 if(!reply?.ok)throw new Error('CALENDAR_HTTP_FAILED_OR_NOT_ENTITLED');
 let body;
 try{body=await reply.json()}catch{throw new Error('CALENDAR_JSON_INVALID')}
 if(!body||!Array.isArray(body.data)||body.pagination_key)
  throw new TypeError('CALENDAR_PAGINATION_OR_RESPONSE_UNVERIFIED');
 const sessions=validateMa75OriginalTseCalendar(body.data,opts.from,opts.to);
 if(persist)ensurePrivate();
 const captures=[],perCode=new Map(freeze.codes.map(c=>[c,[]]));
 let alreadySavedDates=0,newlyDownloadedDates=0;
 const unavailableReasons={};
 for(let i=0;i<sessions.length;i++){
  const date=sessions[i],privateFile='research-private/'+date+'-jquants-daily.json';
  // A retry may reuse only exact, fully audited originals; never overwrite.
  const cached=persist?readCached(privateFile):null;
  const data=cached??await acquireMa75OneDatePages(freeze,{
   date,apiKey:key,clock,fetchImpl,maxPages:12
  });
  const project=validateMa75SavedDailyForReplay(freeze,date,data);
  if(cached){alreadySavedDates++}
  else{
   if(persist)writePrivate(privateFile,data);
   newlyDownloadedDates++;
  }
  for(const r of project.audit.rows)if(r.status!=='DAILY_BAR')
   unavailableReasons[r.status]=(unavailableReasons[r.status]??0)+1;
  for(const row of project.audit.rows){
   perCode.get(row.code).push(row.status==='DAILY_BAR'?{
    time:Math.floor(Date.parse(date+'T00:00:00Z')/1000),
    ...row.bar
   }:null);
  }
  captures.push({date,rows:data.originalProviderRows,selected:data.frozenRows,
   missingFrozen:project.audit.counts.MISSING_PROVIDER_ROW??0});
  if(!cached&&i+1<sessions.length)await pause(8000); // conservative per-date pacing
 }
 const cohorts=[];
 let incompleteCodes=0;
 for(const [code,bars] of perCode){
  if(bars.length!==sessions.length||bars.some(x=>x===null)){incompleteCodes++;continue}
  cohorts.push({code,timeframe:'1D',candles:bars});
 }
 const summary=studyMa75BreakoutRetest(cohorts);
 // Never present winners-only returns when an incomplete frozen population was
 // quietly dropped from the denominator. Historical source data remains usable
 // for an independent audit but not as a full-cohort win-rate claim.
 const fullPopulationCoverage=incompleteCodes===0;
 const aggregate={
  version:'ma75_jquants_bulk_retrospective_v1',status:'HISTORICAL_ONLY',
  provider:'JQUANTS_V2_ORIGINAL_DAILY',from:opts.from,to:opts.to,
  sessions:sessions.length,freezeSize:freeze.codes.length,
  expectedCodeSessions:freeze.codes.length*sessions.length,
  providerDateCaptures:captures.length,
  previouslySavedDates:alreadySavedDates,newlyDownloadedDates,
  fullHistoryCodes:cohorts.length,incompleteCodes,
  unavailableFrozenCodeSessionCounts:unavailableReasons,
  structurallyCompleteFrozenUniverse:fullPopulationCoverage,
  originalAllListedRows:captures.reduce((n,x)=>n+x.rows,0),
  coverageNotIndependentlyAuthenticated:true,
  results:fullPopulationCoverage?summary.stats:null,
  paired:fullPopulationCoverage?summary.paired:null,
  partialCohortStatisticsWithheld:!fullPopulationCoverage,
  researchedSubsetCodeCount:cohorts.length,
  provenance:'One-time historical read after frozen sample selection; NOT registered as-of trading signals',
  actualForwardCasesSinceFreeze:0,
  independentlyValidatedWinRate:null,
  independentHoldoutReady:false,
  eligibleForProduction:false,eligibleForNotifications:false,
  eligibleForAIPowerScoring:false,eligibleForTrading:false
 };
 if(persist)writePrivate('research-private/ma75-jquants-bulk-summary-'+opts.to+'.json',aggregate);
 return aggregate;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runMa75BulkResearch(process.argv.slice(2))
  .then(r=>process.stdout.write(JSON.stringify(r)+'\n'))
  .catch(()=>{process.stderr.write('MA75_BULK_HISTORICAL_READ_FAILED_OR_BLOCKED\n');
   process.exitCode=1});
}
