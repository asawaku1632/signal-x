import test from 'node:test';
import assert from 'node:assert/strict';
import {planSingleCodeMinuteProbe,parseMinuteProbeArgs,fetchMinutePilotPages,MINUTE_PROBE_ENDPOINT}
 from '../scripts/research/jquants-minute-pilot.mjs';
const freeze={codes:['3753','9984']};
const now=new Date('2026-11-01T12:00:00Z');
const plan=(opt={})=>planSingleCodeMinuteProbe(freeze,{
 code:opt.code??'3753',date:opt.date??'2026-10-30',
 execute:opt.execute??false,enabled:opt.enabled??false,
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
