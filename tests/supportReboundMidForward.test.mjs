import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMidRisk, MID_RISK_FACTORS } from "../app/lib/research/supportReboundMidRisk.ts";
import {
  REBOUND_LOCAL_FORWARD_VERSION, beginReboundForward, readForwardLocal,
  reconcileReboundForward, supportHintAtClose,
} from "../app/lib/research/supportReboundForwardLocal.ts";
import { REBOUND_RISK_CUTOFF } from "../app/lib/research/supportReboundRiskStudy.ts";

const features=(changes={})=>({
  rsi14:45, atr14Percent:2, sma50Slope10Percent:1,volumeRatio20:1,bbLowerGapPercent:2,...changes,
});
function scoreItem(band,returnPercent,flags={},entryTime=REBOUND_RISK_CUTOFF+86400){
  return {code:"7203",hintTime:entryTime-86400,score:band==="MID"?45:10,band,features:features(flags),
    trade:{signalIndex:69,signalTime:entryTime-86400,entryTime,exitTime:entryTime+6*86400,
      entryPrice:100,exitPrice:100+returnPercent,returnPercent,pnlYen:returnPercent*100,
      worstIntratradePercent:Math.min(returnPercent,0)}};
}
function bars(){
  const rows=Array.from({length:70},(_,i)=>({
    time:1700000000+i*86400,open:104,high:104.5,low:103.5,close:104,volume:1000,
  }));
  rows[66]={...rows[66],open:102,high:103,low:101,close:102};
  rows[67]={...rows[67],open:100,high:101,low:99,close:100};
  rows[68]={...rows[68],open:98,high:99,low:97,close:98};
  rows[69]={...rows[69],open:97,high:98,low:96.5,close:97.2};
  return rows;
}
function future(base,entry=100,exit=105){
  const result=[...base];
  for(let i=70;i<76;i++)result.push({
    time:1700000000+i*86400,open:i===70?entry:i===75?exit:100,
    high:i===75?exit+1:101,low:99,close:i===75?exit:100,volume:1000,
  });
  return result;
}
test("middle-only fixed factors count overlaps and losses, without pretending causal ranking",()=>{
  const list=[
    scoreItem("MID",-7,{sma50Slope10Percent:-4,atr14Percent:3.7}),
    scoreItem("MID",3,{sma50Slope10Percent:-1,atr14Percent:3.2}),
    scoreItem("MID",-2,{rsi14:31,volumeRatio20:0.5}),
    scoreItem("LOW",-9,{sma50Slope10Percent:-3,atr14Percent:4}),
  ];
  const r=analyzeMidRisk(list,"ALL");
  assert.equal(r.total.count,3);
  assert.equal(r.total.bigLosses,1);
  assert.equal(r.total.winPercent,33.33);
  const combo=r.factors.find(f=>f.id==="NEGATIVE_SLOPE+HIGH_ATR");
  assert.equal(combo.metrics.count,2);
  assert.equal(combo.metrics.bigLosses,1);
  assert.equal(combo.warning,"少数例：参考値");
  assert.equal(r.factors.length,15);
  assert.equal(MID_RISK_FACTORS.length,5);
  assert.equal(r.topLosses[0].returnPercent,-7);
});
test("future boundary and ongoing trades are excluded from mid-risk completed analysis",()=>{
  const list=[scoreItem("MID",-6,{},REBOUND_RISK_CUTOFF-20*86400),
    scoreItem("MID",2,{},REBOUND_RISK_CUTOFF+2*86400),
    {...scoreItem("MID",-7,{},REBOUND_RISK_CUTOFF-86400),
      trade:{...scoreItem("MID",-7,{},REBOUND_RISK_CUTOFF-86400).trade,exitTime:REBOUND_RISK_CUTOFF+86400}},
    {...scoreItem("MID",2),trade:null}];
  assert.equal(analyzeMidRisk(list,"ALL").total.count,3);
  assert.equal(analyzeMidRisk(list,"TRAIN").total.count,1);
  assert.equal(analyzeMidRisk(list,"TEST").total.count,1);
});
test("first local activation freezes watermarks without importing history",()=>{
  const rows=bars();
  const state=beginReboundForward([{code:"7203",candles:rows.slice(0,69)}]);
  assert.equal(state.version,REBOUND_LOCAL_FORWARD_VERSION);
  assert.equal(state.signals.length,0);
  assert.equal(state.baselineByCode["7203"],rows[68].time);
  assert.equal(supportHintAtClose(rows,69),true);
  assert.equal(readForwardLocal(JSON.stringify(state)).enabled,true);
});
test("only a NEW latest closed ③ is locked and immutable as later results arrive",()=>{
  const rows=bars(),initial=beginReboundForward([{code:"7203",candles:rows.slice(0,69)}]);
  const first=reconcileReboundForward(initial,[{code:"7203",candles:rows}]);
  assert.equal(first.signals.length,1);
  const lock=first.signals[0];
  assert.equal(lock.signalTime,rows[69].time);
  assert.equal(lock.signalClose,97.2);
  assert.equal(lock.status,"PENDING");
  const confirmed=reconcileReboundForward(first,[{code:"7203",candles:future(rows)}]);
  assert.equal(confirmed.signals.length,1);
  assert.equal(confirmed.signals[0].status,"CLOSED");
  assert.equal(confirmed.signals[0].entryPrice,100);
  assert.equal(confirmed.signals[0].exitPrice,105);
  assert.equal(confirmed.signals[0].returnPercent,5);
  assert.equal(confirmed.signals[0].score,lock.score);
  assert.deepEqual(reconcileReboundForward(confirmed,[{code:"7203",candles:future(rows)}]),confirmed);
});
test("missing history, revised original close and later splits require review",()=>{
  const rows=bars(),start=beginReboundForward([{code:"7203",candles:rows.slice(0,69)}]);
  const observed=reconcileReboundForward(start,[{code:"7203",candles:rows}]);
  const revised=rows.map(c=>({...c}));
  revised[69].close=97.6;
  assert.equal(reconcileReboundForward(observed,[{code:"7203",candles:revised}]).signals[0].reason,"SOURCE_PRICE_REVISED");
  const afterSplit=reconcileReboundForward(observed,[{code:"7203",candles:future(rows),splitEvents:[rows[69].time+86400*2]}]);
  assert.equal(afterSplit.signals[0].status,"REVIEW");
});
test("missed intervening hints are not backfilled and invalid local records fail closed",()=>{
  const rows=bars(),state=beginReboundForward([{code:"7203",candles:rows.slice(0,68)}]);
  const visited=reconcileReboundForward(state,[{code:"7203",candles:future(rows)}]);
  assert.equal(visited.signals.length,0);
  assert.equal(readForwardLocal("broken"),null);
  assert.equal(readForwardLocal(JSON.stringify({...state,baselineByCode:{"../../":0}})),null);
});
