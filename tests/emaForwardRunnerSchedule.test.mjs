import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const runner=readFileSync("signalx-notification-runner/api/run.js","utf8");
const config=JSON.parse(readFileSync("signalx-notification-runner/vercel.json","utf8"));
const forward=config.crons.filter(x=>x.path==="/api/run?job=ema-forward-shadow");

test("forward study is scheduled twice on weekdays at 17:10 and 18:10 JST",()=>{
 assert.equal(forward.length,2);
 assert.deepEqual(forward.map(x=>x.schedule).sort(),["10 8 * * 1-5","10 9 * * 1-5"]);
});

test("all 10 existing notification schedules stay untouched",()=>{
 const existing=config.crons.filter(x=>x.path!=="/api/run?job=ema-forward-shadow");
 assert.equal(existing.length,10);
 const paths=existing.map(x=>x.path);
 for(const job of ["prime-signal","favorite-ai-monitor","favorite-ai-check",
  "golden-zone-0915","golden-zone-0930","golden-zone-1030",
  "golden-zone-1240","golden-zone-1300","golden-zone-1430","golden-zone-1515"]){
  assert.equal(paths.filter(p=>p==="/api/run?job="+job).length,1,job);
 }
});

test("runner forwards only the approved named job to production, with auth",()=>{
 assert.match(runner,/"ema-forward-shadow": "\/api\/cron\/ema-forward-shadow"/);
 assert.match(runner,/const TARGET = "https:\/\/signal-x-ppjg\.vercel\.app"/);
 assert.match(runner,/authorization: \x60Bearer \x24\{runnerSecret\}\x60/);
 assert.match(runner,/req\.headers\.authorization/);
 assert.match(runner,/Unknown notification job/);
});
