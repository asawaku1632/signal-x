/**
 * CRASH_FORWARD_CAPTURE_V1: observational research only.
 * Deliberately has no market requests, DB writes, notifications or orders.
 * Inputs must be already-saved stock reference closes and settled index bars.
 */
export const CRASH_FORWARD_VERSION="CRASH_FORWARD_CAPTURE_V1";
export const CRASH_THRESHOLD=-2;
export const MIN_DAILY_UNIVERSE=800;
export const MAX_CAPTURE_PER_GROUP=20;
const round=x=>Math.round(x*10000)/10000;
const positive=x=>x!==null&&x!==""&&Number.isFinite(Number(x))&&Number(x)>0;
const validDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const returnPct=(start,end)=>round(100*(Number(end)/Number(start)-1));

/** The cron runs after daily stock-save has finished, not at market open. */
export function jstClock(now) {
  const instant=now instanceof Date?now:new Date(now);
  if(!Number.isFinite(instant.getTime()))throw Error("INVALID_CLOCK");
  const p=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(instant);
  const v=k=>p.find(x=>x.type===k)?.value??"";
  return {date:v("year")+"-"+v("month")+"-"+v("day"),
    minutes:Number(v("hour"))*60+Number(v("minute"))};
}
export function selectSessions(marketRows) {
  const rows=new Map();
  for(const row of marketRows) {
    const date=String(row.date??"").slice(0,10);
    if(!validDate(date))continue;
    if(new Date(date+"T00:00:00Z").getUTCDay()%6===0)continue;
    const close=Number(row.nikkei);
    if(!positive(row.nikkei))continue; // No TOPIX fallback for this pilot
    rows.set(date,{date,nikkei:close});
  }
  return [...rows.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
function stocksForDate(priceRows,date) {
  const rows=new Map();
  for(const row of priceRows) {
    if(String(row.date??"").slice(0,10)!==date)continue;
    const code=String(row.code??"");
    if(!/^\d{4}$/.test(code)||!positive(row.price))continue;
    if(!rows.has(code))rows.set(code,{code,name:String(row.name||code),
      price:Number(row.price)});
  }
  return rows;
}
export function captureFrozenCrash({marketRows,priceRows,now}) {
  const clock=jstClock(now);
  if(clock.minutes<16*60+45||clock.minutes>=21*60)
    return {status:"SKIPPED",reason:"OUTSIDE_SETTLED_SESSION_WINDOW"};
  // Ignore any bars dated AFTER the actual invocation day: strict no-lookahead.
  const sessions=selectSessions(marketRows).filter(x=>x.date<=clock.date);
  const latest=sessions.at(-1);
  if(!latest||latest.date!==clock.date)
    return {status:"SKIPPED",reason:"NO_TODAY_SETTLED_INDEX_BAR"};
  const prior=sessions.at(-2);
  if(!prior||(Date.parse(latest.date)-Date.parse(prior.date))/86400000>6)
    return {status:"SKIPPED",reason:"NO_ADJACENT_TRADING_SESSION"};
  const benchmarkReturn=returnPct(prior.nikkei,latest.nikkei);
  if(benchmarkReturn>CRASH_THRESHOLD)
    return {status:"SKIPPED",reason:"NOT_MARKET_CRASH",benchmarkReturn};
  const previous=stocksForDate(priceRows,prior.date);
  const current=stocksForDate(priceRows,latest.date);
  if(previous.size<MIN_DAILY_UNIVERSE||current.size<MIN_DAILY_UNIVERSE)
    return {status:"SKIPPED",reason:"INCOMPLETE_STOCK_SNAPSHOT",
      previousCount:previous.size,currentCount:current.size};
  const comparable=[...current.values()].flatMap(stock=>{
    const base=previous.get(stock.code);
    if(!base)return [];
    const dailyReturn=returnPct(base.price,stock.price);
    return [{...stock,priorPrice:base.price,dailyReturn,
      relativeReturn:round(dailyReturn-benchmarkReturn),cost100:round(stock.price*100)}];
  });
  if(comparable.length<MIN_DAILY_UNIVERSE)
    return {status:"SKIPPED",reason:"INSUFFICIENT_PAIRED_STOCKS",count:comparable.length};
  const resistance=[...comparable].filter(x=>x.relativeReturn>=1.5)
    .sort((a,b)=>b.relativeReturn-a.relativeReturn||b.dailyReturn-a.dailyReturn||a.code.localeCompare(b.code))
    .slice(0,MAX_CAPTURE_PER_GROUP).map((x,i)=>({...x,rank:i+1,kind:"RESISTANCE"}));
  const rebound=[...comparable].filter(x=>x.dailyReturn<=-5&&x.relativeReturn<=-3)
    .sort((a,b)=>a.relativeReturn-b.relativeReturn||a.dailyReturn-b.dailyReturn||a.code.localeCompare(b.code))
    .slice(0,MAX_CAPTURE_PER_GROUP).map((x,i)=>({...x,rank:i+1,kind:"REBOUND_WATCH"}));
  return {status:"READY",date:clock.date,previousDate:prior.date,
    nikkeiClose:latest.nikkei,nikkeiPriorClose:prior.nikkei,benchmarkReturn,
    previousCount:previous.size,currentCount:current.size,comparableCount:comparable.length,
    groups:{RESISTANCE:resistance,REBOUND_WATCH:rebound},version:CRASH_FORWARD_VERSION};
}
/**
 * Only the immediate next *index* trading session qualifies as next-day evidence.
 * Never substitute a following later stock-save day if the expected day is missing.
 */
export function evaluateFrozenCandidates({snapshot,marketRows,priceRows,asOfDate}) {
  const sessions=selectSessions(marketRows);
  const index=sessions.findIndex(x=>x.date===snapshot.date);
  if(index<0||!sessions[index+1])
    return {status:"PENDING",reason:"NEXT_INDEX_SESSION_UNAVAILABLE"};
  const next=sessions[index+1];
  if(next.date>asOfDate)
    return {status:"PENDING",reason:"FUTURE_NEXT_SESSION"};
  const marketNext=returnPct(snapshot.nikkeiClose,next.nikkei);
  const actual=stocksForDate(priceRows,next.date);
  if(actual.size<MIN_DAILY_UNIVERSE)
    return {status:"PENDING",reason:"NEXT_STOCK_SNAPSHOT_INCOMPLETE",
      nextSessionDate:next.date,coverage:actual.size};
  const candidates=[...snapshot.groups.RESISTANCE,...snapshot.groups.REBOUND_WATCH];
  return {status:"READY",nextSessionDate:next.date,benchmarkReturn:marketNext,
    outcomes:candidates.map(item=>{
      const future=actual.get(item.code);
      if(!future)return {kind:item.kind,code:item.code,rank:item.rank,
        status:"MISSING_PRICE",nextPrice:null,return1:null,excess1:null,beatMarket:null};
      const return1=returnPct(item.price,future.price);
      const excess1=round(return1-marketNext);
      const needsReview=Math.abs(return1)>40||
        Math.abs(item.dailyReturn)>40;
      return {kind:item.kind,code:item.code,rank:item.rank,
        status:needsReview?"REVIEW_PRICE_JUMP":"OBSERVED",
        nextPrice:future.price,return1,excess1,
        beatMarket:needsReview?null:return1>marketNext,
      };
    })};
}
export function shouldRunCrashForwardOnHost(host,environment) {
  if(environment!=="production")return false;
  const name=String(host??"").toLowerCase();
  return name==="signal-x-ppjg.vercel.app"||
    /^signal-x-ppjg-[a-z0-9]+-signalx-runner-v2-trial2\.vercel\.app$/.test(name);
}
