import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchMinutePilotPages,fetchDailyPilotPages,planSingleCodeMinuteProbe} from '../scripts/research/jquants-minute-pilot.mjs';

const date='2026-10-30';
const now=new Date('2026-11-01T00:00:00Z');
const opts={code:'3762',date,maxPages:1,apiKey:'test-key-not-real',now};
test('minute HTTP helper rejects unsafe scope before invoking fetch',async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;throw Error('must not run')};
 for(const change of [{code:'../etc/passwd'},{date:'2026-11-03'},{maxPages:5},{apiKey:''}]){
   await assert.rejects(fetchMinutePilotPages({...opts,...change,fetchImpl}));
 }
 assert.equal(calls,0);
});
test('minute HTTP request is bounded, uses key header and no credentials',async()=>{
 let calls=0;
 const fetchImpl=async(url,init)=>{
   calls++;
   assert.equal(url.origin,'https://api.jquants.com');
   assert.equal(url.pathname,'/v2/equities/bars/minute');
   assert.equal(url.searchParams.get('code'),'3762');
   assert.equal(url.searchParams.get('date'),date);
   assert.equal(init.headers['x-api-key'],'test-key-not-real');
   assert.equal(init.credentials,'omit');
   assert.equal(init.redirect,'error');
   return {ok:true,json:async()=>({data:[{Code:'37620',Date:date}],pagination_key:null})};
 };
 const pages=await fetchMinutePilotPages({...opts,fetchImpl});
 assert.equal(calls,1);
 assert.equal(pages.length,1);
});
test('minute response rejects wrong symbol/date and excess bars',async()=>{
 for(const data of [[{Code:'99840',Date:date}],Array.from({length:328},()=>({Code:'37620',Date:date}))]){
   await assert.rejects(fetchMinutePilotPages({...opts,fetchImpl:async()=>({ok:true,json:async()=>({data})})}));
 }
});
test('minute pagination stops at cap and leaves incomplete chain for audit',async()=>{
 let calls=0;
 const pages=await fetchMinutePilotPages({...opts,maxPages:1,fetchImpl:async()=>{
   calls++;return {ok:true,json:async()=>({data:[],pagination_key:'next-page'})};
 }});
 assert.equal(calls,1);
 assert.equal(pages[0].response.pagination_key,'next-page');
});
test('daily endpoint rejects wrong date before fetch',async()=>{
 let calls=0;
 await assert.rejects(fetchDailyPilotPages({...opts,date:'2026-11-03',fetchImpl:async()=>{calls++;}}));
 assert.equal(calls,0);
});
test('plan defaults to dry-run without execute and explicit enable',()=>{
 const freeze={codes:['3762']};
 const plan=planSingleCodeMinuteProbe(freeze,{code:'3762',date,now});
 assert.equal(plan.callAuthorizedByScript,false);
 assert.equal(plan.requestUpperLimit,4);
 assert.equal(plan.safeForProduction,false);
});

test('minute repeated pagination token is rejected without extra requests',async()=>{
 let calls=0;
 const fetchImpl=async()=>{
   calls++;
   return {ok:true,json:async()=>({data:[],pagination_key:'same-token'})};
 };
 await assert.rejects(
   fetchMinutePilotPages({...opts,maxPages:3,fetchImpl}),
   /JQUANTS_REPEATED_OR_INVALID_PAGINATION_KEY/
 );
 assert.equal(calls,2);
});
test('minute network exceptions do not expose upstream secret text',async()=>{
 await assert.rejects(
   fetchMinutePilotPages({...opts,fetchImpl:async()=>{throw new Error('SECRET-DO-NOT-LOG')}}),
   error=>error.message==='JQUANTS_NETWORK_TIMEOUT_OR_REDIRECT_BLOCKED'
 );
});
test('minute HTTP permission and rate limit are handled separately',async()=>{
 for(const [status,expected] of [[403,'JQUANTS_403_KEY_OR_PERMISSION_UNVERIFIED'],[429,'JQUANTS_429_RATE_LIMIT']]){
   await assert.rejects(
     fetchMinutePilotPages({...opts,fetchImpl:async()=>({ok:false,status})}),
     error=>error.message===expected
   );
 }
});
test('daily endpoint requires secure API key and never fetches without one',async()=>{
 let calls=0;
 await assert.rejects(fetchDailyPilotPages({...opts,apiKey:'',fetchImpl:async()=>{calls++}}),/API_KEY_MISSING/);
 assert.equal(calls,0);
});
