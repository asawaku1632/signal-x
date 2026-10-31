#!/usr/bin/env node
/**
 * Explicit opt-in single-symbol, single-day J-Quants minute pilot.
 * By default: dry-run, no key read, network request, DB write or billing.
 * No scheduling, live 09:05 decisions, AI scoring, alerts or trading.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {auditMorningMinuteShadow} from '../../app/lib/research/morningMinuteShadow.mjs';
import {parseMa75JQuantsDailyPages}
 from '../../app/lib/research/ma75JQuantsDailyPages.mjs';
import {reconcileMorningMinuteDaily}
 from '../../app/lib/research/morningMinuteDailyReconciliation.mjs';

const FREEZE_FILE=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
export const MINUTE_PROBE_ENDPOINT='https://api.jquants.com/v2/equities/bars/minute';
export const DAILY_PROBE_ENDPOINT='https://api.jquants.com/v2/equities/bars/daily';
const MAX_ONE_DAY_TSE_MINUTE_BARS=327; // 09:00–11:30, 12:30–15:24, 15:30
const ordinaryCode=c=>typeof c==='string'&&/^[0-9]{3}[0-9A-Z]$/.test(c);
const matchOrdinaryCode=(rowCode,code)=>rowCode===code||rowCode===code+'0';
const realDay=d=>typeof d==='string'&&/^20\d\d-\d\d-\d\d$/.test(d)&&
 Number.isFinite(Date.parse(d+'T00:00:00Z'))&&
 new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
export function planSingleCodeMinuteProbe(freeze,{code,date,execute=false,compareDaily=false,maxPages=4,enabled=false,now=new Date()}={}){
 const today=new Intl.DateTimeFormat('sv-SE',{
  timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'
 }).format(now);
 if(typeof code!=='string'||!freeze?.codes?.includes(code)||
   !realDay(date)||!Number.isInteger(maxPages)||maxPages<1||maxPages>4||
   date>today||now.getTime()<Date.parse(date+'T07:30:00Z'))
   throw new TypeError('Require frozen code, completed historical provider update window and 1-4 pages');
 return {
   plan:'SINGLE_FROZEN_CODE_HISTORICAL_MINUTE_V1',code,date,maxPages,
   endpoint:MINUTE_PROBE_ENDPOINT,noBackgroundPolling:true,
   needsExecuteFlag:execute!==true,
   needsSecureEnvironmentApproval:execute===true&&enabled!==true,
   callAuthorizedByScript:execute===true&&enabled===true,
   requestUpperLimit:maxPages*(compareDaily===true?2:1),
   compareDaily:compareDaily===true,
   requiresDailyReconciliationForAnalysis:true,
   providerEntitlementIndependentlyVerified:false,
   safeForProduction:false
 };
}
export function parseMinuteProbeArgs(argv){
 const args={execute:false,compareDaily:false,maxPages:4};
 for(const token of argv){
   if(token==='--execute'){args.execute=true;continue}
   if(token==='--compare-daily'){args.compareDaily=true;continue}
   const m=/^--(code|date|max-pages)=(.+)$/.exec(token);
   if(!m)throw new TypeError('Use --execute --compare-daily --code=XXXX --date=YYYY-MM-DD --max-pages=1..4');
   if(m[1]==='max-pages')args.maxPages=Number(m[2]);
   else args[m[1]]=m[2];
 }
 return args;
}
export async function fetchMinutePilotPages({code,date,maxPages,apiKey,fetchImpl=fetch,now=new Date()}){
 if(!ordinaryCode(code)||!realDay(date)||
   !Number.isInteger(maxPages)||maxPages<1||maxPages>4||
   !Number.isFinite(now?.getTime?.())||
   now.getTime()<Date.parse(date+'T07:30:00Z'))
   throw new TypeError('MINUTE_PROBE_SCOPE_MUST_BE_ONE_PUBLISHED_CODE_DAY_MAX_FOUR_PAGES');
 if(typeof apiKey!=='string'||apiKey.length===0)throw new Error('API_KEY_MISSING_IN_SECURE_ENV');
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>4)throw new TypeError('MAX_PAGES_OUT_OF_RANGE');
 if(typeof code!=='string'||!/^[0-9A-Z]{4,5}$/.test(code)||!realDay(date))throw new TypeError('INVALID_CODE_OR_DATE');
 const pages=[];
 let rowsSeen=0;
 let continuation=null;
 const used=new Set();
 for(let i=0;i<maxPages;i++){
   const url=new URL(MINUTE_PROBE_ENDPOINT);
   url.searchParams.set('code',code);
   url.searchParams.set('date',date);
   if(continuation!==null)url.searchParams.set('pagination_key',continuation);
   let res;
   try{
     res=await fetchImpl(url,{
       method:'GET',headers:{'x-api-key':apiKey,accept:'application/json'},
       redirect:'error',credentials:'omit',cache:'no-store',
       referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)
     });
   }catch{
     // Upstream fetch exceptions may contain headers, URLs, proxy diagnostics,
     // or internal server details: never relay the original exception.
     throw new Error('JQUANTS_NETWORK_TIMEOUT_OR_REDIRECT_BLOCKED');
   }
   if(!res.ok){
     const status=res.status;
     throw new Error(status===403?'JQUANTS_403_KEY_OR_PERMISSION_UNVERIFIED':
       status===429?'JQUANTS_429_RATE_LIMIT':'JQUANTS_HTTP_'+status);
   }
   let payload;
   try{payload=await res.json();}
   catch{throw new Error('JQUANTS_INVALID_JSON_RESPONSE');}
   if(!payload||!Array.isArray(payload.data))throw new Error('JQUANTS_BAD_MINUTE_ENVELOPE');
   rowsSeen+=payload.data.length;
   if(rowsSeen>MAX_ONE_DAY_TSE_MINUTE_BARS)
     throw new Error('JQUANTS_EXCESS_ONE_CODE_DAY_MINUTE_ROWS');
   if(payload.data.some(row=>row?.Date!==date||!matchOrdinaryCode(row?.Code,code)))
     throw new Error('JQUANTS_WRONG_CODE_OR_DATE_IN_PROVIDER_RESPONSE');
   pages.push({requestPaginationKey:continuation,
     receivedAt:new Date().toISOString(),response:payload});
   const next=payload.pagination_key;
   if(next===null||next===undefined||next==='')return pages;
   if(typeof next!=='string'||used.has(next))
     throw new Error('JQUANTS_REPEATED_OR_INVALID_PAGINATION_KEY');
   used.add(next);
   continuation=next;
 }
 // The parser must quarantine an unfinished continuation chain.
 return pages;
}

/**
 * Explicit --compare-daily only: same code/day on Standard daily endpoint.
 * Max four pages and four provider rows in a ONE code/day experiment.
 */
