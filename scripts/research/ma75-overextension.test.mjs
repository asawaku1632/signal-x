import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMa75Overextension} from './ma75-overextension.mjs';
const sample=[{date:'2026-10-27',close:3715,prior75Sma:2433.533333},{date:'2026-10-28',close:3565,prior75Sma:2458.573333},{date:'2026-10-29',close:3385,prior75Sma:2481.053333},{date:'2026-10-30',close:3320,prior75Sma:2501.186667}];
test('observed drawdown is not misrepresented as a trade',()=>{
 const r=analyzeMa75Overextension(sample);
 assert.equal(r.firstObservedDrawdownDate,'2026-10-29');
 assert.equal(r.points.at(-1).observedWindowDrawdownPercent,-10.6326);
 assert.equal(r.verifiedTradingEdge,false);
});
test('threshold counts are days not independent events',()=>{
 const r=analyzeMa75Overextension(sample);
 assert.equal(r.thresholdDayCounts['30'],4);
 assert.equal(r.independentEventCountNotEstablished,true);
});
test('first point has no previous day change',()=>{
 const r=analyzeMa75Overextension(sample);
 assert.equal(r.points[0].priorCloseChangePercent,null);
});
test('rejects invalid ordering and parameters',()=>{
 assert.throws(()=>analyzeMa75Overextension([...sample].reverse()));
 assert.throws(()=>analyzeMa75Overextension(sample,{thresholds:[-1]}));
 assert.throws(()=>analyzeMa75Overextension([...sample,sample[0]]));
});
