import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMa75BulkArgs,validateMa75OriginalTseCalendar,
 runMa75BulkResearch} from '../scripts/research/ma75-jquants-bulk-retrospective.mjs';
const from='2026-05-01',to='2026-10-30';
const argv=['--from='+from,'--to='+to];
test('default is zero network calls and zero credential dependency',async()=>{
 let n=0;
 const r=await runMa75BulkResearch(argv,{
  env:{},clock:()=>new Date('2026-11-01T00:00:00Z'),
  fetchImpl:async()=>{n++;throw new Error('unexpected')}
 });
 assert.equal(r.status,'DRY_RUN');
 assert.equal(n,0);
 assert.equal(r.eligibleForProduction,false);
});
test('explicit execution also requires private approved key, no probing without it',async()=>{
 let n=0;
 await assert.rejects(()=>runMa75BulkResearch([...argv,'--execute'],{
  clock:()=>new Date('2026-11-01T00:00:00Z'),
  env:{JQUANTS_API_KEY:'mock'},
  fetchImpl:async()=>{n++;throw new Error('unexpected')}
 }),/EXPLICIT_CONSENT/);
 assert.equal(n,0);
});
test('invalid historical range, duplicate execute, unknown flags are rejected',()=>{
 for(const bad of [
  ['--from=2026-05-01','--to=2026-04-01'],
  ['--from=2026-11-31','--to=2026-12-01'],
  [...argv,'--price-plan=PLUS'],
  [...argv,'--execute','--execute'],
  ['--from=2025-01-01','--to=2026-10-30'],
  [...argv,'--to=2026-10-30']
 ])assert.throws(()=>parseMa75BulkArgs(bad),TypeError);
});
test('real-date calendar must cover weekends and holidays, not just winning dates',()=>{
 const data=[];
 for(let t=Date.parse(from+'T00:00:00Z');t<=Date.parse(to+'T00:00:00Z');t+=86400000){
  const date=new Date(t).toISOString().slice(0,10);
  const dow=new Date(t).getUTCDay();
  data.push({Date:date,HolDiv:dow===0||dow===6?'0':'1'});
 }
 const dates=validateMa75OriginalTseCalendar(data,from,to);
 assert.equal(dates.length,130);
 assert.equal(dates.at(-1),to);
 assert.throws(()=>validateMa75OriginalTseCalendar(data.slice(1),from,to),/MISSING/);
 const dup=[...data,{...data[1]}];
 assert.throws(()=>validateMa75OriginalTseCalendar(dup,from,to),/DUPLICATE/);
});
test('even mock provider JSON cannot be obtained without explicit execution',async()=>{
 let called=0;
 const run=await runMa75BulkResearch(argv,{
  clock:()=>new Date('2026-11-01T00:00:00Z'),
  fetchImpl:async()=>{called++;return {ok:true,json:async()=>({data:[]})}},
  readFreeze:()=>{throw Error('never read')}
 });
 assert.equal(run.networkRequests,0);
 assert.equal(called,0);
});