export async function fetchDailyPilotPages({
 code,date,maxPages,apiKey,fetchImpl=fetch,now=new Date()
}={}){
 if(!ordinaryCode(code)||!realDay(date)||
    !Number.isInteger(maxPages)||maxPages<1||maxPages>4||
    !Number.isFinite(now?.getTime?.())||
    now.getTime()<Date.parse(date+'T07:30:00Z'))
   throw new TypeError('DAILY_PROBE_SCOPE_ONE_PUBLISHED_CODE_DAY_MAX_FOUR_PAGES');
 if(typeof apiKey!=='string'||apiKey.length===0)
   throw new Error('API_KEY_MISSING_IN_SECURE_ENV');
 const pages=[],used=new Set();
 let continuation=null,rowsSeen=0;
 for(let i=0;i<maxPages;i++){
   const url=new URL(DAILY_PROBE_ENDPOINT);
   url.searchParams.set('code',code);
   url.searchParams.set('date',date);
   if(continuation!==null)url.searchParams.set('pagination_key',continuation);
   let response;
   try{
     response=await fetchImpl(url,{
       method:'GET',headers:{'x-api-key':apiKey,accept:'application/json'},
       redirect:'error',credentials:'omit',cache:'no-store',
       referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)
     });
   }catch{
     throw new Error('JQUANTS_DAILY_NETWORK_TIMEOUT_OR_REDIRECT_BLOCKED');
   }
   if(!response.ok){
     const status=response.status;
     throw new Error(status===403?'JQUANTS_DAILY_403_KEY_OR_PERMISSION_UNVERIFIED':
       status===429?'JQUANTS_DAILY_429_RATE_LIMIT':'JQUANTS_DAILY_HTTP_'+status);
   }
   let payload;
   try{payload=await response.json();}
   catch{throw new Error('JQUANTS_DAILY_INVALID_JSON_RESPONSE');}
   if(!payload||!Array.isArray(payload.data))
     throw new Error('JQUANTS_DAILY_BAD_RESPONSE_ENVELOPE');
   rowsSeen+=payload.data.length;
   if(rowsSeen>4)throw new Error('JQUANTS_DAILY_EXCESS_ONE_CODE_DATE_ROWS');
   if(payload.data.some(row=>row?.Date!==date||
       !matchOrdinaryCode(row?.Code,code)))
     throw new Error('JQUANTS_DAILY_WRONG_CODE_OR_DATE');
   pages.push({requestPaginationKey:continuation,
     receivedAt:new Date().toISOString(),response:payload});
   const next=payload.pagination_key;
   if(next===undefined||next===null||next==='')return pages;
   if(typeof next!=='string'||used.has(next))
     throw new Error('JQUANTS_DAILY_REPEATED_OR_INVALID_PAGINATION');
   used.add(next);continuation=next;
 }
 return pages; // daily parser quarantines incomplete continuation
}

