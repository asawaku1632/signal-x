import test from "node:test";
import assert from "node:assert/strict";
import {inspectMorning,summarizeAnalogs,summarizeMorningDropPatterns} from "../app/lib/research/morningAnalog.mjs";

const makeBars=(date,lowAt=3)=>Array.from({length:30},(_,i)=>{
  const h=9+Math.floor(i*5/60),m=(i*5)%60;
  const low=i===lowAt?90:98;
  return {date,time:String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"),
    open:100,high:i>lowAt?103:101,low,close:100};
});
test("bottom window and later rebound use only completed same-day bars",()=>{
  const result=inspectMorning("2026-10-28",100,makeBars("2026-10-28"));
  assert.equal(result.valid,true);
  assert.equal(result.bottomWindow,"09:15");
  assert.equal(result.bottomPrice,90);
  assert.equal(result.rebound1pct,true);
  assert.equal(result.rebound2pct,true);
});
test("incomplete and inconsistent bars fail closed",()=>{
  assert.equal(inspectMorning("2026-10-28",100,makeBars("2026-10-28").slice(1)).valid,false);
  const bars=makeBars("2026-10-28");bars[4].low=105;
  assert.equal(inspectMorning("2026-10-28",100,bars).valid,false);
});
test("future outcomes and features available on the outcome date cannot leak",()=>{
  const features={priorReturnPct:-1,priorRangePct:2,priorVolumeRatio:1.2,aiPower:90};
  const target={tradeDate:"2026-10-28",featureAvailableAt:"2026-10-27T18:00:00+09:00",features};
  const make=(tradeDate,featureAvailableAt)=>({
    code:"1234",tradeDate,featureAvailableAt,features,
    outcome:inspectMorning(tradeDate,100,makeBars(tradeDate))
  });
  const result=summarizeAnalogs(target,[
    make("2026-10-27","2026-10-26T18:00:00+09:00"),
    make("2026-10-28","2026-10-27T18:00:00+09:00"),
    make("2026-10-26","2026-10-26T10:00:00+09:00")
  ],{minSamples:2});
  assert.equal(result.samples,1);
  assert.equal(result.eligible,false);
  assert.equal(result.rebound1pct.rate,null);
});

test("sharp-drop frequency counts bottom windows, deduplicates, and gates rates",()=>{
  const date="2026-10-28";
  const a={...inspectMorning(date,100,makeBars(date,8)),code:"1234"};
  const b={...inspectMorning(date,100,makeBars(date,8)),code:"5678"};
  const result=summarizeMorningDropPatterns([a,b,a],{minSamples:2,dropThresholdPct:2});
  assert.equal(result.samples,2);
  assert.equal(result.excluded.duplicate,1);
  assert.deepEqual(result.topWindows,[{windowStart:"09:40",windowEnd:"09:45",count:2}]);
  assert.equal(result.rebound1pct.rate,100);
  assert.equal(summarizeMorningDropPatterns([a],{minSamples:2,dropThresholdPct:2}).rebound1pct.rate,null);
});
test("early-drop filter does not confuse later selloff with opening drop",()=>{
  const date="2026-10-28",bars=makeBars(date,12);
  const result=summarizeMorningDropPatterns([
    {...inspectMorning(date,100,bars),code:"1234"}
  ],{minSamples:1,dropThresholdPct:3});
  assert.equal(result.samples,0);
  assert.equal(result.excluded.notSharpDrop,1);
});

test("invalid observation dates are excluded rather than silently counted",()=>{
  const date="2026-10-28";
  const good={...inspectMorning(date,100,makeBars(date,8)),code:"1234"};
  const result=summarizeMorningDropPatterns([good,{...good,date:"not-a-date",code:"5678"}],{minSamples:1,dropThresholdPct:2});
  assert.equal(result.samples,1);
  assert.equal(result.excluded.invalid,1);
});

test("1 and 2 percent rebound denominators are counted independently",()=>{
  const features={priorReturnPct:-1,priorRangePct:2,priorVolumeRatio:1.2,aiPower:90};
  const target={tradeDate:"2026-10-28",featureAvailableAt:"2026-10-27T18:00:00+09:00",features};
  const base={code:"1234",tradeDate:"2026-10-27",featureAvailableAt:"2026-10-26T18:00:00+09:00",features};
  const observation=inspectMorning("2026-10-27",100,makeBars("2026-10-27"));
  const result=summarizeAnalogs(target,[{...base,outcome:{...observation,rebound1pct:true,rebound2pct:null}}],{minSamples:1});
  assert.equal(result.rebound1pct.observed,1);
  assert.equal(result.rebound1pct.rate,100);
  assert.equal(result.rebound2pct.observed,0);
  assert.equal(result.rebound2pct.rate,null);
});


test("malformed prior-day snapshot stamps cannot enter analog comparisons",()=>{
  const features={priorReturnPct:-1,priorRangePct:2,priorVolumeRatio:1.2,aiPower:90};
  const target={tradeDate:"2026-10-28",featureAvailableAt:"2026-10-27T18:00:00+09:00",features};
  const outcome=inspectMorning("2026-10-27",100,makeBars("2026-10-27"));
  const make=stamp=>({code:"1234",tradeDate:"2026-10-27",featureAvailableAt:stamp,features,outcome});
  const result=summarizeAnalogs(target,[
    make("2026-10-26T18:00:00+09:00"),
    make("2026-10-26 garbage"),
    make("2026-10-27T08:00:00+09:00"),
    make("2026-10-26T99:99:99+09:00")
  ],{minSamples:2});
  assert.equal(result.samples,1);
  assert.equal(result.eligible,false);
});

