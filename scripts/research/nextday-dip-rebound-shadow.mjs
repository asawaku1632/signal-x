// Research-only, pure, offline. No database, network, orders or notifications.
// Input: { signals:[{code,signalDate,signalAt,referencePrice}], bars:[{code,date,time,open,high,low,close}] }
// Bars: completed 5-minute JST candles, time is START (HH:mm).
// A 09:20 decision uses the 09:15 candle close; an 11:20 decision uses 11:15.
// Signal events must have been captured no later than their signal date's close.
export function analyzeDipRebound({signals,bars}, {entryTime="09:20", horizon=5, threshold=3}={}) {
  if(!["09:20","11:20"].includes(entryTime)) throw Error("Unsupported decision time");
  if(!Number.isInteger(horizon)||horizon<2||horizon>5) throw Error("Invalid horizon");
  const start=entryTime==="09:20"?"09:15":"11:15";
  const rows=[], excluded=[];
  const grouped=new Map();
  for(const b of bars) {
    if(!b.code||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!/^\d{2}:\d{2}$/.test(b.time)||
      ![b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0)||
      b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close,b.high)) throw Error("Invalid OHLC bar");
    const key=b.code+"|"+b.date;
    if(!grouped.has(key)) grouped.set(key,[]);
    if(grouped.get(key).some(x=>x.time===b.time)) throw Error("Duplicate minute bar: "+key+" "+b.time);
    grouped.get(key).push(b);
  }
  const daysByCode=new Map();
  for(const key of grouped.keys()) {
    const [code,date]=key.split("|");
    if(!daysByCode.has(code)) daysByCode.set(code,new Set());
    daysByCode.get(code).add(date);
  }
  for(const s of signals) {
    const reject=(reason)=>excluded.push({code:s.code,signalDate:s.signalDate,reason});
    if(!s.code||!/^\d{4}-\d{2}-\d{2}$/.test(s.signalDate)||
      !Number.isFinite(s.referencePrice)||s.referencePrice<=0||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s.signalAt||"")||
      s.signalAt.slice(0,10)!==s.signalDate) {reject("INVALID_OR_UNTIMED_SIGNAL");continue;}
    const dates=[...(daysByCode.get(s.code)||[])].sort();
    const idx=dates.indexOf(s.signalDate);
    if(idx<0||idx+horizon>=dates.length) {reject("MISSING_SIGNAL_DAY_OR_FUTURE_SESSIONS");continue;}
    const nextDate=dates[idx+1];
    const entry=(grouped.get(s.code+"|"+nextDate)||[]).find(b=>b.time===start);
    if(!entry) {reject("MISSING_ENTRY_BAR");continue;}
    const entryPrice=entry.close;
    const dipPercent=100*(entryPrice/s.referencePrice-1);
    let highs=[],lows=[];
    for(let i=2;i<=horizon;i++) {
      const session=grouped.get(s.code+"|"+dates[idx+i])||[];
      if(!session.length) {reject("MISSING_FUTURE_BARS");highs=[];break;}
      highs.push(Math.max(...session.map(b=>b.high)));
      lows.push(Math.min(...session.map(b=>b.low)));
    }
    if(!highs.length) continue;
    const maxHigh=Math.max(...highs),minLow=Math.min(...lows);
    rows.push({code:s.code,signalDate:s.signalDate,nextDate,entryTime,entryPrice,
      dipPercent,down:dipPercent<0,maxHigh,maxLow:minLow,
      maxReturnPercent:100*(maxHigh/entryPrice-1),
      worstReturnPercent:100*(minLow/entryPrice-1),
      targetHit:maxHigh>=entryPrice*(1+threshold/100),
      // Reaching a daily high is not evidence of a fill.
      outcomeKind:"HIGH_TOUCHED_NOT_EXECUTION"});
  }
  const down=rows.filter(r=>r.down);
  return {version:"NEXTDAY_DIP_SHADOW_V1",entryTime,horizon,threshold,
    totalSignals:signals.length,eligible:rows.length,downCount:down.length,
    targetCount:down.filter(r=>r.targetHit).length,
    targetRate:down.length?100*down.filter(r=>r.targetHit).length/down.length:null,
    rows,excluded,eligibleForTrading:false,eligibleForProduction:false};
}