/**
 * Read-only summary gate. Unreconciled or bad-provider history must NOT
 * expose apparently actionable bottom/rebound percentages in CLI output.
 * Even fully matched retrospective metrics have no true 09:05 availability.
 */
export function summarizeMinutePilotResult({minute,reconciliation=null,compareDaily=false}={}){
 const minuteValid=minute?.structuralPass===true&&minute.pageChainComplete===true&&
   Array.isArray(minute.errors)&&minute.errors.length===0;
 const reconciled=minuteValid&&compareDaily===true&&
   reconciliation?.structuralOneCodeDayMatched===true&&
   reconciliation.blocked===false&&
   reconciliation.code===minute.code&&reconciliation.date===minute.date&&
   Array.isArray(reconciliation.blockers)&&reconciliation.blockers.length===0;
 const noTradeMatched=minuteValid&&compareDaily===true&&
   reconciliation?.matchingNoTradeSession===true&&
   reconciliation.blocked===true&&
   reconciliation.code===minute.code&&reconciliation.date===minute.date&&
   Array.isArray(reconciliation.blockers)&&reconciliation.blockers.length===0;
 const status=!minuteValid?'PILOT_INCOMPLETE':
   !compareDaily?'MINUTE_ONLY_UNRECONCILED':
   reconciled?'HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH':
   noTradeMatched?'MATCHED_NO_TRADE_NO_SIGNAL':'BLOCKED_DAILY_RECONCILIATION';
 return {
   status,
   code:minute?.code??null,date:minute?.date??null,
   pageChainComplete:minute?.pageChainComplete===true,
   parsedMinuteBars:minute?.observedRawBars??null,
   dailyComparisonRequested:compareDaily===true,
   dailyReconciliationMatched:reconciled,
   historicalQualityHold:!reconciled,
   minuteErrors:Array.isArray(minute?.errors)?[...minute.errors]:['MISSING_MINUTE_AUDIT'],
   reconciliationBlockers:Array.isArray(reconciliation?.blockers)?
     [...reconciliation.blockers]:compareDaily?['NO_VALID_DAILY_COMPARISON']:[],
   asOf905:reconciled?minute.asOf905:null,
   retrospective:reconciled?minute.retrospective:null,
   metricsReleasedForHistoricalResearch:reconciled,
   historicalMetricsAreHindsightOnly:true,
   actual0905AvailabilityVerified:false,
   verifiedExchangeSource:false,
   independentlyVerifiedTradingEdge:false,
   eligibleForNotifications:false,eligibleForProduction:false,
   note:reconciled?
     'One historical code/day has structurally matching original OHLCV; not a verified as-of 09:05 signal or realized profit.':
     'Without an intact minute-to-daily match, the pilot suppresses all hypothetical 09:05 and retrospective rebound metrics.'
 };
}
export async function main(argv=process.argv.slice(2),env=process.env){
 const freeze=JSON.parse(readFileSync(FREEZE_FILE,'utf8'));
 const args=parseMinuteProbeArgs(argv);
 const plan=planSingleCodeMinuteProbe(freeze,{
   code:args.code,date:args.date,execute:args.execute,
   compareDaily:args.compareDaily,
   maxPages:args.maxPages,enabled:env.JQUANTS_RESEARCH_PROBE_ENABLED==='true'
 });
 if(!plan.callAuthorizedByScript){
   process.stdout.write(JSON.stringify({
     ...plan,status:'DRY_RUN_NO_KEY_READ_OR_NETWORK',
     note:'--execute also requires JQUANTS_RESEARCH_PROBE_ENABLED=true in a secure environment'
   },null,2)+'\n');
   return plan;
 }
 const pages=await fetchMinutePilotPages({
   code:args.code,date:args.date,maxPages:args.maxPages,
   apiKey:env.JQUANTS_API_KEY
 });
 const result=auditMorningMinuteShadow(freeze,{
   code:args.code,date:args.date,pages
 });
 let reconciliation=null;
 if(args.compareDaily&&result.structuralPass){
   const dailyPages=await fetchDailyPilotPages({
     code:args.code,date:args.date,maxPages:args.maxPages,
     apiKey:env.JQUANTS_API_KEY
   });
   const dailyAudit=parseMa75JQuantsDailyPages(freeze,{
     date:args.date,pages:dailyPages
   });
   reconciliation=reconcileMorningMinuteDaily(freeze,{
     code:args.code,date:args.date,minute:result,daily:dailyAudit
   });
 }
 const report=summarizeMinutePilotResult({
   minute:result,reconciliation,compareDaily:args.compareDaily
 });
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
 return report;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===fileURLToPath(pathToFileURL(resolve(process.argv[1])))){
 main().catch(error=>{
   process.stderr.write('PILOT_FAILED: '+String(error?.message??'UNKNOWN').slice(0,150)+'\n');
   process.exitCode=1;
 });
}
