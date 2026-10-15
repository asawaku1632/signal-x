import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
 FORWARD_VERSION,FORWARD_START,MAX_VENDOR_REQUESTS,
 validateFrozenUniverse,batchForMarketOrdinal,identifyTodayProspectiveSignal,
 gradeFrozenProspectiveSignal,snapshotHash
} from '../app/lib/research/bollingerForwardCore.mjs';
const CAL='TEST_VALID_JPX_CALENDAR';
const hour=Date.parse('2026-10-16T06:00:00Z')/1000;
const makeBars=(withFuture=0)=>{
 const data=Array.from({length:111+withFuture},(_,i)=>{
  const close=i<80?100+4*Math.sin(i*.73):i===110?105:100+.12*Math.sin(i*.7);
  const open=i===110?103:close;
  return {time:hour+(i-110)*86400,open,high:Math.max(open,close)+1,
   low:Math.min(open,close)-.5,close,volume:i===110?1700:1000};
 });
 return data;
};
const date=timestamp=>new Date(timestamp*1000).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
const fixture=(extra=0)=>{
 const candles=makeBars(extra);
 return {code:'9984',provider:'YAHOO_CHART',timeframe:'1D',
  candles,splitEvents:[],
  expectedTradingDates:candles.map(b=>date(b.time)),
  asOfCompletedJstDate:date(candles.at(-1).time)};
};
test('future study ships a literal frozen 100-code roster, not an imported mutable basket',()=>{
 const s=readFileSync('app/lib/research/bollingerForwardUniverse.ts','utf8');
 const runner=readFileSync('app/lib/research/bollingerForwardRunner.ts','utf8');
 const stockCodes=Array.from(s.matchAll(/'(\d{4})'/g),m=>m[1]);
 assert.equal(stockCodes.length,100);
 assert.equal(new Set(stockCodes).size,100);
 assert.equal(stockCodes[0],'9984');
 assert.equal(stockCodes[99],'6301');
 assert.match(runner,/import \{BB_FORWARD_FROZEN_CODES\}/);
 assert.doesNotMatch(runner,/import \{BB_EXPANSION_BATCHES\}/);
});
test('frozen prospective cohort contains 100 distinct four-digit codes and 20/day',()=>{
 const codes=Array.from({length:100},(_,i)=>String(1000+i));
 assert.equal(validateFrozenUniverse(codes),true);
 assert.equal(validateFrozenUniverse([...codes.slice(0,99),codes[0]]),false);
 for(let n=0;n<10;n++){
  const b=batchForMarketOrdinal(n,codes);
  assert.equal(b.batchId,n%5);
  assert.deepEqual(b.codes,codes.slice(n%5*20,n%5*20+20));
 }
 assert.equal(MAX_VENDOR_REQUESTS,30);
});
test('new future study can freeze only that day close, after prospective start',()=>{
 const x=fixture();
 const signal=identifyTodayProspectiveSignal(x,'2026-10-16',CAL);
 assert.ok(signal);
 assert.equal(signal.version,FORWARD_VERSION);
 assert.equal(signal.code,'9984');
 assert.equal(signal.signal_date,FORWARD_START);
 assert.match(signal.source_hash,/^[0-9a-f]{64}$/);
 assert.equal(signal.volume_bucket,'HIGH_1_3X');
 assert.throws(()=>identifyTodayProspectiveSignal(x,'2026-10-17',CAL),
  /NOT_A_FRESH_SIGNAL_DAY/);
 assert.throws(()=>identifyTodayProspectiveSignal(x,'2026-10-15',CAL),
  /NOT_A_FRESH_SIGNAL_DAY/);
});
test('no future bars influence frozen snapshot or candidate factors',()=>{
 const base=fixture();
 const sig=identifyTodayProspectiveSignal(base,'2026-10-16',CAL);
 const later=fixture(5);
 later.candles[115].volume=1000000;
 assert.equal(snapshotHash(later.candles,110,CAL),sig.source_hash);
 const s=identifyTodayProspectiveSignal({...later,
  candles:later.candles.slice(0,111),
  expectedTradingDates:later.expectedTradingDates.slice(0,111),
  asOfCompletedJstDate:'2026-10-16'},'2026-10-16',CAL);
 assert.deepEqual(s,sig);
});
test('frozen grades appear only on matured session and always enter NEXT open',()=>{
 const signal=identifyTodayProspectiveSignal(fixture(),'2026-10-16',CAL);
 const partial=fixture(1);
 const one=gradeFrozenProspectiveSignal(signal,partial,date(partial.candles.at(-1).time));
 assert.deepEqual(one.map(x=>x.horizon),[1]);
 assert.equal(one[0].entry_time,partial.candles[111].time);
 assert.equal(one[0].entry_price,Number(partial.candles[111].open.toFixed(6)));
 const full=fixture(5);
 const grades=gradeFrozenProspectiveSignal(signal,full,date(full.candles.at(-1).time));
 assert.deepEqual(grades.map(x=>x.horizon),[1,3,5]);
});
test('source revision is rejected, never rewritten or retroactively backfilled',()=>{
 const sig=identifyTodayProspectiveSignal(fixture(),'2026-10-16',CAL);
 const later=fixture(5);
 later.candles[110].close+=.1;
 later.candles[110].high+=.1;
 assert.throws(()=>gradeFrozenProspectiveSignal(sig,later,date(later.candles.at(-1).time)),
  /FROZEN_SOURCE_REVISED/);
});
test('split within outcome horizon is EXCLUDED rather than counted as a loss',()=>{
 const sig=identifyTodayProspectiveSignal(fixture(),'2026-10-16',CAL);
 const after=fixture(5);
 after.splitEvents=[after.candles[113].time];
 const graded=gradeFrozenProspectiveSignal(sig,after,date(after.candles.at(-1).time));
 assert.deepEqual(graded.map(x=>x.status),['COMPLETE','EXCLUDED_SPLIT','EXCLUDED_SPLIT']);
 assert.equal(graded[1].return_percent,null);
});
test('gated cron and isolated DB write perimeter',()=>{
 const cron=readFileSync('app/api/cron/bb-forward-research/route.ts','utf8');
 const runner=readFileSync('app/lib/research/bollingerForwardRunner.ts','utf8');
 const migration=readFileSync('supabase/migrations/20261015_bb_forward_prospective_gated.sql','utf8');
 const vercel=JSON.parse(readFileSync('vercel.json','utf8'));
 const owner=readFileSync('app/api/admin/bollinger-breakout-shadow/forward/route.ts','utf8');
 assert.match(cron,/process\.env\.CRON_SECRET/);
 assert.match(owner,/getLearningOwnerSession/);
 assert.match(runner,/OWNER_OPT_IN_DISABLED/);
 assert.match(runner,/ON CONFLICT\(trade_date,batch_id\) DO NOTHING/);
 assert.match(runner,/MAX_VENDOR_REQUESTS/);
 assert.match(runner,/nextTradeDate\(now\)/);
 assert.match(runner,/i\+=3/);
 assert.match(migration,/enabled boolean NOT NULL DEFAULT false/);
 assert.match(migration,/PRIMARY KEY\(version,code,signal_time,horizon\)/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/g);
 assert.doesNotMatch(migration,/ALTER TABLE public\.bb_breakout_shadow_outcomes|ALTER TABLE public\.bb_breakout_expansion_outcomes|DELETE FROM|TRUNCATE/i);
 assert.doesNotMatch(runner,/sendNotification|executeTrade|setInterval|runDailyScan/);
 assert.equal(vercel.crons.filter(c=>c.path==='/api/cron/bb-forward-research').length,1);
});
