import test from 'node:test';
import assert from 'node:assert/strict';
import {planSingleCodeMinuteProbe,parseMinuteProbeArgs,fetchMinutePilotPages,fetchDailyPilotPages,
 summarizeMinutePilotResult,
 DAILY_PROBE_ENDPOINT,MINUTE_PROBE_ENDPOINT}
 from '../scripts/research/jquants-minute-pilot.mjs';
const freeze={codes:['3753','9984']};
const now=new Date('2026-11-01T12:00:00Z');
const plan=(opt={})=>planSingleCodeMinuteProbe(freeze,{
 code:opt.code??'3753',date:opt.date??'2026-10-30',
 execute:opt.execute??false,compareDaily:opt.compareDaily??false,
 enabled:opt.enabled??false,
 maxPages:opt.maxPages??4,now:opt.now??now
});
const runFetch=(mock,more={})=>fetchMinutePilotPages({
 code:'3753',date:'2026-10-30',maxPages:4,
 apiKey:'SECRET',fetchImpl:mock,...more
});
test('default remains offline without live secret and its scope is exactly one code/day',()=>{
 const p=plan();
 assert.equal(p.callAuthorizedByScript,false);
 assert.equal(p.noBackgroundPolling,true);
 assert.equal(p.providerEntitlementIndependentlyVerified,false);
 assert.equal(p.requestUpperLimit,4);
 assert.equal(p.endpoint,MINUTE_PROBE_ENDPOINT);
});
test('execution and secure environment permission are independently necessary',()=>{
 assert.equal(plan({execute:true,enabled:false}).callAuthorizedByScript,false);
 assert.equal(plan({execute:false,enabled:true}).callAuthorizedByScript,false);
 assert.equal(plan({execute:true,enabled:true}).callAuthorizedByScript,true);
});
test('nonfrozen code, future or impossible date never authorizes execution',()=>{
 for(const code of ['1234','37531','']){
  assert.throws(()=>plan({code}),TypeError);
 }
 for(const date of ['2026-11-03','2026-11-31','2026-10-30T00:00Z']){
  assert.throws(()=>plan({date}),TypeError);
 }
});
test('one to four pages, never unbounded crawling',()=>{
 for(const maxPages of [0,5,-1,NaN]){
  assert.throws(()=>plan({maxPages}),TypeError);
 }
 assert.equal(plan({maxPages:1}).requestUpperLimit,1);
});
test('unrecognized command-line flag and API key as argument are refused',()=>{
 const a=parseMinuteProbeArgs(['--execute','--code=3753','--date=2026-10-30','--max-pages=2']);
 assert.equal(a.execute,true);
 assert.equal(a.maxPages,2);
 assert.equal(a.code,'3753');
 assert.throws(()=>parseMinuteProbeArgs(['--api-key=SECRET']),TypeError);
 assert.throws(()=>parseMinuteProbeArgs(['--all-codes']),TypeError);
});
test('missing secure key prevents any attempted network request',async()=>{
 let n=0;
 await assert.rejects(()=>runFetch(async()=>{n++;return {ok:true}}, {apiKey:''}),/API_KEY_MISSING/);
 assert.equal(n,0);
});
test('single page sends key only in header, never in URL or stored output',async()=>{
 let n=0;
 const rows=await runFetch(async(url,options)=>{
  n++;
  assert.equal(url.searchParams.get('code'),'3753');
  assert.equal(url.searchParams.get('date'),'2026-10-30');
  assert.equal(url.toString().includes('SECRET'),false);
  assert.equal(options.headers['x-api-key'],'SECRET');
  return {ok:true,json:async()=>({data:[]})};
 });
 assert.equal(n,1);
 assert.equal(rows.length,1);
 assert.equal(JSON.stringify(rows).includes('SECRET'),false);
});
test('continuation is included only after first page and empty token means terminal',async()=>{
 const tokens=[];
 const rows=await runFetch(async(url)=>{
  tokens.push(url.searchParams.get('pagination_key'));
  return {ok:true,json:async()=>({
   data:[],pagination_key:tokens.length===1?'NEXT':''
  })};
 });
 assert.deepEqual(tokens,[null,'NEXT']);
 assert.equal(rows.length,2);
 assert.equal(rows[1].requestPaginationKey,'NEXT');
});
test('repeated continuation token is blocked',async()=>{
 await assert.rejects(()=>runFetch(async()=>({
  ok:true,json:async()=>({data:[],pagination_key:'SAME'})
 })),/REPEATED/);
});
test('four-page cap prevents unlimited requests',async()=>{
 let n=0;
 const rows=await runFetch(async()=>({
  ok:true,json:async()=>({data:[],pagination_key:'P'+(++n)})
 }));
 assert.equal(n,4);assert.equal(rows.length,4);
 assert.equal(rows[3].response.pagination_key,'P4');
});
test('403/429 HTTP failures expose only status code without provider response body',async()=>{
 for(const status of [403,429]){
  const mock=async()=>({ok:false,status,text:async()=> 'PRIVATE_SECRET_RESPONSE'});
  await assert.rejects(()=>runFetch(mock),e=>
   e.message.includes(String(status))&&!e.message.includes('PRIVATE_SECRET_RESPONSE')
  );
 }
});
test('missing data array is an invalid envelope, not a no-trade date',async()=>{
 await assert.rejects(()=>runFetch(async()=>({
  ok:true,json:async()=>({bars:[]})
 })),/BAD_MINUTE_ENVELOPE/);
});

