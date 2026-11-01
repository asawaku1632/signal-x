import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyMa75DailyEvents} from './ma75-daily-events.mjs';
const rows=(prices)=>prices.map((close,i)=>({date:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),close}));
test('75-day warmup and no premature crossover',()=>{
 const r=classifyMa75DailyEvents(rows([...Array(75).fill(100),101]));
 assert.equal(r.days,1);assert.deepEqual(r.breakoutDates,[]);assert.equal(r.events[0].priorDaySmaAvailable,false);
});
test('detects only confirmed prior-day below to current above',()=>{
 const r=classifyMa75DailyEvents(rows([...Array(75).fill(100),99,103]));
 assert.equal(r.days,2);assert.deepEqual(r.breakoutDates,[r.events[1].date]);
});
test('rebound requires prior near and rising close',()=>{
 const r=classifyMa75DailyEvents(rows([...Array(75).fill(100),101,102]));
 assert.equal(r.events[1].reboundAfterPriorNear,true);
});
test('blocks duplicate, out-of-order and invalid prices',()=>{
 assert.throws(()=>classifyMa75DailyEvents([{date:'2026-01-01',close:1},{date:'2026-01-01',close:2}]));
 assert.throws(()=>classifyMa75DailyEvents([{date:'2026-01-02',close:1},{date:'2026-01-01',close:2}]));
 assert.throws(()=>classifyMa75DailyEvents([{date:'2026-01-01',close:0}]));
});
