import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeMa75MorningWeakness} from './ma75-morning-weakness.mjs';
const make=(date,close,down)=>({date,close,distancePercent:40,minuteStatus:'HISTORICAL_METRICS_ONLY',post905:{downsidePercent:down,upsidePercent:1}});
test('filters by morning downside and joins next observed close without claiming calendar validation',()=>{
 const r=analyzeMa75MorningWeakness([make('2026-10-28',3565,-.2),make('2026-10-29',3385,-2.7),make('2026-10-30',3320,-1.17)]);
 assert.equal(r.candidateDays,2);assert.equal(r.observedNextCloseDays,1);
 assert.equal(r.events[0].nextClosePercent,-1.9202);
 assert.equal(r.events[1].nextClosePercent,null);
 assert.equal(r.events[0].nextSessionIsConsecutiveInValidatedTradingCalendar,false);
});
test('unverified morning metrics cannot enter candidate set',()=>{
 const row={...make('2026-10-29',3385,-3),minuteStatus:'MISSING_905_METRIC'};
 assert.equal(analyzeMa75MorningWeakness([row]).candidateDays,0);
});
test('no fabricated outcomes for terminal observation',()=>{
 const r=analyzeMa75MorningWeakness([make('2026-10-30',3320,-2)]);
 assert.equal(r.averageNextClosePercent,null);assert.equal(r.verifiedTradingEdge,false);
});
test('rejects reversed dates and invalid parameters',()=>{
 assert.throws(()=>analyzeMa75MorningWeakness([make('2026-10-30',3320,-2),make('2026-10-29',3385,-2)]));
 assert.throws(()=>analyzeMa75MorningWeakness([],{minMorningDrop:-1}));
});