test('direct HTTP helper cannot bypass the max-four-page and one-code-day scope',async()=>{
 let calls=0;
 const mock=async()=>{calls++;return {ok:true,json:async()=>({data:[]})}};
 for(const args of [
  {code:'37531',date:'2026-10-30',maxPages:1},
  {code:'3753',date:'2026-11-31',maxPages:1},
  {code:'3753',date:'2026-10-30',maxPages:50},
  {code:'3753',date:'2026-10-30',maxPages:0}
 ]){
  await assert.rejects(()=>fetchMinutePilotPages({
   ...args,apiKey:'SECRET',fetchImpl:mock
  }),/MINUTE_PROBE_SCOPE/);
 }
 assert.equal(calls,0);
});

test('a same-day 09:05 or pre-release request cannot masquerade as archived minute data',()=>{
 for(const when of ['2026-10-30T00:05:00Z','2026-10-30T06:31:00Z']){
   assert.throws(()=>plan({date:'2026-10-30',now:new Date(when)}),TypeError);
 }
 assert.equal(plan({date:'2026-10-30',
  now:new Date('2026-10-30T08:10:00Z')}).callAuthorizedByScript,false);
});

test('HTTP redirects and upstream thrown messages cannot leak API secrets',async()=>{
 let inspected=false;
 const mock=async(url,options)=>{
   inspected=true;
   assert.equal(options.redirect,'error');
   assert.equal(options.credentials,'omit');
   assert.equal(options.cache,'no-store');
   assert.equal(options.referrerPolicy,'no-referrer');
   throw new Error('SECRET from proxy and authorization header');
 };
 await assert.rejects(()=>runFetch(mock),e=>
   e.message==='JQUANTS_NETWORK_TIMEOUT_OR_REDIRECT_BLOCKED'&&
   !e.message.includes('SECRET'));
 assert.equal(inspected,true);
});
test('wrong provider code/date stops before a next page or a valid retrospective result',async()=>{
 for(const row of [
  {Code:'37531',Date:'2026-10-30'},
  {Code:'99840',Date:'2026-10-30'},
  {Code:'37530',Date:'2026-10-31'}
 ]){
   let requests=0;
   await assert.rejects(()=>runFetch(async()=>{
     requests++;
     return {ok:true,json:async()=>({data:[row],pagination_key:'MORE'})};
   }),/WRONG_CODE_OR_DATE/);
   assert.equal(requests,1);
 }
});
test('valid one-symbol provider code in five-character common-share form is accepted',async()=>{
 const p=await runFetch(async()=>({
  ok:true,json:async()=>({data:[{Code:'37530',Date:'2026-10-30'}]})
 }));
 assert.equal(p.length,1);
 assert.equal(p[0].response.data.length,1);
});
test('provider cannot return impossible >327 daily minute rows in any combination of pages',async()=>{
 let fetched=0;
 const rows=Array.from({length:328},()=>({Code:'37530',Date:'2026-10-30'}));
 await assert.rejects(()=>runFetch(async()=>{
   fetched++;
   return {ok:true,json:async()=>({data:rows,pagination_key:'NEXT'})};
 }),/EXCESS_ONE_CODE_DAY_MINUTE_ROWS/);
 assert.equal(fetched,1);
});
test('invalid JSON response is redacted rather than logging the server body',async()=>{
 await assert.rejects(()=>runFetch(async()=>({
  ok:true,json:async()=>{throw new Error('PRIVATE_RESPONSE_WITH_SECRET')}
 })),e=>e.message==='JQUANTS_INVALID_JSON_RESPONSE');
});