test("invalid analog selection limits and distance weights fail closed",()=>{
  const target={tradeDate:"2026-10-28",featureAvailableAt:"2026-10-27T18:00:00+09:00",features:{priorReturnPct:-1,priorRangePct:2,priorVolumeRatio:1.2,aiPower:90}};
  for(const options of [{maxAnalogs:0},{maxAnalogs:-1},{maxAnalogs:1.5},
      {weights:{priorReturnPct:-1,priorRangePct:1,priorVolumeRatio:2,aiPower:0.1}},
      {weights:{priorReturnPct:Infinity,priorRangePct:1,priorVolumeRatio:2,aiPower:0.1}}]){
    assert.throws(()=>summarizeAnalogs(target,[],options),/INVALID_ANALOG_OPTIONS/);
  }
});

test("timestamp offsets are compared as instants before JST trading date",()=>{
  const features={priorReturnPct:-1,priorRangePct:2,priorVolumeRatio:1.2,aiPower:90};
  const outcome=inspectMorning("2026-10-27",100,makeBars("2026-10-27"));
  const target={tradeDate:"2026-10-28",featureAvailableAt:"2026-10-27T18:00:00+09:00",features};
  const history=stamp=>({code:"1234",tradeDate:"2026-10-27",featureAvailableAt:stamp,features,outcome});
  // 2026-10-26 23:00 JST, before the Oct 27 trading date.
  const valid="2026-10-26T14:00:00Z";
  // 2026-10-27 10:00 JST; calendar date in -04:00 is still Oct 26.
  const invalid="2026-10-26T21:00:00-04:00";
  const result=summarizeAnalogs(target,[history(valid),history(invalid)],{minSamples:2});
  assert.equal(result.samples,1);
});

test("duplicate stock/date histories cannot inflate analog sample eligibility",()=>{
  const date="2026-10-27";
  const features={priorReturnPct:-1,priorRangePct:2,priorVolumeRatio:1.2,aiPower:90};
  const row={code:"1234",tradeDate:date,featureAvailableAt:"2026-10-26T18:00:00+09:00",features,
    outcome:inspectMorning(date,100,makeBars(date))};
  const result=summarizeAnalogs({tradeDate:"2026-10-28",featureAvailableAt:"2026-10-27T18:00:00+09:00",features},[row,row,{...row}],{minSamples:2});
  assert.equal(result.samples,1);
  assert.equal(result.eligible,false);
  assert.equal(result.rebound1pct.rate,null);
});

test("conflicting duplicate stock/date observations are excluded regardless of input order",()=>{
  const features={priorReturnPct:-1,priorRangePct:2,priorVolumeRatio:1.2,aiPower:90};
  const date="2026-10-27";
  const row={code:"1234",tradeDate:date,featureAvailableAt:"2026-10-26T18:00:00+09:00",features,
    outcome:inspectMorning(date,100,makeBars(date))};
  const conflict={...row,outcome:{...row.outcome,rebound1pct:false}};
  const target={tradeDate:"2026-10-28",featureAvailableAt:"2026-10-27T18:00:00+09:00",features};
  for(const histories of [[row,conflict],[conflict,row]]){
    const result=summarizeAnalogs(target,histories,{minSamples:1});
    assert.equal(result.samples,0);
    assert.equal(result.eligible,false);
    assert.equal(result.rebound1pct.rate,null);
  }
});

test("target feature snapshot cannot be from trading day or malformed time",()=>{
  const features={priorReturnPct:-1,priorRangePct:2,priorVolumeRatio:1.2,aiPower:90};
  const target={tradeDate:"2026-10-28",features};
  assert.throws(()=>summarizeAnalogs(target,[],{minSamples:1}),/TARGET_FEATURE_LOOKAHEAD/);
  for(const stamp of ["2026-10-28T09:05:00+09:00","2026-10-28T00:00:00+09:00","not-a-time"]){
    assert.throws(()=>summarizeAnalogs({...target,featureAvailableAt:stamp},[],{minSamples:1}),/TARGET_FEATURE_LOOKAHEAD/);
  }
  const valid=summarizeAnalogs({...target,featureAvailableAt:"2026-10-27T18:00:00+09:00"},[],{minSamples:1});
  assert.equal(valid.samples,0);
});

test("impossible calendar dates cannot enter morning research",()=>{
  assert.equal(inspectMorning("2026-02-30",100,makeBars("2026-02-30")).valid,false);
  const features={priorReturnPct:-1,priorRangePct:2,priorVolumeRatio:1.2,aiPower:90};
  assert.throws(()=>summarizeAnalogs({
    tradeDate:"2026-02-30",featureAvailableAt:"2026-02-27T18:00:00+09:00",features
  },[]),/INVALID_ANALOG_INPUT/);
  const good={...inspectMorning("2026-10-28",100,makeBars("2026-10-28")),code:"1234"};
  const stats=summarizeMorningDropPatterns([{...good,date:"2026-02-30"}],{minSamples:1,dropThresholdPct:2});
  assert.equal(stats.samples,0);
  assert.equal(stats.excluded.invalid,1);
});

test("zero and negative interval observations are excluded from research",()=>{
  const date="2026-10-28";
  const row={...inspectMorning(date,100,makeBars(date,8)),code:"1234"};
  const result=summarizeMorningDropPatterns([
    {...row,intervalMinutes:0},
    {...row,intervalMinutes:-5,code:"5678"},
    {...row,intervalMinutes:5,code:"9012"}
  ],{minSamples:1,dropThresholdPct:2});
  assert.equal(result.samples,1);
  assert.equal(result.excluded.invalid,2);
});
