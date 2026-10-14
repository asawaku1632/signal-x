import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {VERSION,gradeForward} from '../app/lib/research/bollingerBreakoutShadow.mjs';
import {matchArchivedVolumeFactors} from '../app/lib/research/bollingerVolumeFactors.mjs';
const cal='JPX_MARKET_HOLIDAYS_2026_2027_2026-02-06';
const DAY=86400;
const asDate=t=>new Date(t*1000).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
const input=(signalVolume=1700)=>{
  const candles=Array.from({length:116},(_,i)=>{
   const close=i<80?100+4*Math.sin(i*.73):i===110?105:100+.12*Math.sin(i*.7);
   const open=i===110?103:close;
   return {time:1700000000+i*DAY,open,high:Math.max(open,close)+1,
     low:Math.min(open,close)-.5,close,volume:i===110?signalVolume:1000};
  });
  return {code:'9984',provider:'YAHOO_CHART',timeframe:'1D',candles,
   splitEvents:[],expectedTradingDates:candles.map(x=>asDate(x.time)),
   asOfCompletedJstDate:asDate(candles.at(-1).time)};
};
function archive(source){
 const t=110,r=gradeForward(source.candles,t,'9984');
 assert.equal(r.signal.breakout,true);
 const hash=createHash('sha256').update(JSON.stringify({
  version:VERSION,calendar:cal,code:'9984',
  history:source.candles.slice(t-80,t+1),future:source.candles.slice(t+1,t+2)
 })).digest('hex');
 return {code:'9984',signal_time:String(source.candles[t].time),horizon:1,
  detector_version:VERSION,group_key:r.signal.group,signal_close:String(r.signal.signalClose),
  source_hash:hash};
}
test('exact frozen source yields historical 1.3x+ band-volume factor',()=>{
 const x=input(),y=matchArchivedVolumeFactors([x],[archive(x)],cal);
 assert.equal(y.length,1);
 assert.equal(y[0].volume_ratio,1.7);
 assert.equal(y[0].volume_bucket,'HIGH_1_3X');
});
test('0 volume remains BELOW, not UNKNOWN',()=>{
 const x=input(0),y=matchArchivedVolumeFactors([x],[archive(x)],cal);
 assert.equal(y[0].volume_ratio,0);
 assert.equal(y[0].volume_bucket,'BELOW_1_3X');
});
test('provider price revision cannot silently relabel old events',()=>{
 const x=input(),s=archive(x);
 const revised=structuredClone(x);revised.candles[110].volume=1600;
 assert.throws(()=>matchArchivedVolumeFactors([revised],[s],cal),/ARCHIVED_SOURCE_REVISED/);
});
test('future price changes also fail the original hash',()=>{
 const x=input(),s=archive(x),revised=structuredClone(x);
 revised.candles[111].open+=1;revised.candles[111].high+=1;
 assert.throws(()=>matchArchivedVolumeFactors([revised],[s],cal),/ARCHIVED_SOURCE_REVISED/);
});
test('future observations do not change as-of volume ratio',()=>{
 const x=input(),s=archive(x);
 const a=matchArchivedVolumeFactors([x],[s],cal)[0].volume_ratio;
 const y=structuredClone(x);y.candles[115].volume=1000000;
 const b=matchArchivedVolumeFactors([y],[s],cal)[0].volume_ratio;
 assert.equal(a,b);
});
test('duplicate archived event cannot increase counts',()=>{
 const x=input(),s=archive(x);
 assert.throws(()=>matchArchivedVolumeFactors([x],[s,s],cal),/DUPLICATE_ARCHIVED_SIGNAL/);
});
test('bad quality and mismatched original category are rejected',()=>{
 const x=input(),s=archive(x),bad=structuredClone(x);
 bad.expectedTradingDates[10]='2029-01-01';
 assert.throws(()=>matchArchivedVolumeFactors([bad],[s],cal),/QUALITY_REJECTED/);
 assert.throws(()=>matchArchivedVolumeFactors([x],[{...s,group_key:'OTHER'}],cal),
   /ARCHIVED_CLASSIFICATION_REVISED/);
});
test('scope is owner only, bounded manual requests, no trade or cron integration',()=>{
 const runner=readFileSync('app/lib/research/bollingerVolumeFactorRunner.ts','utf8');
 const route=readFileSync('app/api/admin/bollinger-breakout-shadow/volume/route.ts','utf8');
 const migration=readFileSync('supabase/migrations/20261015_bb_breakout_volume_factor_shadow.sql','utf8');
 assert.match(route,/getLearningOwnerSession/);
 assert.match(runner,/ON CONFLICT\(batch_id,target_date\) DO NOTHING/);
 assert.match(runner,/index\+=2/);
 assert.match(runner,/FROZEN_VOLUME_REVISION/);
 assert.match(runner,/matchArchivedVolumeFactors/);
 assert.doesNotMatch(runner,/runEntryTimeShadowDaily|sendNotification|\/api\/scan|setInterval/);
 assert.match(migration,/PRIMARY KEY\(detector_version,code,signal_time\)/);
 assert.match(migration,/REFERENCES public\.bb_breakout_shadow_outcomes/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(migration,/GRANT UPDATE ON public\.bb_breakout_volume_factors/);
});
test('volume stratification has a 30-sample privacy against false conclusions',()=>{
 const runner=readFileSync('app/lib/research/bollingerVolumeFactorRunner.ts','utf8');
 assert.match(runner,/n>=30\?wins\/n:null/);
 assert.match(runner,/JOIN public\.bb_breakout_shadow_outcomes frozen_one_day/);
 assert.match(runner,/o\.horizon/);
});
