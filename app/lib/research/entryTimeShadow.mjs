/** Entry-time study: one frozen prior-day cohort, one shared same-day close.
 * Times are Japan market local; 5m bar OPEN is a hypothetical indicative fill,
 * not executable bid/ask. No market orders, predictions or model updates.
 */
export const ENTRY_TIME_SHADOW_VERSION = "PRIOR_DAY_TOP5_CLOSE_V1";
export const ENTRY_TIME_SLOTS = Object.freeze(["09:05", "09:30", "10:00", "11:00", "13:00", "14:00"]);
const zone = "Asia/Tokyo";

export function jstParts(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) throw Error("INVALID_BAR_TIME");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(d);
  const part = key => parts.find(p => p.type === key)?.value ?? "";
  return {date: part("year") + "-" + part("month") + "-" + part("day"),
    hhmm: part("hour") + ":" + part("minute"),
    minute: Number(part("hour")) * 60 + Number(part("minute"))};
}

const finitePositive = n => typeof n === "number" && Number.isFinite(n) && n > 0;

export function selectPriorDayCandidates(rows) {
  return rows.filter(row => /^[0-9]{4}$/.test(String(row.code)) &&
    Number.isFinite(Number(row.score)) && Number(row.score) >= 85 &&
    finitePositive(Number(row.price)))
    .sort((a,b) => Number(b.score)-Number(a.score) || String(a.code).localeCompare(String(b.code)))
    .slice(0,5).map((row,index) => ({
      code:String(row.code),name:String(row.name),score:Number(row.score),
      referencePrice:Number(row.price),rank:index+1
    }));
}

export function evaluateEntryTimes(tradeDate, candidate, candles) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(tradeDate)) throw Error("INVALID_TRADE_DATE");
  const bars = new Map();
  for (const bar of candles) {
    if (!Number.isFinite(bar.time)) continue;
    const at=jstParts(bar.time*1000);
    if(at.date!==tradeDate) continue;
    if (!bars.has(at.hhmm)) bars.set(at.hhmm,bar);
  }
  // 15:25-15:30 is the final five-minute segment of the TSE cash session.
  // Fail closed if closing evidence is not available; do not substitute
  // last recorded morning/intraday close or yesterday's daily close.
  const closingBar=bars.get("15:30") ?? bars.get("15:25") ?? null;
  const close=closingBar && finitePositive(closingBar.close) ? closingBar.close:null;
  const entries=ENTRY_TIME_SLOTS.map(time => {
    const bar=bars.get(time);
    const price=bar && finitePositive(bar.open) ? bar.open:null;
    const pct=price!==null && close!==null ? (close-price)/price*100:null;

    // Risk, not just closing profit: require EVERY five-minute low from the
    // hypothetical purchase through 15:25. Missing bars => unknown, not zero.
    // 11:30-12:25 is a scheduled lunch break; 15:30 auction close is reflected
    // through `close` without inventing an intrabar low.
    let minAfterEntry=null;
    let observedBars=0;
    let requiredBars=0;
    if(price!==null && close!==null && closingBar){
      const entryMinute=jstParts(bar.time*1000).minute;
      const closingMinute=Math.min(jstParts(closingBar.time*1000).minute,15*60+25);
      let coverage=true;
      for(const [start,end] of [[9*60,11*60+25],[12*60+30,15*60+25]]){
        for(let minute=start;minute<=end;minute+=5){
          if(minute<entryMinute || minute>closingMinute)continue;
          requiredBars++;
          const hhmm=String(Math.floor(minute/60)).padStart(2,"0")+":"+
            String(minute%60).padStart(2,"0");
          const check=bars.get(hhmm);
          if(!check||!finitePositive(check.low)){
            coverage=false;
            continue;
          }
          observedBars++;
          minAfterEntry=minAfterEntry===null?check.low:Math.min(minAfterEntry,check.low);
        }
      }
      if(!coverage||requiredBars===0||observedBars!==requiredBars){
        minAfterEntry=null;
      }else{
        minAfterEntry=Math.min(minAfterEntry,close);
      }
    }
    const adverse=minAfterEntry===null||price===null?null:Math.max(0,price-minAfterEntry);
    return {time,entryPrice:price,closePrice:close,
      returnPct:pct===null?null:Number(pct.toFixed(5)),
      pnl100:pct===null?null:Number(((close-price)*100).toFixed(2)),
      maxAdversePct:adverse===null?null:Number((-adverse/price*100).toFixed(5)),
      maxAdversePnl100:adverse===null?null:Number((-adverse*100).toFixed(2)),
      riskBarsRequired:requiredBars,riskBarsObserved:observedBars};
  });
  const complete=close!==null && entries.every(e=>e.entryPrice!==null);
  return {code:candidate.code,name:candidate.name,rank:candidate.rank,
    priorScore:candidate.score,priorReferencePrice:candidate.referencePrice,
    date:tradeDate,closePrice:close,complete,entries};
}

