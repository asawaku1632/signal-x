import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  CAPTURE_ENDPOINTS, planFourPatternCapture, requestCapturedJQuantsPages,
  runFourPatternCapture,validateCapturedFourPatternDay,
  validateCapturedFourPatternFinancials,safeCaptureFailure,
} from '../scripts/research/capture-four-pattern-jquants.mjs';
import {summarizeFourPatternJQuantsArchive} from '../scripts/research/run-four-patterns-jquants-bundle.mjs';

const now=new Date('2026-11-05T08:00:00Z');
const date='2026-10-30';
test('explicit sorted date bounds, 20 days maximum and dry-run request budget', () => {
 const args=['--code=7203','--dates=2026-10-29,2026-10-30'];
 const plan=planFourPatternCapture(args,now);
 assert.equal(plan.mode,'DRY_RUN_ZERO_API');
 assert.equal(plan.maxRequests,24);
 assert.equal(plan.code,'7203');
 assert.equal(plan.dates.length,2);
 assert.throws(()=>planFourPatternCapture(
  ['--code=7203','--dates=2026-10-30,2026-10-29'],now),/REQUIRE_CODE/);
 assert.throws(()=>planFourPatternCapture(
  ['--code=7203','--dates=2026-10-30','--execute','--execute'],now),/DUPLICATE/);
 assert.throws(()=>planFourPatternCapture(
  ['--code=7203','--dates=2026-11-06'],now),/REQUIRE_CODE/);
});
test('dry run does not fetch, require a key, or write a local file', async () => {
 let calls=0;
 const out=await runFourPatternCapture([
  '--code=7203','--dates=2026-10-30'
 ],{now,fetchImpl:async()=>{calls++;throw Error('SHOULD_NOT_FETCH')}});
 assert.equal(out.mode,'DRY_RUN_ZERO_API');
 assert.equal(calls,0);
});
test('only official HTTPS endpoints get secret header, pagination validated', async () => {
 let count=0;
 const pages=await requestCapturedJQuantsPages({
  type:'minute',code:'7203',date,maxPages:2,apiKey:'private-secret',
  fetchImpl:async(url,opts)=>{
   count++;
   assert.equal(url.origin,'https://api.jquants.com');
   assert.equal(url.pathname,'/v2/equities/bars/minute');
   assert.equal(opts.headers['x-api-key'],'private-secret');
   assert.equal(opts.redirect,'error');
   assert.equal(opts.credentials,'omit');
   return {ok:true,json:async()=>({
    data:[{Date:date,Code:'72030'}],
    ...(count===1?{pagination_key:'another-page'}:{}),
   })};
  },
 });
 assert.equal(count,2);
 assert.equal(pages[0].requestPaginationKey,null);
 assert.equal(pages[1].requestPaginationKey,'another-page');
 assert.equal(pages.length,2);
});
test('wrong provider code and uncompleted pagination fail before report', async () => {
 await assert.rejects(()=>requestCapturedJQuantsPages({
  type:'daily',code:'7203',date,maxPages:1,apiKey:'key',
  fetchImpl:async()=>({ok:true,json:async()=>({
   data:[{Date:date,Code:'99840'}],
  })}),
 }),/WRONG_CODE_OR_DATE/);
 await assert.rejects(()=>requestCapturedJQuantsPages({
  type:'minute',code:'7203',date,maxPages:1,apiKey:'key',
  fetchImpl:async()=>({ok:true,json:async()=>({
   data:[{Date:date,Code:'72030'}],pagination_key:'next',
  })}),
 }),/INCOMPLETE_PAGINATION/);
});
test('finance endpoint requires undated query; no credential leakage through errors', async () => {
 assert.ok(CAPTURE_ENDPOINTS.financial.endsWith('/fins/summary'));
 await assert.rejects(()=>requestCapturedJQuantsPages({
  type:'financial',code:'7203',date,maxPages:2,apiKey:'secret',
 }),/INVALID_BOUND_JQUANTS_REQUEST/);
 await assert.rejects(()=>requestCapturedJQuantsPages({
  type:'financial',code:'7203',maxPages:1,apiKey:'secret',
  fetchImpl:async()=>({ok:false,status:403}),
 }),e=>e.message==='JQUANTS_SUBSCRIPTION_OR_PERMISSION_403'&&!e.message.includes('secret'));
});
test('reports give no false win rate when missing history', () => {
 const summary=summarizeFourPatternJQuantsArchive({
  code:'7203',minuteDays:[],dailyDays:[],
 });
 assert.match(summary.status,/^BLOCKED_/);
 assert.equal(summary.eligibleForNotifications,false);
});
test('capture script files are isolated from cron and AI POWER, and data directory ignored', () => {
 const source=readFileSync(new URL('../scripts/research/capture-four-pattern-jquants.mjs',import.meta.url),'utf8');
 const ignore=readFileSync(new URL('../.gitignore',import.meta.url),'utf8');
 assert.match(ignore,/\/\.private-research\//);
 assert.doesNotMatch(source,/\b(?:INSERT|UPDATE|DELETE)\b|sendLine|calculateAiScore|setInterval|next\/server/);
 assert.match(source,/writeFileSync\(path,JSON\.stringify\(archive\),\{flag:'wx',mode:0o600\}\)/);
});


function minimalDayFixture() {
 const pg=data=>[{requestPaginationKey:null,
  receivedAt:'2026-11-05T08:00:00Z',response:{data}}];
 const minute=[
  {Date:date,Time:'09:00',Code:'72030',O:100,H:101,L:99,C:100,Vo:100,Va:10000},
  {Date:date,Time:'15:30',Code:'72030',O:102,H:102,L:102,C:102,Vo:100,Va:10200},
 ];
 const daily=[{Date:date,Code:'72030',O:100,H:102,L:99,C:102,Vo:200,AdjFactor:1,ExRT:null}];
 return {code:'7203',date,minutePages:pg(minute),dailyPages:pg(daily)};
}
test('validated capture day retains original matched rows and no extra market fetch', () => {
 const f=minimalDayFixture();
 const result=validateCapturedFourPatternDay(f);
 assert.deepEqual(result,{status:'MINUTE_DAILY_RECONCILED',date,observedMinuteBars:2});
});
test('invalid minute/daily data emits safe stage, requested day and named reason', () => {
 const f=minimalDayFixture();
 f.dailyPages[0].response.data[0].Vo=500;
 assert.throws(()=>validateCapturedFourPatternDay(f),error=>
   error?.stage==='MINUTE_DAILY'&&error.tradeDate===date&&
   error.message==='UNADJUSTED_MINUTE_DAILY_MISMATCH');
 const secret='private-test-secret';
 const safe=safeCaptureFailure(Error('bad '+secret+' in raw upstream body'),{
   stage:'MINUTE_DAILY',date});
 assert.equal(safe.message,'UNKNOWN_VALIDATION_FAILURE');
 assert.equal(safe.tradeDate,date);
 assert.equal(JSON.stringify({reason:safe.message,stage:safe.stage})
  .includes(secret),false);
});
test('financial schema fail reports only safe FINANCIAL stage without provider values', () => {
 const f=[{requestPaginationKey:null,receivedAt:'2026-11-05T08:00:00Z',
  response:{data:[{Code:'72030',DiscNo:'999',DiscDate:'invalid',DiscTime:''}]}}];
 assert.throws(()=>validateCapturedFourPatternFinancials({
  code:'7203',financialPages:f}),e=>e.stage==='FINANCIAL'&&
  e.tradeDate===null&&e.message==='INVALID_DISCLOSURE_METADATA');
});
test('on first mismatching date the capture stops before additional dates/financial calls',async () => {
 const originalKey=process.env.JQUANTS_API_KEY;
 const originalFlag=process.env.JQUANTS_RESEARCH_PROBE_ENABLED;
 process.env.JQUANTS_API_KEY='unit-test-only';
 process.env.JQUANTS_RESEARCH_PROBE_ENABLED='true';
 const f=minimalDayFixture();
 f.dailyPages[0].response.data[0].Vo=600;
 let calls=0;
 const fetchImpl=async url=>{
  calls++;
  const data=url.pathname.endsWith('/minute')?
   f.minutePages[0].response.data:f.dailyPages[0].response.data;
  return {ok:true,json:async()=>({data})};
 };
 try {
  await assert.rejects(()=>runFourPatternCapture(
   ['--code=7203','--dates=2026-10-30,2026-11-04','--execute','--skip-financial'],
   {now:new Date('2026-11-05T08:00:00Z'),fetchImpl}),
   e=>e.stage==='MINUTE_DAILY'&&e.tradeDate==='2026-10-30'&&
     e.message==='UNADJUSTED_MINUTE_DAILY_MISMATCH');
  assert.equal(calls,2);
 } finally {
  if(originalKey===undefined)delete process.env.JQUANTS_API_KEY;
  else process.env.JQUANTS_API_KEY=originalKey;
  if(originalFlag===undefined)delete process.env.JQUANTS_RESEARCH_PROBE_ENABLED;
  else process.env.JQUANTS_RESEARCH_PROBE_ENABLED=originalFlag;
 }
});
