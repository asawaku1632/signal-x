import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {VERSION,gradeForward} from '../app/lib/research/bollingerBreakoutShadow.mjs';
import {inspectAsOfFactors,matchSavedAsOfFactors} from '../app/lib/research/bollingerAsOfFactorCore.mjs';
const stamp=x=>new Date(x*1000).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
const CAL='JPX_FROZEN_TEST_VERSION';
const bars=()=>Array.from({length:116},(_,i)=>{
 const close=i<80?100+4*Math.sin(i*.73):i===110?105:100+.12*Math.sin(i*.7);
 const open=i===110?103:close;
 return {time:1700000000+i*86400,open,close,high:Math.max(open,close)+1,
  low:Math.min(open,close)-.5,volume:i===110?1700:1000};
});
const input=()=>{const candles=bars();return {code:'9984',provider:'YAHOO_CHART',
 timeframe:'1D',candles,splitEvents:[],
 expectedTradingDates:candles.map(x=>stamp(x.time)),
 asOfCompletedJstDate:stamp(candles.at(-1).time)};};
const archive=a=>{
 const t=110,rec=gradeForward(a.candles,t,'9984');
 assert.equal(rec.signal.breakout,true);
 const hash=createHash('sha256').update(JSON.stringify({
  version:VERSION,calendar:CAL,code:'9984',
  history:a.candles.slice(t-80,t+1),future:a.candles.slice(t+1,t+2)
 })).digest('hex');
 return {code:'9984',signal_time:String(a.candles[t].time),detector_version:VERSION,
  horizon:1,group_key:rec.signal.group,
  signal_close:String(rec.signal.signalClose),source_hash:hash};
};
test('RSI, trend and band distance use only completed signal-time bars',()=>{
 const a=bars(),b=structuredClone(a);
 for(let i=111;i<116;i++)b[i]={...b[i],open:200,close:200,high:202,low:198};
 assert.deepEqual(inspectAsOfFactors(a,110),inspectAsOfFactors(b,110));
});
test('signal-day RSI and band breakout categories have valid numeric ranges',()=>{
 const a=bars(),f=inspectAsOfFactors(a,110);
 assert.ok(f.rsi14>=0&&f.rsi14<=100);
 assert.ok(Number.isFinite(f.trend10Percent));
 assert.ok(f.breakoutStrengthPercent>0);
 assert.match(f.rsiGroup,/^RSI_/);
 assert.match(f.trendGroup,/^TREND_/);
 assert.match(f.breakoutGroup,/^BREAKOUT_/);
});
test('source-verification allows only a frozen archive match',()=>{
 const a=input();
 const result=matchSavedAsOfFactors([a,{...a,code:'3762'},{...a,code:'7203'},
  {...a,code:'8035'},{...a,code:'8306'}],[archive(a)],CAL);
 assert.equal(result.length,1);
 assert.equal(result[0].code,'9984');
 assert.ok(result[0].original_source_hash.length===64);
});
test('source split, bad source, duplicated rows and source revisions fail closed',()=>{
 const a=input(),row=archive(a);
 assert.throws(()=>matchSavedAsOfFactors([a,a,a,a,a],[row],CAL),/DUPLICATE_CODE/);
 assert.throws(()=>matchSavedAsOfFactors([a,{...a,code:'3762'},{...a,code:'7203'},
  {...a,code:'8035'},{...a,code:'8306'}],[row,row],CAL),/ARCHIVE_DUPLICATED/);
 const x=structuredClone(a);x.candles[110].close+=0.2;
 assert.throws(()=>matchSavedAsOfFactors([x,{...a,code:'3762'},{...a,code:'7203'},
  {...a,code:'8035'},{...a,code:'8306'}],[row],CAL),/SOURCE_HASH_REVISED/);
});
test('factor migration cannot change frozen original rows',()=>{
 const sql=readFileSync('supabase/migrations/20261015_bb_asof_factor_research.sql','utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.bb_asof_factors/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/PRIMARY KEY\(detector_version,code,signal_time\)/);
 assert.doesNotMatch(sql,/ALTER TABLE public\.bb_breakout_shadow_outcomes|ALTER TABLE public\.bb_breakout_expansion_outcomes|TRUNCATE|DROP TABLE/i);
});
test('owner-only, strictly five stock requests with no Cron or trade mutations',()=>{
 const runner=readFileSync('app/lib/research/bollingerAsOfFactorRunner.ts','utf8');
 const api=readFileSync('app/api/admin/bollinger-breakout-shadow/factors/route.ts','utf8');
 assert.match(api,/getLearningOwnerSession/);
 assert.match(runner,/for\(let i=0;i<codes.length;i\+=2\)/);
 assert.match(runner,/ON CONFLICT\(batch_id,target_date\) DO NOTHING/);
 assert.match(runner,/SOURCE_HASH_REVISED/);
 assert.match(runner,/UNION ALL/);
 assert.match(runner,/n>=30\?Number\(x\.wins\)\/n:null/);
 assert.doesNotMatch(runner,/\/api\/cron|sendNotification|runLiveTrade|setInterval/);
});
