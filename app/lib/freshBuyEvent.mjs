export const FRESH_BUY_VERSION="FRESH_BUY_V1";
const mean=v=>v.reduce((s,x)=>s+x,0)/v.length;
function band(bars){const c=bars.slice(-20).map(b=>b.close),middle=mean(c),sd=Math.sqrt(mean(c.map(x=>(x-middle)**2)));return {middle,upper:middle+2*sd,width:middle>0?4*sd/middle:0};}
export function evaluateFreshBuy(input,nowMs,tradeDate){
 if(!Array.isArray(input))return {matched:false,reason:"INVALID_INPUT"};
 const bars=input.filter(b=>b&&Number.isFinite(b.time)&&b.time*1000+300000<=nowMs).sort((a,b)=>a.time-b.time);
 if(bars.length<42)return {matched:false,reason:"INSUFFICIENT_BARS"};
 if(new Set(bars.map(b=>b.time)).size!==bars.length)return {matched:false,reason:"DUPLICATE_BARS"};
 const history=bars.slice(-42);
 if(history.some(b=>!["open","high","low","close","volume"].every(k=>Number.isFinite(b[k]))||b.open<=0||b.close<=0||b.low<=0||b.volume<0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close)))return {matched:false,reason:"INVALID_OHLCV"};
 const last=history.at(-1),previous=history.at(-2),dateOf=b=>new Date(b.time*1000+9*3600000).toISOString().slice(0,10);
 if(dateOf(last)!==tradeDate||nowMs-(last.time*1000+300000)>20*60000)return {matched:false,reason:"STALE_BARS"};
 const recent=history.slice(-3);
 if(recent.some(b=>dateOf(b)!==tradeDate)||recent[1].time-recent[0].time!==300||recent[2].time-recent[1].time!==300)return {matched:false,reason:"NONCONTIGUOUS_BARS"};
 const prior=history.slice(-21,-1),older=history.slice(-22,-2),averageVolume=mean(prior.map(b=>b.volume));
 if(averageVolume<=0)return {matched:false,reason:"INVALID_VOLUME_BASELINE"};
 const volumeRatio=last.volume/averageVolume,current=band(history),prev=band(history.slice(0,-1)),before=band(history.slice(0,-2)),signals=[];
 const movePercent=(last.close/previous.close-1)*100,extensionPercent=(last.close/current.middle-1)*100;
 if(last.close>current.middle&&current.middle>prev.middle&&movePercent>0&&movePercent<=3&&extensionPercent<=5){
  const level=Math.max(...prior.map(b=>b.high)),olderLevel=Math.max(...older.map(b=>b.high));
  if(last.close>level*1.002&&previous.close<=olderLevel*1.002&&last.close/level<=1.03&&volumeRatio>=1.5)signals.push({kind:"HIGH_BREAKOUT",label:"直近20本の高値を新規突破",level,volumeRatio});
  const impulse=history.slice(-12,-4),pullback=history.slice(-4,-1),peak=Math.max(...impulse.map(b=>b.high)),base=Math.min(...impulse.map(b=>b.low)),dip=Math.min(...pullback.map(b=>b.low)),reboundLevel=Math.max(...pullback.map(b=>b.high)),depth=(peak-dip)/peak;
  if(peak/base>=1.008&&peak>=reboundLevel&&depth>=0.005&&depth<=0.03&&previous.close<=history.at(-3).close&&last.close>reboundLevel*1.002&&volumeRatio>=1.2)signals.push({kind:"PULLBACK_REBOUND",label:"押し目の戻り高値を新規突破",level:reboundLevel,volumeRatio});
  const widths=[];for(let end=history.length-21;end<=history.length-2;end++)widths.push(band(history.slice(0,end)).width);
  widths.sort((a,b)=>a-b);const lowerQuartile=widths[Math.floor((widths.length-1)*.25)];
  if(prev.width>0&&prev.width<=lowerQuartile&&current.width>=prev.width*1.2&&last.close>prev.upper*1.002&&previous.close<=before.upper*1.002&&volumeRatio>=1.5)signals.push({kind:"BB_UP_EXPANSION",label:"BB収縮後の上方向への新規拡大",level:prev.upper,volumeRatio});
 }
 return {matched:signals.length>0,reason:signals.length?"NEW_BUY_CONDITIONS":"NO_NEW_EVENT",version:FRESH_BUY_VERSION,barTime:last.time,confirmedAt:new Date((last.time+300)*1000).toISOString(),receivedAt:new Date(nowMs).toISOString(),price:last.close,volumeRatio,movePercent,extensionPercent,signals,candles:history};
}