test('direct HTTP helper refuses same-day before published daily update, without key read or network',async()=>{
 let requests=0;
 const mock=async()=>{requests++;return {ok:true,json:async()=>({data:[]})}};
 for(const now of [
   new Date('2026-10-30T00:05:00Z'),
   new Date('2026-10-30T07:00:00Z')
 ]){
   await assert.rejects(()=>fetchMinutePilotPages({
     code:'3753',date:'2026-10-30',maxPages:1,
     apiKey:'SECRET',fetchImpl:mock,now
   }),/MINUTE_PROBE_SCOPE/);
 }
 assert.equal(requests,0);
});

test('daily reconciliation is explicitly opt-in and doubles maximum request budget only when selected',()=>{
 assert.equal(plan().requestUpperLimit,4);
 assert.equal(plan().compareDaily,false);
 const x=plan({compareDaily:true,maxPages:2});
 assert.equal(x.compareDaily,true);
 assert.equal(x.requestUpperLimit,4);
 const args=parseMinuteProbeArgs([
  '--execute','--compare-daily','--code=3753',
  '--date=2026-10-30','--max-pages=3'
 ]);
 assert.equal(args.compareDaily,true);
 assert.equal(args.execute,true);
 assert.equal(args.maxPages,3);
});
test('same-date daily OHLCV requests use a separate endpoint and secure header',async()=>{
 let calls=0;
 const pages=await fetchDailyPilotPages({code:'3753',date:'2026-10-30',
  maxPages:2,apiKey:'SECRET',fetchImpl:async(url,opts)=>{
   calls++;
   assert.equal(url.toString().split('?')[0],DAILY_PROBE_ENDPOINT);
   assert.equal(url.searchParams.get('code'),'3753');
   assert.equal(url.searchParams.get('date'),'2026-10-30');
   assert.equal(opts.headers['x-api-key'],'SECRET');
   assert.equal(opts.redirect,'error');
   return {ok:true,json:async()=>({
    data:[{Code:'37530',Date:'2026-10-30',O:100,H:101,L:99,C:100,Vo:10}]
   })};
  }
 });
 assert.equal(calls,1);
 assert.equal(pages.length,1);
 assert.equal(JSON.stringify(pages).includes('SECRET'),false);
});
test('optional daily fetch cannot run a broader code/date or before publication',async()=>{
 let calls=0;
 const mock=async()=>{calls++;return {ok:true,json:async()=>({data:[]})}};
 for(const args of [
  {code:'37531',date:'2026-10-30',maxPages:2},
  {code:'3753',date:'2026-11-31',maxPages:2},
  {code:'3753',date:'2026-10-30',maxPages:5},
  {code:'3753',date:'2026-10-30',maxPages:1,now:new Date('2026-10-30T07:00:00Z')}
 ]){
   await assert.rejects(()=>fetchDailyPilotPages({
    ...args,apiKey:'SECRET',fetchImpl:mock
   }),/DAILY_PROBE_SCOPE/);
 }
 assert.equal(calls,0);
});
test('daily source can report no-trade without invented OHLCV',async()=>{
 const p=await fetchDailyPilotPages({code:'3753',date:'2026-10-30',
  maxPages:1,apiKey:'SECRET',fetchImpl:async()=>({
   ok:true,json:async()=>({data:[{
    Code:'37530',Date:'2026-10-30',O:null,H:null,L:null,C:null,Vo:null,
    AdjFactor:1,ExRT:null
   }]})
  })
 });
 assert.equal(p[0].response.data[0].C,null);
});
test('daily response for wrong class/code or wrong date fails without fetching continuation',async()=>{
 for(const row of [
  {Code:'37531',Date:'2026-10-30'},
  {Code:'99840',Date:'2026-10-30'},
  {Code:'37530',Date:'2026-10-29'}
 ]){
  let calls=0;
  await assert.rejects(()=>fetchDailyPilotPages({code:'3753',date:'2026-10-30',
   maxPages:3,apiKey:'SECRET',fetchImpl:async()=>{
    calls++;
    return {ok:true,json:async()=>({data:[row],pagination_key:'MORE'})};
   }
  }),/JQUANTS_DAILY_WRONG_CODE_OR_DATE/);
  assert.equal(calls,1);
 }
});
test('daily pages cannot contain more than four rows for one code and date',async()=>{
 let calls=0;
 const rows=Array.from({length:5},()=>({Code:'37530',Date:'2026-10-30'}));
 await assert.rejects(()=>fetchDailyPilotPages({
  code:'3753',date:'2026-10-30',maxPages:2,apiKey:'SECRET',
  fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({data:rows})}}
 }),/EXCESS_ONE_CODE_DATE_ROWS/);
 assert.equal(calls,1);
});
test('daily continuation token and page count remain bounded',async()=>{
 const tokens=[];
 const pages=await fetchDailyPilotPages({code:'3753',date:'2026-10-30',
  maxPages:2,apiKey:'SECRET',
  fetchImpl:async(url)=>{
   tokens.push(url.searchParams.get('pagination_key'));
   return {ok:true,json:async()=>({data:[],pagination_key:'NEXT'+tokens.length})};
  }
 });
 assert.deepEqual(tokens,[null,'NEXT1']);
 assert.equal(pages.length,2);
 assert.equal(pages[1].response.pagination_key,'NEXT2');
});
test('daily 403, 429, malformed JSON, and redirected secret-bearing errors are redacted',async()=>{
 for(const status of [403,429]){
  await assert.rejects(()=>fetchDailyPilotPages({
   code:'3753',date:'2026-10-30',maxPages:1,apiKey:'SECRET',
   fetchImpl:async()=>({ok:false,status,text:async()=> 'SECRET_FROM_VENDOR'})
  }),e=>e.message.includes(String(status))&&!e.message.includes('SECRET'));
 }
 await assert.rejects(()=>fetchDailyPilotPages({
  code:'3753',date:'2026-10-30',maxPages:1,apiKey:'SECRET',
  fetchImpl:async()=>({ok:true,json:async()=>{throw new Error('SECRET_JSON')}})
 }),/JQUANTS_DAILY_INVALID_JSON_RESPONSE/);
 await assert.rejects(()=>fetchDailyPilotPages({
  code:'3753',date:'2026-10-30',maxPages:1,apiKey:'SECRET',
  fetchImpl:async()=>{throw new Error('SECRET_REDIRECT')}
 }),e=>e.message==='JQUANTS_DAILY_NETWORK_TIMEOUT_OR_REDIRECT_BLOCKED');
});

