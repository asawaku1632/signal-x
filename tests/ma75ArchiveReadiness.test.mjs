import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMa75ArchiveReadiness} from '../app/lib/research/ma75ArchiveReadiness.mjs';
const freeze=()=>({schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 populationSize:3,codes:['1301','3753','9984'],frozenAt:'2026-10-31T13:43:02.737Z'});
const candles=(n=80)=>Array.from({length:n},(_,i)=>({
 time:Date.parse('2026-06-01T00:00:00Z')/1000+i*86400,
 open:100,high:102,low:99,close:i===n-1?101:100,volume:1000
}));
const chart=(code='3753',bars=candles())=>({code,provider:'yahoo_chart',timeframe:'1D',
 updatedAt:'2026-10-30T12:29:55Z',candles:bars});
const audit=(data=[chart()],options={})=>auditMa75ArchiveReadiness(freeze(),data,options);
test('frozen stock-day denominator includes absent charts and never authorizes live signals',()=>{
 const r=audit();
 assert.equal(r.universeSize,3);
 assert.equal(r.usableHistoricalOnly,1);
 assert.equal(r.missingOrBlocked,2);
 assert.equal(r.counts.NO_SAVED_DAILY_CHART,2);
 assert.equal(r.rows.find(x=>x.code==='3753').detail.barCount,80);
 assert.equal(r.rows.find(x=>x.code==='3753').detail.ma75,100.01333);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.validatedForwardWinRate,null);
});
test('stored snapshot from an outside code cannot be added to frozen sample',()=>{
 const r=audit([chart('3753'),chart('9999')]);
 assert.deepEqual(r.outOfFrozenCohort,['9999']);
 assert.equal(r.usableHistoricalOnly,1);
});
test('missing or bad bar arrays and unknown provider/timestamp quarantine',()=>{
 const cases=[
  [chart('3753',[]),'INSUFFICIENT_75DAY_WARMUP'],
  [chart('3753',candles(75)),'INSUFFICIENT_75DAY_WARMUP'],
  [{...chart(),updatedAt:'invalid'},'QUARANTINED_SNAPSHOT_PROVENANCE'],
  [{...chart(),timeframe:'5m'},'QUARANTINED_SNAPSHOT_PROVENANCE'],
  [{...chart(),provider:''},'QUARANTINED_SNAPSHOT_PROVENANCE'],
  [{...chart(),candles:null},'QUARANTINED_SNAPSHOT_PROVENANCE'],
 ];
 for (const [sample,expected] of cases) assert.equal(audit([sample]).rows[1].status,expected);
});
test('duplicate or unsorted chart samples cannot add hidden winners',()=>{
 const r=audit([chart(),chart()]);
 assert.equal(r.rows[1].status,'QUARANTINED_DUPLICATE_SNAPSHOT');
 assert.equal(r.usableHistoricalOnly,0);
 const bars=candles();bars[40].time=bars[39].time;
 assert.equal(audit([chart('3753',bars)]).rows[1].status,'QUARANTINED_BAR_OR_TIME');
});
test('future bar relative to chart savedAt must be quarantined',()=>{
 const bars=candles(); bars.at(-1).time=Date.parse('2026-11-01T00:00:00Z')/1000;
 assert.equal(audit([chart('3753',bars)]).rows[1].status,'QUARANTINED_BAR_OR_TIME');
});
test('split-like close jump is quarantined rather than treating discontinuity as profit',()=>{
 const bars=candles();bars[78]={...bars[78],open:200,close:200,high:205,low:195};
 assert.equal(audit([chart('3753',bars)]).rows[1].status,'QUARANTINED_SPLIT_REVIEW');
});
test('not enough previous volume yields null ratio, not fake zero',()=>{
 const bars=candles();bars[70].volume=0;
 const result=audit([chart('3753',bars)]);
 assert.equal(result.rows[1].detail.prior20VolumeRatio,null);
});
test('auditing before frozen file or using forged codes is blocked',()=>{
 assert.throws(()=>audit([chart()],{auditCutoff:'2026-10-30T00:00:00Z'}),TypeError);
 const bad=freeze();bad.codes[0]='3753';
 assert.throws(()=>auditMa75ArchiveReadiness(bad,[chart()]),TypeError);
});
