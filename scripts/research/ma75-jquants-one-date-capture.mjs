#!/usr/bin/env node
/**
 * Research-only one-date full-market J-Quants capture.
 * Default DRY RUN; --execute AND private environment approval required.
 * No cron, DB, subscription, scores, notifications, or trading.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {projectMa75FullDateSource} from '../../app/lib/research/ma75FullDateProjection.mjs';

export const MA75_DATE_CAPTURE_VERSION='ma75_one_date_original_capture_v1';
export const MA75_DAILY_ENDPOINT='https://api.jquants.com/v2/equities/bars/daily';
export const MAX_DATE_CAPTURE_PAGES=12;
const freezeUrl=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
const validDate=d=>typeof d==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(d)&&
 Number.isFinite(Date.parse(d+'T00:00:00Z'))&&
 new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const validCode=c=>typeof c==='string'&&/^[0-9]{3}[0-9A-Z](?:[0-9])?$/.test(c);
export function planMa75OneDateCapture({date,maxPages=MAX_DATE_CAPTURE_PAGES,now=new Date()}={}){
 const nowMs=now instanceof Date?now.getTime():NaN;
 if(!validDate(date)||!Number.isInteger(maxPages)||maxPages<1||
    maxPages>MAX_DATE_CAPTURE_PAGES||!Number.isFinite(nowMs)||
    nowMs<Date.parse(date+'T07:30:00Z'))
  throw new TypeError('REQUIRE_PUBLISHED_HISTORICAL_DATE_AND_BOUNDED_PAGES');
 return {version:MA75_DATE_CAPTURE_VERSION,date,scope:'ALL_LISTED_ONE_DATE',
  endpoint:MA75_DAILY_ENDPOINT,maxPages,upperBoundRequests:maxPages,
  requiresExplicitExecute:true,requiresSeparateEnvironmentApproval:true,
  providerEntitlementVerified:false,performsAutomaticCollection:false,
  eligibleForProduction:false};
}
export function parseMa75OneDateCaptureArgs(argv){
 const args={execute:false,maxPages:MAX_DATE_CAPTURE_PAGES},seen=new Set();
 for(const token of argv){
  if(token==='--execute'){
   if(args.execute)throw new TypeError('DUPLICATE_EXECUTE');
   args.execute=true;continue;
  }
  const m=/^--(date|max-pages|output)=(.+)$/.exec(token);
  if(!m||seen.has(m[1]))
   throw new TypeError('REQUIRE_UNIQUE_DATE_OUTPUT_OPTIONAL_MAX_PAGES');
  seen.add(m[1]);
  args[m[1]==='max-pages'?'maxPages':m[1]]=m[1]==='max-pages'?Number(m[2]):m[2];
 }
 if(!args.date||!args.output||typeof args.output!=='string'||
    !args.output.endsWith('.json')||args.output.length>240||
    args.output.includes('\0')||!Number.isInteger(args.maxPages)||
    args.maxPages<1||args.maxPages>MAX_DATE_CAPTURE_PAGES)
  throw new TypeError('REQUIRE_SAFE_OUTPUT_JSON_AND_DATE');
 return args;
}
export async function acquireMa75OneDatePages(freeze,{
 date,maxPages=MAX_DATE_CAPTURE_PAGES,apiKey,
 fetchImpl=fetch,clock=()=>new Date()
}={}){
 planMa75OneDateCapture({date,maxPages,now:clock()});
 if(typeof apiKey!=='string'||apiKey.length===0)
  throw new TypeError('JQUANTS_API_KEY_REQUIRED_IN_PRIVATE_ENV');
 let continuation=null,lastCapture=null,totalRows=0;
 const tokens=new Set(),codes=new Set(),pages=[];
 for(let i=0;i<maxPages;i++){
  const url=new URL(MA75_DAILY_ENDPOINT);
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
   throw new Error('JQUANTS_ONE_DATE_NETWORK_OR_REDIRECT_BLOCKED');
  }
  if(!res?.ok)
   throw new Error(res?.status===403?'JQUANTS_ONE_DATE_PERMISSION_UNVERIFIED':
    res?.status===429?'JQUANTS_ONE_DATE_RATE_LIMIT_NO_RETRY':
     'JQUANTS_ONE_DATE_HTTP_FAILURE');
  let payload;
  try{payload=await res.json()}catch{
   throw new Error('JQUANTS_ONE_DATE_INVALID_JSON');
  }
  if(!payload||!Array.isArray(payload.data)||payload.data.length>10000)
   throw new Error('JQUANTS_ONE_DATE_INVALID_PAGE_ENVELOPE');
  for(const row of payload.data){
   if(row?.Date!==date||!validCode(row?.Code)||codes.has(row.Code))
    throw new Error('JQUANTS_ONE_DATE_WRONG_OR_DUPLICATE_CODE_DATE');
   codes.add(row.Code);
  }
  totalRows+=payload.data.length;
  if(totalRows>120000)throw new Error('JQUANTS_ONE_DATE_UNSAFE_ROW_COUNT');
  const captured=clock(),capturedMs=captured instanceof Date?captured.getTime():NaN;
  if(!Number.isFinite(capturedMs)||
     (lastCapture!==null&&capturedMs<lastCapture))
   throw new Error('JQUANTS_ONE_DATE_INVALID_CAPTURE_CLOCK');
  lastCapture=capturedMs;
  pages.push({requestPaginationKey:continuation,
   receivedAt:captured.toISOString(),response:payload});
  const next=payload.pagination_key;
  if(next===undefined||next===null||next===''){
   const projected=projectMa75FullDateSource(freeze,{date,pages});
   if(!projected.completeProviderPagination)
    throw new Error('JQUANTS_ONE_DATE_UNVERIFIED_PAGINATION');
   // Keep true no-trade/corporate-action/missing rows for manual review, but
   // never privately save a source as verified if a frozen OHLCV row is corrupt.
   if(projected.audit.failures.length>0||projected.audit.rows.some(r=>
       ['INVALID_OHLCV','DUPLICATE_CODE_DATE','BLOCKED_PAGINATION'].includes(r.status)))
    throw new Error('JQUANTS_ONE_DATE_INVALID_FROZEN_STOCK_DAY');
   return {
    version:MA75_DATE_CAPTURE_VERSION,date,sourceEndpoint:MA75_DAILY_ENDPOINT,
    requestScope:'ALL_LISTED_ONE_DATE',pages,
    originalProviderRows:projected.originalAllListedRows,
    frozenRows:projected.projectedFrozenRows,
    outsideFrozenRows:projected.excludedUnselectedListingRows,
    completeProviderPagination:true,
    sourceUsageRightsIndependentlyVerified:false,
    pointInTimeDecisionAvailabilityVerified:false,
    eligibleForProduction:false,eligibleForNotifications:false
   };
  }
  if(typeof next!=='string'||tokens.has(next)||next===continuation)
   throw new Error('JQUANTS_ONE_DATE_BAD_PAGINATION_KEY');
  tokens.add(next);continuation=next;
 }
 throw new Error('JQUANTS_ONE_DATE_PAGE_LIMIT_REACHED_NO_OUTPUT');
}
export async function runMa75OneDateCapture(argv,{
 env=process.env,clock=()=>new Date(),fetchImpl=fetch,
 read=readFileSync,write=writeFileSync
}={}){
 const args=parseMa75OneDateCaptureArgs(argv);
 const plan=planMa75OneDateCapture({date:args.date,maxPages:args.maxPages,now:clock()});
 if(!args.execute)return {...plan,status:'DRY_RUN_NO_NETWORK_NO_FILE',
  outputRequested:args.output};
 if(env.SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY!=='YES')
  throw new Error('ONE_DATE_CAPTURE_REQUIRES_PRIVATE_EXPLICIT_APPROVAL');
 if(typeof env.JQUANTS_API_KEY!=='string'||!env.JQUANTS_API_KEY)
  throw new Error('ONE_DATE_CAPTURE_PRIVATE_API_KEY_MISSING');
 const freeze=JSON.parse(read(freezeUrl,'utf8'));
 const capture=await acquireMa75OneDatePages(freeze,{
  date:args.date,maxPages:args.maxPages,apiKey:env.JQUANTS_API_KEY,
  fetchImpl,clock
 });
 write(args.output,JSON.stringify(capture,null,2)+'\n',{
  flag:'wx',mode:0o600,encoding:'utf8'
 });
 return {status:'ORIGINAL_ONE_DATE_SAVED_PRIVATE',date:args.date,
  pages:capture.pages.length,originalRows:capture.originalProviderRows,
  frozenRows:capture.frozenRows,sourceRightsVerified:false,
  eligibleForProduction:false,eligibleForNotifications:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runMa75OneDateCapture(process.argv.slice(2))
  .then(summary=>process.stdout.write(JSON.stringify(summary)+'\n'))
  .catch(()=>{
   process.stderr.write('MA75_ONE_DATE_CAPTURE_FAILED_OR_BLOCKED\n');
   process.exitCode=1;
  });
}
