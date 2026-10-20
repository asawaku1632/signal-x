/** Isolated forward-only pre-open market context, never a BUY model. */
import {jstParts} from "./entryTimeShadow.mjs";
import {interpretOpeningGap} from "./morningExternalContext.mjs";

export const MARKET_FORWARD_POLICY="PREOPEN_US_FX_GAP_V1";
export const MARKET_FORWARD_MIN_STOCK_DAYS=30;
export const MARKET_FORWARD_MIN_DAYS=10;
export const MARKET_FORWARD_GROUP_MIN_STOCK_DAYS=12;
export const MARKET_FORWARD_GROUP_MIN_DAYS=5;
export const MARKET_SNAPSHOT_TIME_START=8*60+40;
export const MARKET_SNAPSHOT_TIME_END=8*60+55;

const positive=n=>typeof n==="number"&&Number.isFinite(n)&&n>0;
const dateFormat= /^\d{4}-\d{2}-\d{2}$/;

export function preopenGate(now,isTradingDate){
  if(typeof isTradingDate!=="function")throw Error("TRADING_CALENDAR_REQUIRED");
  const date=jstParts(now);
  if(!isTradingDate(date.date))return {ok:false,reason:"MARKET_CLOSED",date:date.date};
  if(date.minute<MARKET_SNAPSHOT_TIME_START||date.minute>=MARKET_SNAPSHOT_TIME_END)
    return {ok:false,reason:"OUTSIDE_PREOPEN_WINDOW",date:date.date};
  return {ok:true,date:date.date};
}

export function parsePreopenQuote(payload,zone,now=new Date()){
  const rows=payload?.chart?.result?.[0];
  const timestamps=rows?.timestamp,closes=rows?.indicators?.quote?.[0]?.close;
  if(!Array.isArray(timestamps)||!Array.isArray(closes))return null;
  const end=now.getTime();
  const points=[];
  for(let i=0;i<Math.min(timestamps.length,closes.length);i++){
    const time=Number(timestamps[i])*1000,price=closes[i];
    if(!positive(price)||!Number.isFinite(time)||time<1_000_000_000_000||time>end)continue;
    points.push({time,price});
  }
  points.sort((a,b)=>a.time-b.time);
  if(points.length<2)return null;
  const latest=points[points.length-1],prior=points[points.length-2];
  if(latest.time<=prior.time)return null;
  const local=new Intl.DateTimeFormat("en-CA",{
    timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"
  }).format(new Date(latest.time));
  const age=end-latest.time;
  return {price:Number(latest.price.toFixed(4)),
    changePct:Number(((latest.price/prior.price-1)*100).toFixed(3)),
    quoteDate:local,sourceTimestamp:new Date(latest.time).toISOString(),
    state:age>5*86_400_000?"STALE":"REFERENCE"};
}

function validQuotes(market){
  if(!market||typeof market!=="object")return null;
  const get=key=>{
    const q=market[key];
    if(!q||q.state!=="REFERENCE"||!positive(q.price)||
      typeof q.changePct!=="number"||!Number.isFinite(q.changePct)||
      !dateFormat.test(q.quoteDate??"")||!Number.isFinite(Date.parse(q.sourceTimestamp??"")))
      return null;
    return q;
  };
  const dow=get("dow"),nasdaq=get("nasdaq"),usdJpy=get("usdJpy");
  return dow&&nasdaq&&usdJpy?{dow,nasdaq,usdJpy}:null;
}

export function marketBands(market){
  const m=validQuotes(market);
  if(!m)return null;
  const us=m.dow.changePct>=0.2&&m.nasdaq.changePct>=0.2?"US_UP":
    m.dow.changePct<=-0.2&&m.nasdaq.changePct<=-0.2?"US_DOWN":"US_MIXED";
  // USD/JPY rising = JPY weakening, not "yen strengthening."
  const fx=m.usdJpy.changePct>=0.15?"YEN_WEAKER":
    m.usdJpy.changePct<=-0.15?"YEN_STRONGER":"FX_FLAT";
  return {us,fx};
}

