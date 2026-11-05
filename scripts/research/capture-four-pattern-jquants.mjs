#!/usr/bin/env node
/**
 * Explicit local read-only J-Quants V2 historical capture, ONE code, 1-20 dates.
 * DRY RUN by default. Raw responses never enter Git, Vercel, DB or logs.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {studyCapturedJQuantsFourPatterns,reconcileCapturedTradeDay,convertCapturedFinancialSummary} from '../../app/lib/research/fourPatternJQuantsBridge.mjs';

export const CAPTURE_ENDPOINTS=Object.freeze({
 minute:'https://api.jquants.com/v2/equities/bars/minute',
 daily:'https://api.jquants.com/v2/equities/bars/daily',
 financial:'https://api.jquants.com/v2/fins/summary',
});
const dayOK=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&
 Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const codeOK=s=>typeof s==='string'&&/^[0-9]{3}[0-9A-Z]$/.test(s);
export function planFourPatternCapture(argv,now=new Date()){
 const args={execute:false,skipFinancial:false,maxPages:4,code:null,dates:null},seen=new Set();
 for(const arg of argv){
  if(arg==='--execute'||arg==='--skip-financial'){
   if(seen.has(arg))throw Error('DUPLICATE_FLAG');
   seen.add(arg);
   if(arg==='--execute')args.execute=true;else args.skipFinancial=true;
   continue;
  }
  const m=/^--(code|dates|max-pages)=(.+)$/.exec(arg);
  if(!m||seen.has(m[1]))throw Error('INVALID_OR_DUPLICATE_CAPTURE_ARG');
  seen.add(m[1]);
  if(m[1]==='code')args.code=m[2];
  else if(m[1]==='dates')args.dates=m[2].split(',');
  else args.maxPages=Number(m[2]);
 }
 if(!codeOK(args.code)||!Array.isArray(args.dates)||
  args.dates.length<1||args.dates.length>20||
  args.dates.some((d,i)=>!dayOK(d)||(i>0&&d<=args.dates[i-1]))||
  !Number.isInteger(args.maxPages)||args.maxPages<1||args.maxPages>4||
  !Number.isFinite(now.getTime())||
  args.dates.some(d=>now.getTime()<Date.parse(d+'T07:30:00Z')))
  throw Error('REQUIRE_CODE_SORTED_1_TO_20_PUBLISHED_DATES_MAX_PAGES_1_TO_4');
 return {
  code:args.code,dates:args.dates,execute:args.execute,
  skipFinancial:args.skipFinancial,maxPages:args.maxPages,
  maxRequests:args.dates.length*args.maxPages*2+(args.skipFinancial?0:8),
  mode:args.execute?'EXPLICIT_LOCAL_HISTORICAL_CAPTURE':'DRY_RUN_ZERO_API',
  filename:['four-pattern-jquants',args.code,args.dates[0],args.dates.at(-1)].join('-')+'.json',
  schedule:false,automatedOrders:false,notifications:false,productionWrites:false,
 };
}

/**
 * Report only fixed-format validation codes and the requested trade date.
 * Never print provider rows, response bodies, upstream exceptions or API keys.
 */
export function safeCaptureFailure(error,{stage='UNKNOWN',date=null}={}){
 const raw=error instanceof Error?error.message:'';
 const code=/^[A-Z][A-Z0-9_]{2,100}$/.test(raw)?raw:'UNKNOWN_VALIDATION_FAILURE';
 const allowedStages=new Set(['MINUTE_DAILY','FINANCIAL','FOUR_PATTERN_STUDY']);
 const wrapped=new Error(code);
 wrapped.stage=allowedStages.has(stage)?stage:'UNKNOWN';
 wrapped.tradeDate=dayOK(date)?date:null;
 return wrapped;
}
export function validateCapturedFourPatternDay({code,date,minutePages,dailyPages}){
 try {
  const result=reconcileCapturedTradeDay({code,date,minutePages,dailyPages});
  return {status:'MINUTE_DAILY_RECONCILED',date,observedMinuteBars:result.minuteBarCount};
 }catch(error){
  throw safeCaptureFailure(error,{stage:'MINUTE_DAILY',date});
 }
}
export function validateCapturedFourPatternFinancials({code,financialPages}){
 try{
  const result=convertCapturedFinancialSummary({code,pages:financialPages});
  return {status:result.status,usableSnapshots:result.fundamentals.length};
 }catch(error){
  throw safeCaptureFailure(error,{stage:'FINANCIAL'});
 }
}