export function summarizeEntryTimes(rows) {
  // Complete-case comparison: precisely the same candidate stocks contribute
  // to every time bucket; incomplete days are excluded, not counted as losses.
  const eligible=rows.filter(r=>r.complete && Array.isArray(r.entries) &&
    ENTRY_TIME_SLOTS.every(slot=>r.entries.some(e=>e.time===slot&&Number.isFinite(e.returnPct))));
  return ENTRY_TIME_SLOTS.map(time=>{
    const entries=eligible.map(r=>r.entries.find(e=>e.time===time));
    const n=entries.length;
    const mean=n?entries.reduce((a,e)=>a+e.returnPct,0)/n:null;
    const avg100=n?entries.reduce((a,e)=>a+e.pnl100,0)/n:null;
    return {time,samples:n,winRate:n?100*entries.filter(e=>e.returnPct>0).length/n:null,
      meanReturn:mean,worstReturn:n?Math.min(...entries.map(e=>e.returnPct)):null,
      avgHundredSharePnl:avg100,missedGain:n?entries.filter(e=>e.returnPct>0).length:0};
  });
}

/** Paired early-vs-wait comparison: same dates, same stocks, same close.
 * A positive `earlyAdvantage100` means buying early cost less than waiting.
 * It does NOT account for different holding durations or transaction costs.
 */
export function compareEarlyVsWait(rows,earlyTime="09:05",lateTime="11:00"){
  if(!ENTRY_TIME_SLOTS.includes(earlyTime)||!ENTRY_TIME_SLOTS.includes(lateTime)||
    ENTRY_TIME_SLOTS.indexOf(earlyTime)>=ENTRY_TIME_SLOTS.indexOf(lateTime)){
    throw Error("INVALID_TIME_PAIR");
  }
  const complete=rows.filter(r=>r.complete&&Array.isArray(r.entries)&&
    ENTRY_TIME_SLOTS.every(slot=>r.entries.some(e=>e.time===slot&&
      Number.isFinite(e.entryPrice)&&Number.isFinite(e.pnl100))));
  const pairs=complete.map(r=>{
    const early=r.entries.find(e=>e.time===earlyTime);
    const late=r.entries.find(e=>e.time===lateTime);
    const earlyAdvantage100=Number(((late.entryPrice-early.entryPrice)*100).toFixed(2));
    return {date:r.date,code:r.code,name:r.name,
      earlyEntry:early.entryPrice,lateEntry:late.entryPrice,closePrice:r.closePrice,
      earlyPnl100:early.pnl100,latePnl100:late.pnl100,
      earlyAdvantage100,earlyWin:early.pnl100>0,lateWin:late.pnl100>0};
  });
  const n=pairs.length;
  const sum=f=>pairs.reduce((a,r)=>a+f(r),0);
  return {earlyTime,lateTime,samples:n,days:new Set(pairs.map(p=>p.date)).size,
    earlyWins:sum(p=>p.earlyWin?1:0),lateWins:sum(p=>p.lateWin?1:0),
    earlyOnlyWins:sum(p=>p.earlyWin&&!p.lateWin?1:0),
    lateOnlyWins:sum(p=>!p.earlyWin&&p.lateWin?1:0),
    waitCheaper:sum(p=>p.earlyAdvantage100<0?1:0),
    earlyCheaper:sum(p=>p.earlyAdvantage100>0?1:0),
    equalPrice:sum(p=>p.earlyAdvantage100===0?1:0),
    avgEarlyPnl100:n?sum(p=>p.earlyPnl100)/n:null,
    avgLatePnl100:n?sum(p=>p.latePnl100)/n:null,
    avgEarlyAdvantage100:n?sum(p=>p.earlyAdvantage100)/n:null,
    pairs};
}

/** Post-purchase maximum adverse excursions, available only for fully
 * observed five-minute lows in NEW archives. Historic rows remain unknown.
 */
export function summarizeEntryRisk(rows){
  const eligible=rows.filter(r=>r.complete&&Array.isArray(r.entries)&&
    ENTRY_TIME_SLOTS.every(t=>r.entries.some(e=>e.time===t&&
      Number.isFinite(e.maxAdversePct))));
  return ENTRY_TIME_SLOTS.map(time=>{
    const points=eligible.map(r=>r.entries.find(e=>e.time===time));
    const n=points.length;
    return {time,samples:n,
      avgMaxAdversePct:n?points.reduce((a,e)=>a+e.maxAdversePct,0)/n:null,
      worstMaxAdversePct:n?Math.min(...points.map(p=>p.maxAdversePct)):null,
      avgMaxAdversePnl100:n?points.reduce((a,e)=>a+e.maxAdversePnl100,0)/n:null};
  });
}
