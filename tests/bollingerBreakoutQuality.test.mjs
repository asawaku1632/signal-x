import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {validateCompletedArchive,studyCompletedArchiveStock,studyCompletedArchiveCohort} from '../app/lib/research/bollingerBreakoutQuality.mjs';
const DAY=86400;
const raw=()=>Array.from({length:116},(_,i)=>{
  const close=i<80?100+4*Math.sin(i*.73):i===110?105:100+.12*Math.sin(i*.7);
  const open=i===110?103:close;
  return {time:1700000000+i*DAY,open,high:Math.max(open,close)+1,
    low:Math.min(open,close)-.5,close,volume:i===110?1700:1000};
});
const dates=cs=>cs.map(c=>new Date(c.time*1000).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}));
const source=(code='9984')=>{
  const candles=raw();
  return {code,provider:'YAHOO_CHART',timeframe:'1D',
    candles,expectedTradingDates:dates(candles),asOfCompletedJstDate:dates(candles).at(-1),
    splitEvents:[]};
};
test('valid capped source with explicit completed dates',()=>{
  const q=validateCompletedArchive(source());
  assert.equal(q.ok,true);
  const a=studyCompletedArchiveStock(source());
  assert.ok(a.records.some(x=>x.signal.signalIndex===110&&x.signal.group==='SQUEEZE_UP_BREAKOUT'));
  assert.equal(a.records.find(x=>x.signal.signalIndex===110).horizons[5].status,'COMPLETE');
});
test('split inside baseline or future suppresses candidate, not labels losing',()=>{
  const s=source();
  const no=studyCompletedArchiveStock(s);
  const splitAt=s.candles[112].time;
  const yes=studyCompletedArchiveStock({...s,splitEvents:[splitAt]});
  assert.ok(no.records.some(r=>r.signal.signalIndex===110));
  assert.ok(!yes.records.some(r=>r.signal.signalIndex===110));
  assert.ok(yes.exclusions.SPLIT_AFFECTED>=1);
});
test('calendar-gap on dropped or duplicated date never remaps horizons',()=>{
  const s=source();
  const expected=[...s.expectedTradingDates];
  expected[50]='2099-01-01';
  assert.equal(validateCompletedArchive({...s,expectedTradingDates:expected}).ok,false);
  const d=[...s.expectedTradingDates];d[40]=d[39];
  assert.equal(validateCompletedArchive({...s,expectedTradingDates:d}).ok,false);
});
test('uncompleted current date fails closed',()=>{
  const s=source();
  assert.equal(validateCompletedArchive({...s,asOfCompletedJstDate:s.expectedTradingDates.at(-2)}).reason,
    'UNCOMPLETED_BAR_INCLUDED');
});
test('bad OHLC, unsorted or unverifiable corporate actions rejected',()=>{
  const s=source(),bad=s.candles.map(x=>({...x}));bad[10].low=200;
  assert.equal(validateCompletedArchive({...s,candles:bad}).reason,'INVALID_OHLC');
  assert.equal(validateCompletedArchive({...s,splitEvents:null}).reason,'SPLIT_EVENTS_UNCONFIRMED');
  assert.equal(validateCompletedArchive({...s,splitEvents:[0]}).reason,'SPLIT_EVENTS_UNCONFIRMED');
});
test('cohort quality errors reject whole study instead of filtering loser',()=>{
  const a=source('9984'),b=source('3762');
  const ok=studyCompletedArchiveCohort([a,b]);
  assert.equal(ok.status,'READY_FOR_SHADOW_COMPARISON');
  assert.equal(ok.summary.SQUEEZE_UP_BREAKOUT.horizons[1].positiveRate,null);
  const broken=studyCompletedArchiveCohort([a,{...b,provider:'UNKNOWN'}]);
  assert.equal(broken.status,'DATA_QUALITY_REJECTED');
  assert.equal(broken.summary,null);
});
test('duplicate stock and excess universe rejected',()=>{
  assert.throws(()=>studyCompletedArchiveCohort([source(),source()]),/DUPLICATE_STOCK/);
  assert.throws(()=>studyCompletedArchiveCohort(Array.from({length:6},(_,i)=>source(String(1000+i)))),/COHORT_SIZE_REJECTED/);
});
test('no data egress, sql, secret, polling or unsafe integrations',()=>{
  const code=readFileSync('app/lib/research/bollingerBreakoutQuality.mjs','utf8');
  assert.doesNotMatch(code,/\b(fetch|pool|postgres|process\.env|setInterval|setTimeout|supabase)\b|INSERT INTO|UPDATE public|DELETE FROM/i);
});