const codeMatch=(provider,code)=>provider===code||provider===code+'0';
export async function requestCapturedJQuantsPages({
 type,code,date=null,maxPages=4,apiKey,fetchImpl=fetch,
}={}){
 if(!Object.hasOwn(CAPTURE_ENDPOINTS,type)||!codeOK(code)||
  !(date===null||dayOK(date))||
  (type==='financial'&&date!==null)||(type!=='financial'&&date===null)||
  !Number.isInteger(maxPages)||maxPages<1||
  maxPages>(type==='financial'?8:4))
  throw Error('INVALID_BOUND_JQUANTS_REQUEST');
 if(typeof apiKey!=='string'||!apiKey.trim())throw Error('SECURE_JQUANTS_KEY_NOT_CONFIGURED');
 const pages=[],seen=new Set();
 let next=null,rowsSeen=0;
 for(let i=0;i<maxPages;i++){
  const url=new URL(CAPTURE_ENDPOINTS[type]);
  url.searchParams.set('code',code);
  if(date!==null)url.searchParams.set('date',date);
  if(next!==null)url.searchParams.set('pagination_key',next);
  let response;
  try{
   response=await fetchImpl(url,{
    method:'GET',headers:{'x-api-key':apiKey,accept:'application/json'},
    redirect:'error',credentials:'omit',cache:'no-store',
    referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000),
   });
  }catch{throw Error('JQUANTS_NETWORK_TIMEOUT_OR_REDIRECT_BLOCKED')}
  if(!response?.ok){
   const status=response?.status;
   throw Error(status===403?'JQUANTS_SUBSCRIPTION_OR_PERMISSION_403':
    status===429?'JQUANTS_RATE_LIMIT_429':
    'JQUANTS_HTTP_'+(Number.isInteger(status)?status:'UNKNOWN'));
  }
  let payload;
  try{payload=await response.json()}catch{throw Error('JQUANTS_INVALID_JSON')}
  if(!payload||!Array.isArray(payload.data))
   throw Error('JQUANTS_INVALID_RESPONSE_ENVELOPE');
  rowsSeen+=payload.data.length;
  if(rowsSeen>(type==='financial'?600:type==='minute'?327:3))
   throw Error('JQUANTS_SCOPE_EXCEEDED');
  if(payload.data.some(row=>!codeMatch(row?.Code,code)||
   (date!==null&&row.Date!==date)))
   throw Error('JQUANTS_WRONG_CODE_OR_DATE');
  pages.push({requestPaginationKey:next,receivedAt:new Date().toISOString(),response:payload});
  const continuation=payload.pagination_key??null;
  if(continuation===null||continuation==='')return pages;
  if(typeof continuation!=='string'||continuation.length>200||
   continuation===next||seen.has(continuation))
   throw Error('JQUANTS_BAD_PAGINATION_TOKEN');
  seen.add(continuation);next=continuation;
 }
 throw Error('JQUANTS_INCOMPLETE_PAGINATION');
}
export async function runFourPatternCapture(argv,options={}){
 const plan=planFourPatternCapture(argv,options.now??new Date());
 if(!plan.execute)return plan;
 if(process.env.JQUANTS_RESEARCH_PROBE_ENABLED!=='true'||!process.env.JQUANTS_API_KEY)
  throw Error('LOCAL_PRIVATE_RESEARCH_ENV_NOT_READY');
 const apiKey=process.env.JQUANTS_API_KEY;
 const minuteDays=[],dailyDays=[];
 for(const date of plan.dates){
  const minutePages=await requestCapturedJQuantsPages({
   type:'minute',code:plan.code,date,maxPages:plan.maxPages,
   apiKey,fetchImpl:options.fetchImpl??fetch,
  });
  const dailyPages=await requestCapturedJQuantsPages({
   type:'daily',code:plan.code,date,maxPages:plan.maxPages,
   apiKey,fetchImpl:options.fetchImpl??fetch,
  });
  minuteDays.push({date,pages:minutePages});
  validateCapturedFourPatternDay({code:plan.code,date,minutePages,dailyPages});
  dailyDays.push({date,pages:dailyPages});
 }
 const financialPages=plan.skipFinancial?null:
  await requestCapturedJQuantsPages({
   type:'financial',code:plan.code,maxPages:8,
   apiKey,fetchImpl:options.fetchImpl??fetch,
  });
 validateCapturedFourPatternFinancials({code:plan.code,financialPages});
 const archive={code:plan.code,minuteDays,dailyDays,financialPages};
 const audit=studyCapturedJQuantsFourPatterns({...archive,timeframe:'BOTH'});
 if(audit.status!=='HISTORICAL_RECONCILED_SHADOW_ONLY')
  throw safeCaptureFailure(new Error(audit.status),{stage:'FOUR_PATTERN_STUDY'});
 const dir=resolve('.private-research');
 mkdirSync(dir,{recursive:true,mode:0o700});
 const path=join(dir,plan.filename);
 writeFileSync(path,JSON.stringify(archive),{flag:'wx',mode:0o600});
 return {status:'CAPTURED_PRIVATE_LOCAL_ONLY',code:plan.code,
  captureFile:path,dates:plan.dates,minuteRows:audit.capturedOriginalMinutes,
  financialSnapshots:audit.financialAsOfSnapshots,
  safeForTrading:false,eligibleForProduction:false};
}
const running=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(running){
 runFourPatternCapture(process.argv.slice(2)).then(result=>{
  console.log(JSON.stringify(result,null,2));
 }).catch(error=>{
  const safe=safeCaptureFailure(error,{
   stage:error?.stage??'UNKNOWN',date:error?.tradeDate??null,
  });
  console.error('FOUR_PATTERN_CAPTURE_BLOCKED',
   JSON.stringify({stage:safe.stage,tradeDate:safe.tradeDate,reason:safe.message}));
  process.exitCode=1;
 });
}
