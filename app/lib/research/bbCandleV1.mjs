/**
 * BB_CANDLE_V1: offline, research-only hypotheses.
 * No network, database, notifications, trade decisions, production imports.
 * Caller supplies strictly ascending COMPLETED OHLC candles from one timeframe.
 * Signals are known only after the signal bar closes; no lookahead.
 * These thresholds are NOT the proprietary BB ScalEX formula.
 */
export const BB_CANDLE_VERSION = "BB_CANDLE_V1";
const PERIOD = 20;
const TYPES = ["MARUBOZU", "PIN_BAR", "ENGULFING", "DOJI_BREAK"];
const valid = c => c && Number.isFinite(c.time) &&
  [c.open,c.high,c.low,c.close].every(v => Number.isFinite(v) && v > 0) &&
  c.high >= Math.max(c.open,c.close,c.low) && c.low <= Math.min(c.open,c.close);
const body = c => Math.abs(c.close-c.open);
const range = c => c.high-c.low;
const mid = c => (c.open+c.close)/2;
function bands(candles, end) {
  if (end < PERIOD) return null;
  const closes = candles.slice(end-PERIOD,end).map(c=>c.close);
  const m = closes.reduce((a,b)=>a+b,0)/PERIOD;
  const sd = Math.sqrt(closes.reduce((a,b)=>a+(b-m)**2,0)/PERIOD);
  if (sd <= 0) return null;
  return { middle:m, upper:m+2*sd, lower:m-2*sd, width:4*sd/m };
}
export function detectBbCandleV1(candles, options={}) {
  if (!Array.isArray(candles) || candles.some((c,i)=> !valid(c) || (i>0 && c.time <= candles[i-1].time))) {
    throw new Error("INVALID_COMPLETE_CANDLE_SERIES");
  }
  const minWidth = options.minWidth ?? 0.004;
  if (!Number.isFinite(minWidth) || minWidth < 0) throw new Error("INVALID_WIDTH");
  const hits=[];
  for (let i=PERIOD; i<candles.length; i++) {
    const c=candles[i], prev=candles[i-1], b=bands(candles,i+1), old=bands(candles,i);
    if (!b || !old) continue;
    // Width expansion and middle direction are explicit V1 hypotheses.
    const expanding=b.width>old.width && b.width>=minWidth;
    const up=expanding && b.middle>old.middle && c.close>b.upper;
    const down=expanding && b.middle<old.middle && c.close<b.lower;
    const trend=up?"UP":down?"DOWN":"RANGE";
    const r=range(c), pr=range(prev);
    if (r<=0 || pr<=0) continue;
    const bullish=c.close>c.open, bearish=c.close<c.open;
    const longUpper=(c.high-Math.max(c.open,c.close))/r;
    const longLower=(Math.min(c.open,c.close)-c.low)/r;
    const pattern=[];
    if (body(c)/r>=0.8 && (up&&bullish || down&&bearish)) pattern.push("MARUBOZU");
    if (body(c)/r<=0.35 && (up&&bullish&&longLower>=0.55 || down&&bearish&&longUpper>=0.55)) pattern.push("PIN_BAR");
    if (up&&bullish&&prev.close<prev.open&&c.open<=prev.close&&c.close>=prev.open ||
        down&&bearish&&prev.close>prev.open&&c.open>=prev.close&&c.close<=prev.open)
      pattern.push("ENGULFING");
    if (body(prev)/pr<=0.1 && (up&&c.close>prev.high || down&&c.close<prev.low))
      pattern.push("DOJI_BREAK");
    for(const type of pattern) {
      hits.push({version:BB_CANDLE_VERSION,index:i,time:c.time,type,
        direction:up?"BUY":"SELL",trend,signalClose:c.close,
        bbWidth:b.width,bbMiddle:b.middle,bbUpper:b.upper,bbLower:b.lower});
    }
  }
  return hits;
}
/** Outcome is hypothetical close-to-close; not an executable next-bar fill. */
export function evaluateBbCandleV1(candles, hits, horizons=[1,3,5]) {
  return TYPES.map(type=>({
    type,
    horizons:horizons.map(h=>{
      if (!Number.isInteger(h)||h<1) throw new Error("INVALID_HORIZON");
      const values=hits.filter(x=>x.type===type && candles[x.index+h]).map(x=>{
        const result=(candles[x.index+h].close/x.signalClose-1)*100;
        return x.direction==="BUY"?result:-result;
      });
      return {horizon:h,completed:values.length,
        meanDirectionalReturnPct:values.length>=30?values.reduce((a,b)=>a+b,0)/values.length:null,
        winRatePct:values.length>=30?100*values.filter(v=>v>0).length/values.length:null};
    })
  }));
}
