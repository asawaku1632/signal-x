function evaluateTrend(bars, nowMs, tradeDate, direction) {
  const valid = bars.filter(bar => Number.isFinite(bar.time) &&
    ["open","high","low","close","volume"].every(key => Number.isFinite(bar[key])) &&
    bar.open > 0 && bar.low > 0 && bar.high >= Math.max(bar.open,bar.close,bar.low) &&
    bar.low <= Math.min(bar.open,bar.close) && bar.close > 0 && bar.volume >= 0 &&
    bar.time * 1000 + 300000 <= nowMs).sort((a,b) => a.time-b.time);
  if (valid.length < 23) return { matched:false, reason:"INSUFFICIENT_BARS" };
  if (new Set(valid.map(bar=>bar.time)).size !== valid.length)
    return { matched:false, reason:"DUPLICATE_BARS" };
  const last = valid.at(-1);
  const jstDate = new Date(last.time*1000+9*3600000).toISOString().slice(0,10);
  if (jstDate !== tradeDate || nowMs-(last.time*1000+300000)>20*60000)
    return { matched:false, reason:"STALE_BARS" };
  const recent=valid.slice(-3);
  if (recent.some(bar=>new Date(bar.time*1000+9*3600000).toISOString().slice(0,10)!==tradeDate) ||
      recent[1].time-recent[0].time!==300 || recent[2].time-recent[1].time!==300)
    return { matched:false, reason:"NONCONTIGUOUS_BARS" };
  const average=rows=>rows.reduce((sum,bar)=>sum+bar.close,0)/rows.length;
  const middle=average(valid.slice(-20));
  const priorMiddle=average(valid.slice(-23,-3));
  const previousVolume=valid.slice(-6,-3).reduce((sum,bar)=>sum+bar.volume,0);
  const currentVolume=recent.reduce((sum,bar)=>sum+bar.volume,0);
  const volumeRatio=previousVolume>0?currentVolume/previousVolume:0;
  const sign=direction==="DOWN"?-1:1;
  const extreme=direction==="DOWN"?"high":"low";
  const matched=(recent[2].close-recent[1].close)*sign>0 &&
    (recent[1].close-recent[0].close)*sign>0 &&
    (recent[2][extreme]-recent[1][extreme])*sign>0 &&
    (recent[1][extreme]-recent[0][extreme])*sign>0 &&
    (last.close-middle)*sign>0 && (middle-priorMiddle)*sign>0 && volumeRatio>=1.2;
  return {matched,reason:matched?(direction==="DOWN"?"FALLING_CLOSES_HIGHS_MIDDLE_VOLUME":"RISING_CLOSES_LOWS_MIDDLE_VOLUME"):"CONDITIONS_NOT_MET",
    price:last.close,barTime:last.time,receivedAt:new Date(nowMs).toISOString(),middle,volumeRatio};
}

export function evaluateUptrend(bars, nowMs, tradeDate) {
  return evaluateTrend(bars, nowMs, tradeDate, "UP");
}
export function evaluateDowntrend(bars, nowMs, tradeDate) {
  return evaluateTrend(bars, nowMs, tradeDate, "DOWN");
}
