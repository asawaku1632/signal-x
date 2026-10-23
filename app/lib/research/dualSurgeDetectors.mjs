// Research-only, pure completed-session detectors. No network, persistence, or trading actions.
export const DUAL_SURGE_VERSION = "DUAL_SURGE_20261023_V1";
export const COHORTS = Object.freeze({PRE:"PRE_SURGE_V1",START:"SURGE_START_V1"});
const finitePositive=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
export function inspectDualSurge(candles, asOfIndex=candles?.length-1) {
 if(!Array.isArray(candles)||!Number.isInteger(asOfIndex)||asOfIndex<21||asOfIndex>=candles.length)
  return {available:false,reason:"INSUFFICIENT_HISTORY",signals:[]};
 const bars=candles.slice(asOfIndex-20,asOfIndex+1);
 if(bars.some(b=>!finitePositive(b.open)||!finitePositive(b.high)||!finitePositive(b.low)||!finitePositive(b.close)||!Number.isFinite(b.volume)||b.volume<0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close)||b.low<=0))
  return {available:false,reason:"INVALID_OHLCV",signals:[]};
 if(bars.some((b,i)=>i>0&&(!Number.isFinite(b.time)||b.time<=bars[i-1].time)))
  return {available:false,reason:"INVALID_CHRONOLOGY",signals:[]};
 const prev=bars.slice(0,-1), today=bars.at(-1), yesterday=prev.at(-1);
 const high20=Math.max(...prev.map(b=>b.high));
 const avgVolume=prev.reduce((s,b)=>s+b.volume,0)/20;
 if(avgVolume<=0)return {available:false,reason:"VOLUME_BASELINE_UNAVAILABLE",signals:[]};
 const volumeRatio=today.volume/avgVolume;
 const dailyReturn=(today.close/yesterday.close-1)*100;
 const highDistance=(today.close/high20-1)*100;
 // Start cohort: first close beyond the *previous* 20-session high; no same-day lookahead.
 const started=today.close>high20&&dailyReturn>=3&&volumeRatio>=1.3;
 // Pre cohort: near previous high, positive trend but not already a breakout.
 const pre=!started&&today.close<=high20&&highDistance>=-5&&highDistance<0&&
  today.close>prev.at(-6).close&&today.close>yesterday.close&&volumeRatio>=1;
 const features={high20,avgVolume,volumeRatio,dailyReturn,highDistance};
 const signals=[];
 if(pre)signals.push({cohort:COHORTS.PRE,features});
 if(started)signals.push({cohort:COHORTS.START,features});
 return {available:true,reason:null,signals,features};
}
