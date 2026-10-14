import "server-only";
import { getForwardCandles } from "@/app/lib/emaForwardShadowStore";
import { resolveTargetTradeDate, isTseTradingDate, TSE_MARKET_CALENDAR_COVERAGE,
  TSE_MARKET_CALENDAR_VERSION } from "@/app/lib/technicalObservation/tseMarketCalendar";
import {studyCompletedArchiveCohort} from "./bollingerBreakoutQuality.mjs";

const PILOT_CODES = ["9984","3762"] as const;
const FIRST_VALID_DATE = "2026-01-01";
const maxIterations = 400;

const dateJst = (seconds: number) =>
  new Date(seconds*1000).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});

function completeTseDates(first: string,last: string) {
  if(first<TSE_MARKET_CALENDAR_COVERAGE.startDate || last>TSE_MARKET_CALENDAR_COVERAGE.endDate) {
    throw new Error("MARKET_CALENDAR_OUTSIDE_COVERAGE");
  }
  const list:string[]=[];
  let d=Date.parse(first+"T00:00:00Z");
  const end=Date.parse(last+"T00:00:00Z");
  for(let n=0;d<=end&&n<maxIterations;n++,d+=86400000) {
    const iso=new Date(d).toISOString().slice(0,10);
    if(isTseTradingDate(iso))list.push(iso);
  }
  if(d<=end)throw new Error("CALENDAR_ITERATION_CAP");
  return list;
}
/** Called only behind an owner-verified POST route. Exactly two existing
 * Yahoo lookups, no retries, no SQL, no archive writes and no background work.
 */
export async function runBollingerReadOnlyPilot(now=new Date()) {
  const target=resolveTargetTradeDate(now).targetTradeDate;
  const loaded = await Promise.allSettled(PILOT_CODES.map(code=>getForwardCandles(code)));
  const reasons:string[]=[];
  const inputs=loaded.map((result,i)=>{
    const code=PILOT_CODES[i];
    if(result.status!=="fulfilled"){reasons.push(code+":PRICE_SOURCE_UNAVAILABLE");return null;}
    const source=result.value;
    if(source.code!==code){reasons.push(code+":SOURCE_CODE_MISMATCH");return null;}
    const candles=source.candles.filter(bar=>{
      const date=dateJst(bar.time);
      return date>=FIRST_VALID_DATE&&date<=target;
    });
    if(!candles.length||dateJst(candles.at(-1)!.time)!==target) {
      reasons.push(code+":CURRENT_COMPLETED_BAR_UNAVAILABLE");return null;
    }
    const first=dateJst(candles[0].time);
    let expectedTradingDates:string[];
    try {expectedTradingDates=completeTseDates(first,target);}
    catch {reasons.push(code+":CALENDAR_UNAVAILABLE");return null;}
    return {code,provider:"YAHOO_CHART",timeframe:"1D",
      candles,splitEvents:[...source.splitEvents].sort((a,b)=>a-b),
      expectedTradingDates,asOfCompletedJstDate:target};
  });
  if(reasons.length||inputs.some(x=>!x))
    return {status:"DATA_QUALITY_REJECTED",targetDate:target,
      calendarVersion:TSE_MARKET_CALENDAR_VERSION,reasons,summary:null};
  const report=studyCompletedArchiveCohort(inputs.filter((x):x is NonNullable<typeof x>=>x!==null));
  return {status:report.status,targetDate:target,
    calendarVersion:TSE_MARKET_CALENDAR_VERSION,reasons,report};
}