function snapshotIsPreopen(row,date){
  if(row?.trade_date!==date||row?.policy_version!==MARKET_FORWARD_POLICY||
    !["COMPLETE","PARTIAL"].includes(row?.state))return false;
  const time=Date.parse(row.captured_at??"");
  if(!Number.isFinite(time))return false;
  const j=jstParts(time);
  return j.date===date && j.minute>=MARKET_SNAPSHOT_TIME_START &&
    j.minute<MARKET_SNAPSHOT_TIME_END;
}
function validOrder(snapshot,run){
  const t0=Date.parse(snapshot.captured_at??""),
    t1=Date.parse(run.morning_saved_at??""),
    t2=Date.parse(run.closing_saved_at??"");
  return Number.isFinite(t0)&&Number.isFinite(t1)&&Number.isFinite(t2)&&
    t0<t1&&t1<t2;
}
const LABEL={
  US_UP:"米国株・両指数上昇",US_DOWN:"米国株・両指数下落",
  US_MIXED:"米国株・方向混在",YEN_WEAKER:"円安方向",YEN_STRONGER:"円高方向",
  FX_FLAT:"為替小動き",DOWN_REBOUND:"安寄り→5分反発",
  DOWN_CONTINUES:"安寄り→5分続落",DOWN_UNCLEAR:"安寄り→方向未定",
  UP:"高寄り",FLAT:"ほぼ同水準"
};

/** Strict as-of joins: no historic market-data download, no post-close reclassification. */
export function summarizeMorningMarketForward(snapshots,runs){
  const byDate=new Map((Array.isArray(runs)?runs:[]).map(r=>[r.trade_date,r]));
  const seen=new Set(),pairs=[];
  let capturedDays=0;
  for(const snap of Array.isArray(snapshots)?snapshots:[]){
    const date=String(snap?.trade_date??"");
    if(!dateFormat.test(date)||!snapshotIsPreopen(snap,date))continue;
    capturedDays++;
    const run=byDate.get(date),bands=marketBands(snap.quotes);
    if(!run||!bands||!validOrder(snap,run))continue;
    const entry=new Map((Array.isArray(run.morning_observations)?
      run.morning_observations:[]).map(x=>[String(x.code),x]));
    const closing=new Map((Array.isArray(run.closing_results)?
      run.closing_results:[]).map(x=>[String(x.code),x]));
    for(const frozen of Array.isArray(run.cohort)?run.cohort:[]){
      const code=String(frozen.code??"");
      const id=date+":"+code;
      if(!/^\d{4}$/.test(code)||seen.has(id))continue;
      const morning=entry.get(code),end=closing.get(code);
      if(!morning||!end||end.complete!==true||morning.label==="UNAVAILABLE"||
        !["BUY_CANDIDATE","CAUTION","SKIP"].includes(morning.label)||
        morning.label!==end.label||!positive(morning.price0905)||
        !positive(end.observedEntry)||!positive(end.closePrice)||
        !Number.isFinite(end.pnl100)||
        Math.abs(morning.price0905-end.observedEntry)>0.001)continue;
      const open=interpretOpeningGap(Number(frozen.referencePrice),
        morning.open0900,morning.price0905);
      if(!open)continue;
      seen.add(id);
      pairs.push({date,code,us:bands.us,fx:bands.fx,opening:open.state,
        combo:bands.us+"|"+bands.fx+"|"+open.state,
        pnl100:end.pnl100,positive:end.pnl100>0});
    }
  }
  const days=new Set(pairs.map(p=>p.date)).size;
  const sufficient=days>=MARKET_FORWARD_MIN_DAYS &&
    pairs.length>=MARKET_FORWARD_MIN_STOCK_DAYS;
  const groups=[];
  for(const [type,keyFn] of [
    ["us",p=>p.us],["fx",p=>p.fx],["opening",p=>p.opening],["combo",p=>p.combo]
  ]){
    const map=new Map();
    for(const item of pairs){
      const k=keyFn(item);
      if(!map.has(k))map.set(k,[]);
      map.get(k).push(item);
    }
    for(const [key,items] of map){
      const n=items.length,distinctDays=new Set(items.map(x=>x.date)).size;
      const enough=sufficient && n>=MARKET_FORWARD_GROUP_MIN_STOCK_DAYS &&
        distinctDays>=MARKET_FORWARD_GROUP_MIN_DAYS;
      groups.push({type,key,
        label:type==="combo"?key.split("|").map(k=>LABEL[k]??k).join(" × "):LABEL[key]??key,
        samples:n,days:distinctDays,sufficient:enough,
        winRate:enough?100*items.filter(x=>x.positive).length/n:null,
        averagePnl100:enough?items.reduce((a,x)=>a+x.pnl100,0)/n:null});
    }
  }
  return {capturedDays,pairs:pairs.length,days,sufficient,groups};
}
