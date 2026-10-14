import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {inspectAsOf,gradeForward,summarize} from '../app/lib/research/bollingerBreakoutShadow.mjs';
const bar=(i,close)=>({time:1700000000+i*86400,open:close,high:close+.5,low:close-.5,close,volume:1000});
const baseline=()=>Array.from({length:111},(_,i)=>bar(i,i<80?100+4*Math.sin(i*.73):100+.12*Math.sin(i*.7)));
const candidate=()=>{const a=baseline();a[110]={...a[110],open:103,close:105,high:106,low:102.8,volume:1700};return a;};
const append=(a,open,close)=>[...a,{time:a.at(-1).time+86400,open,close,high:Math.max(open,close)+1,low:Math.min(open,close)-1,volume:1100}];

test('prior-day squeeze and upper breakout with volume',()=>{
  const s=inspectAsOf(candidate());
  assert.equal(s.eligible,true);
  assert.equal(s.group,'SQUEEZE_UP_BREAKOUT');
  assert.equal(s.volumeConfirmed,true);
  assert.ok(s.widthAtPriorClose<=s.reference25th);
});
test('future data cannot change as-of signal',()=>{
  const b=candidate(),f=append(b,150,90);
  assert.deepEqual(inspectAsOf(b,110),inspectAsOf(f,110));
});
test('future entry is next OPEN, never unavailable same-day close',()=>{
  let a=append(candidate(),120,121);
  for(let i=0;i<4;i++)a=append(a,121+i,122+i);
  const r=gradeForward(a,110,'9984');
  assert.equal(r.horizons[1].entryPrice,120);
  assert.ok(Math.abs(r.horizons[1].returnPercent-100*(121/120-1))<1e-8);
  assert.equal(r.horizons[5].status,'COMPLETE');
});
test('missing future remains PENDING; post-breakout return inside cannot leak',()=>{
  const r=gradeForward(candidate(),110,'9984');
  assert.equal(r.horizons[1].status,'PENDING');
  assert.equal(r.horizons[5].status,'PENDING');
  assert.equal(r.nextDayReturnInside,null);
  assert.equal(gradeForward(append(candidate(),103,99),110,'9984').nextDayReturnInside,true);
});
test('invalid history / future must fail closed',()=>{
  assert.equal(inspectAsOf(candidate().slice(0,60)).reason,'INSUFFICIENT_HISTORY');
  const b=candidate(); b[45]={...b[45],low:200};
  assert.equal(inspectAsOf(b).reason,'INVALID_HISTORY');
  const c=append(candidate(),120,121);c.at(-1).time=c.at(-2).time;
  assert.equal(gradeForward(c,110,'9984').horizons[1].status,'INVALID_FUTURE');
});
test('small sample never emits empirical win rate',()=>{
  const r=gradeForward(append(candidate(),100,101),110,'9984');
  const s=summarize([r]);
  assert.equal(s.SQUEEZE_UP_BREAKOUT.eventCount,1);
  assert.equal(s.SQUEEZE_UP_BREAKOUT.horizons[1].positiveRate,null);
  assert.equal(s.SQUEEZE_UP_BREAKOUT.horizons[1].status,'INSUFFICIENT_SAMPLE');
});
test('pure module has no production integrations',()=>{
  const src=readFileSync('app/lib/research/bollingerBreakoutShadow.mjs','utf8');
  assert.doesNotMatch(src,/\b(import|fetch|pool|postgres|process\.env|setInterval)\b|INSERT INTO|UPDATE public/i);
});
test('duplicate same-stock-date signals cannot inflate sample size',()=>{
  const r=gradeForward(append(candidate(),100,101),110,'9984');
  assert.throws(()=>summarize([r,r]),/DUPLICATE_SIGNAL/);
  assert.throws(()=>summarize([{...r,code:null}]),/MISSING_STOCK_CODE/);
});
