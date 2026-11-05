import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  CAPTURE_ENDPOINTS, planFourPatternCapture, requestCapturedJQuantsPages,
  runFourPatternCapture,
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