const mockMinute=()=>({
 code:'3753',date:'2026-10-30',structuralPass:true,pageChainComplete:true,
 observedRawBars:75,errors:[],
 asOf905:{observedMinuteBars:4,openToClosePercent:-1.1},
 retrospective:{bottomMinute:'09:32',subsequent2PctReachedAt:'09:41',
  maximumReboundPercent:2.4}
});
const mockMatchingDaily=()=>({
 code:'3753',date:'2026-10-30',
 structuralOneCodeDayMatched:true,matchingNoTradeSession:false,
 blocked:false,blockers:[]
});
test('minute-only results never print unreconciled 09:05 or hindsight rebound metrics',()=>{
 const result=summarizeMinutePilotResult({minute:mockMinute(),compareDaily:false});
 assert.equal(result.status,'MINUTE_ONLY_UNRECONCILED');
 assert.equal(result.asOf905,null);
 assert.equal(result.retrospective,null);
 assert.equal(result.historicalQualityHold,true);
 assert.equal(result.metricsReleasedForHistoricalResearch,false);
 assert.equal(result.eligibleForNotifications,false);
});
test('real structural same-code/day matching releases only explicitly labeled historical metrics',()=>{
 const result=summarizeMinutePilotResult({
  minute:mockMinute(),reconciliation:mockMatchingDaily(),compareDaily:true
 });
 assert.equal(result.status,'HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH');
 assert.equal(result.historicalQualityHold,false);
 assert.equal(result.asOf905.openToClosePercent,-1.1);
 assert.equal(result.retrospective.bottomMinute,'09:32');
 assert.equal(result.historicalMetricsAreHindsightOnly,true);
 assert.equal(result.actual0905AvailabilityVerified,false);
 assert.equal(result.independentlyVerifiedTradingEdge,false);
 assert.equal(result.eligibleForProduction,false);
});
test('even apparently matching daily audit cannot override an incomplete minute pagination',()=>{
 const m=mockMinute();m.pageChainComplete=false;
 const result=summarizeMinutePilotResult({
  minute:m,reconciliation:mockMatchingDaily(),compareDaily:true
 });
 assert.equal(result.status,'PILOT_INCOMPLETE');
 assert.equal(result.asOf905,null);
 assert.equal(result.retrospective,null);
});
test('a daily OHLCV volume mismatch withholds the 1%-2% rebound claims',()=>{
 const d=mockMatchingDaily();
 d.structuralOneCodeDayMatched=false;d.blocked=true;
 d.blockers=['DAILY_MINUTE_VOLUME_MISMATCH'];
 const result=summarizeMinutePilotResult({
  minute:mockMinute(),reconciliation:d,compareDaily:true
 });
 assert.equal(result.status,'BLOCKED_DAILY_RECONCILIATION');
 assert.deepEqual(result.reconciliationBlockers,['DAILY_MINUTE_VOLUME_MISMATCH']);
 assert.equal(result.asOf905,null);
 assert.equal(result.retrospective,null);
});
test('a daily match from a DIFFERENT symbol or trade date cannot release the studied stock',()=>{
 for(const bad of [{code:'9984'},{date:'2026-10-29'}]){
  const result=summarizeMinutePilotResult({
   minute:mockMinute(),compareDaily:true,
   reconciliation:{...mockMatchingDaily(),...bad}
  });
  assert.equal(result.status,'BLOCKED_DAILY_RECONCILIATION');
  assert.equal(result.retrospective,null);
 }
});
test('claimed success with nonempty daily blockers or blocked flag is quarantined',()=>{
 for(const bad of [{blocked:true},{blockers:['CORPORATE_ACTION_UNRESOLVED']}]){
  const result=summarizeMinutePilotResult({
   minute:mockMinute(),compareDaily:true,
   reconciliation:{...mockMatchingDaily(),...bad}
  });
  assert.equal(result.historicalQualityHold,true);
  assert.equal(result.metricsReleasedForHistoricalResearch,false);
 }
});
test('a matched no-trade day is a no-signal observation, never a rebound outcome',()=>{
 const m=mockMinute();m.observedRawBars=0;m.asOf905=null;m.retrospective=null;
 const d={...mockMatchingDaily(),structuralOneCodeDayMatched:false,
  matchingNoTradeSession:true,blocked:true};
 const result=summarizeMinutePilotResult({minute:m,reconciliation:d,compareDaily:true});
 assert.equal(result.status,'MATCHED_NO_TRADE_NO_SIGNAL');
 assert.equal(result.asOf905,null);
 assert.equal(result.metricsReleasedForHistoricalResearch,false);
});
test('a missing daily audit and missing minute audit are explicitly blocked',()=>{
 const noDaily=summarizeMinutePilotResult({minute:mockMinute(),compareDaily:true});
 assert.equal(noDaily.status,'BLOCKED_DAILY_RECONCILIATION');
 assert.deepEqual(noDaily.reconciliationBlockers,['NO_VALID_DAILY_COMPARISON']);
 const missing=summarizeMinutePilotResult({compareDaily:true});
 assert.equal(missing.status,'PILOT_INCOMPLETE');
 assert.equal(missing.asOf905,null);
 assert.equal(missing.eligibleForProduction,false);
});
