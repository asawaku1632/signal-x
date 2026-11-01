import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeMa75HistoricalPrecloseConditions}
 from '../scripts/research/ma75-historical-preclose-conditions.mjs';

const signal=(code,date,{kind='BREAKOUT',ma75Rising=false,
 volumeRatio=1,return5Percent=1,outcome5Status='COMPLETED',
 budgetEligible=true}={})=>({
 code,kind,ma75Rising,volumeRatio,
 signalTime:Math.floor(Date.parse(date+'T00:00:00Z')/1000),
 outcome5Status,return5Percent,
 profit5Yen100:return5Percent*1000,budgetEligible
});

test('feature conditions use only breakout-close SMA slope and trailing volume, never later retest',()=>{
 const observations=[
  signal('1301','2026-09-10',{ma75Rising:true,volumeRatio:2,return5Percent:5}),
  signal('1302','2026-09-11',{ma75Rising:true,volumeRatio:1,return5Percent:-3}),
  signal('1303','2026-10-01',{ma75Rising:false,volumeRatio:2,return5Percent:-2}),
  signal('1304','2026-10-02',{ma75Rising:false,volumeRatio:null,return5Percent:1}),
  signal('1305','2026-10-29',{ma75Rising:true,volumeRatio:4,
   outcome5Status:'PENDING',return5Percent:null}),
  signal('1306','2026-10-28',{ma75Rising:false,volumeRatio:4,
   outcome5Status:'QUARANTINED_GAP',return5Percent:null}),
  signal('1301','2026-09-12',{kind:'RETEST',ma75Rising:true,volumeRatio:2,return5Percent:90})
 ];
 const out=analyzeMa75HistoricalPrecloseConditions(observations);
 assert.equal(out.featureCutoff,'BREAKOUT_SIGNAL_DAY_COMPLETED_CLOSE');
 assert.equal(out.trueIndependentChronologicalHoldout,false);
 assert.equal(out.thresholdChosenAfterAggregateReview,true);
 assert.equal(out.full953HeadlineResults,null);
 assert.equal(out.eligibleForProduction,false);
 const byId=Object.fromEntries(out.conditions.map(x=>[x.condition,x]));
 assert.equal(byId.ALL_BREAKOUTS.total,6);
 assert.equal(byId.ALL_BREAKOUTS.completed,4);
 assert.equal(byId.ALL_BREAKOUTS.pending,1);
 assert.equal(byId.ALL_BREAKOUTS.quarantined,1);
 assert.equal(byId.ALL_BREAKOUTS.winRatePercent,50);
 assert.equal(byId.ALL_BREAKOUTS.averageReturn5Percent,0.25);
 assert.equal(byId.RISING_MA75_AT_CLOSE.total,3);
 assert.equal(byId.RISING_MA75_AT_CLOSE.completed,2);
 assert.equal(byId.RISING_MA75_AT_CLOSE.averageReturn5Percent,1);
 assert.equal(byId.VOLUME_GE_1_5X_PRIOR20_AT_CLOSE.total,4);
 assert.equal(byId.VOLUME_GE_1_5X_PRIOR20_AT_CLOSE.completed,2);
 assert.equal(byId.VOLUME_GE_1_5X_PRIOR20_AT_CLOSE.averageReturn5Percent,1.5);
 assert.equal(byId.RISING_AND_VOLUME_GE_1_5X_AT_CLOSE.total,2);
 assert.equal(byId.RISING_AND_VOLUME_GE_1_5X_AT_CLOSE.completed,1);
 assert.equal(byId.RISING_AND_VOLUME_GE_1_5X_AT_CLOSE.averageReturn5Percent,5);
 assert.deepEqual(byId.ALL_BREAKOUTS.signalMonthBreakdown.map(m=>m.month),
  ['2026-09','2026-10']);
 assert.equal(byId.ALL_BREAKOUTS.signalMonthBreakdown[0].completed,2);
 assert.equal(byId.ALL_BREAKOUTS.signalMonthBreakdown[1].pending,1);
 assert.equal(byId.ALL_BREAKOUTS.signalMonthBreakdown[1].quarantined,1);
 assert.equal(JSON.stringify(out).includes('90'),false);
});
test('malformed outcomes cannot silently bias settled denominator',()=>{
 const good=signal('1301','2026-09-10',{ma75Rising:true,volumeRatio:2});
 assert.throws(()=>analyzeMa75HistoricalPrecloseConditions([
  {...good,return5Percent:null}
 ]),/INVALID_COMPLETED_FIVE_DAY_OUTCOME/);
 for(const bad of [
  {...good,signalTime:NaN},
  {...good,ma75Rising:null},
  {...good,volumeRatio:Infinity},
  {...good,outcome5Status:'UNKNOWN'},
 ]){
  assert.throws(()=>analyzeMa75HistoricalPrecloseConditions([bad]),
   /INVALID_BREAKOUT_OBSERVATION/);
 }
});
test('pure shadow feature review contains no IO, credential or automatic trading',()=>{
 const s=readFileSync(new URL('../scripts/research/ma75-historical-preclose-conditions.mjs',import.meta.url),'utf8');
 const executable=s.split('\n').filter(line=>!line.trim().startsWith('*')&&!line.trim().startsWith('//')).join('\n');
 assert.doesNotMatch(executable,/\bfetch\s*\(|readFileSync|writeFileSync|process\.env|JQUANTS_API_KEY|orderSubmit|notificationSend/);
 assert.match(executable,/trueIndependentChronologicalHoldout:false/);
 assert.match(executable,/eligibleForProduction:false/);
});
