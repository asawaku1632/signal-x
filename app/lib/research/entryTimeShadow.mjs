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
  const closingBar=bars.get("15:25") ?? bars.get("15:30") ?? null;
  const close=closingBar && finitePositive(closingBar.close) ? closingBar.close:null;
  const entries=ENTRY_TIME_SLOTS.map(time => {
    const bar=bars.get(time);
    const price=bar && finitePositive(bar.open) ? bar.open:null;
    const pct=price!==null && close!==null ? (close-price)/price*100:null;
    return {time,entryPrice:price,closePrice:close,
      returnPct:pct===null?null:Number(pct.toFixed(5)),
      pnl100:pct===null?null:Number(((close-price)*100).toFixed(2))};
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
