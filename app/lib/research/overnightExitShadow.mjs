/**
 * Research-only overnight limit -> next-session exit simulation.
 * No broker access, orders, database writes, cron or notifications.
 * Candle timestamps are BAR START in JST. A 09:20 exit uses the 09:20
 * bar's OPEN, not its close (which would leak future information).
 * This is an indicative backtest, not a fill guarantee.
 */
export const EXIT_TIMES = ["09:05","09:10","09:20","09:30","10:00","11:00","14:00","15:20"];
const JST = new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit"});
function stamp(seconds) {
  const p=Object.fromEntries(JST.formatToParts(new Date(seconds*1000)).map(x=>[x.type,x.value]));
  return {day:`${p.year}-${p.month}-${p.day}`,minute:`${p.hour}:${p.minute}`};
}
const valid=n=>typeof n==="number"&&Number.isFinite(n)&&n>0;
export function evaluateOvernightExit({tradeDate,limitYen,shares=100,candles,exitTimes=EXIT_TIMES}) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(tradeDate||"")||!valid(limitYen)||!Number.isInteger(shares)||shares<=0||!Array.isArray(candles)) {
    return {status:"INVALID_INPUT",exits:[]};
  }
  const bars=candles.filter(c=>c&&Number.isFinite(c.time)&&[c.open,c.high,c.low,c.close].every(valid)&&c.low<=c.high&&c.open>=c.low&&c.open<=c.high&&c.close>=c.low&&c.close<=c.high)
    .map(c=>({...c,...stamp(c.time)})).filter(c=>c.day===tradeDate&&c.minute>="09:00"&&c.minute<="15:25")
    .sort((a,b)=>a.time-b.time);
  const first=bars.find(b=>b.minute==="09:00");
  if(!first)return {status:"MISSING_OPEN_BAR",exits:[]};
  // At the opening auction a buy limit at/above the opening price is potentially executable.
  // Actual queue priority, SOR routing and fills cannot be proven from OHLC.
  if(first.open>limitYen)return {status:"OPEN_ABOVE_LIMIT_UNVERIFIED",exits:[]};
  const entryYen=first.open;
  const exits=exitTimes.map(time=>{
    const bar=bars.find(b=>b.minute===time);
    if(!bar)return {time,status:"MISSING_BAR",exitYen:null,pnlYen:null};
    // A bar open is a reference price, NOT a guaranteed market order fill.
    return {time,status:"INDICATIVE",exitYen:bar.open,pnlYen:Math.round((bar.open-entryYen)*shares)};
  });
  return {status:"POTENTIAL_OPEN_FILL",entryYen,shares,limitYen,exits,
    caveat:"Opening execution and exit prices are indicative; slippage, fees, taxes and actual order status are excluded."};
}
