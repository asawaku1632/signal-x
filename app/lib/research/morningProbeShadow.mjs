/**
 * Intraday research-only five-minute availability evidence.
 * Do not backfill a missed 09:08 BUY/SKIP classification with later data.
 * Yahoo bar timestamps denote bar START; OHLC can only be used once complete.
 * A completed bar remains INDICATIVE, never an executable bid/ask quote.
 */
import {jstParts} from "./entryTimeShadow.mjs";
import {isJpxStockCode} from "./jpxStockCode.mjs";

export const MORNING_PROBE_POLICY="MORNING_0915_0930_AVAILABILITY_SHADOW_V1";
export const MORNING_PROBE_SLOTS=Object.freeze(["09:15","09:20","09:25","09:30"]);
const positive=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
const validVolume=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0;
const dateValid=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+"T00:00:00Z"))&&
  new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const timestamp=x=>new Date(x).getTime();
const hhmm=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const timeIndex=x=>Number(x.slice(0,2))*60+Number(x.slice(3));
const bucket=(parts)=>{
  const m=parts.minute;
  return m>=555&&m<575?hhmm(Math.floor(m/5)*5):null;
};
const completePriceBar=b=>!!b&&positive(b.open)&&positive(b.high)&&positive(b.low)&&
  positive(b.close)&&validVolume(b.volume)&&b.low<=Math.min(b.open,b.close)&&
  b.high>=Math.max(b.open,b.close)&&b.high>=b.low;

export function probeSlotAt(at) {
  const parts=jstParts(at);
  const slot=bucket(parts);
  return {date:parts.date,slot,allowed:slot!==null};
}

/** Research reference entry may ONLY use the first bar START strictly later
 * than the observed receipt time, NEVER the observed or previous 5m OPEN.
 * That future bar is evaluated only after its open is retrospectively known.
 */
export function nextHypotheticalBarAfter(receivedAt) {
  const d=timestamp(receivedAt),j=jstParts(d);
  if(!Number.isFinite(d)||!bucket(j))throw Error("OUTSIDE_MORNING_PROBE_WINDOW");
  return hhmm(Math.floor(j.minute/5)*5+5);
}

/** Calls must pass the RESPONSE-RECEIVED timestamp, not when a request began.
 * Reject cross-date/off-window and out-of-order or duplicate bar timestamps.
 * The observed set is price/volume information available only AT receivedAt.
 */
export function evaluateMorningProbe({tradeDate,code,bars,receivedAt,requestedAt,
  upstreamSource="YAHOO_V8_CHART_5M",exchangeTimezone="Asia/Tokyo"}){
  if(!dateValid(tradeDate)||!isJpxStockCode(code))throw Error("INVALID_PROBE_TARGET");
  const received=timestamp(receivedAt),requested=timestamp(requestedAt);
  if(!Number.isFinite(received)||!Number.isFinite(requested)||received<requested)
    throw Error("INVALID_PROBE_TIMESTAMPS");
  const time=probeSlotAt(received);
  const requestedSlot=probeSlotAt(requested);
  const base={policy:MORNING_PROBE_POLICY,tradeDate,code,
    requestedAt:new Date(requested).toISOString(),receivedAt:new Date(received).toISOString(),
    probeSlot:time.slot,upstreamSource,sourceStatus:"INDICATIVE_ONLY",
    earliestFutureReferenceSlot:time.allowed?nextHypotheticalBarAfter(received):null};
  if(!time.allowed||time.date!==tradeDate||requestedSlot.date!==tradeDate||
     requestedSlot.slot!==time.slot)return {...base,status:"OUTSIDE_SLOT_OR_ROLLOVER",
      completedBars:0,missingSlots:[],observedBars:[]};
  if(exchangeTimezone!=="Asia/Tokyo")return {...base,status:"UNVERIFIED_EXCHANGE_TIMEZONE",
      completedBars:0,missingSlots:[],observedBars:[]};
  if(!Array.isArray(bars)||bars.length>120)return {...base,status:"INVALID_UPSTREAM_RESPONSE",
      completedBars:0,missingSlots:[],observedBars:[]};
  const observed=new Map();
  let duplicateOrInvalid=false;
  for(const bar of bars){
    if(!Number.isSafeInteger(bar?.time)||bar.time<=0||bar.time%300!==0){
      duplicateOrInvalid=true;continue;
    }
    const local=jstParts(bar.time*1000);
    if(local.date!==tradeDate)continue;
    // No 09:10 candle CLOSE can be known before 09:15. No future bar may
    // influence a decision even when Yahoo sends a provisional current bar.
    if(bar.time*1000+300000>received)continue;
    if(local.minute<540||local.minute>=timeIndex(time.slot)||local.minute%5!==0)continue;
    if(observed.has(local.hhmm)){duplicateOrInvalid=true;continue;}
    observed.set(local.hhmm,bar);
  }
  const required=[];
  for(let minute=540;minute<timeIndex(time.slot);minute+=5)required.push(hhmm(minute));
  const missingSlots=required.filter(t=>!completePriceBar(observed.get(t)));
  const verified=required.filter(t=>completePriceBar(observed.get(t)));
  const list=verified.map(t=>({
    slot:t,
    barStartAt:new Date(Date.parse(tradeDate+"T"+t+":00+09:00")).toISOString(),
    barClosedByReceipt:true,open:observed.get(t).open,
    close:observed.get(t).close,volume:observed.get(t).volume,
  }));
  return {...base,
    status:duplicateOrInvalid?"INCONSISTENT_UPSTREAM_BARS":
      missingSlots.length?"MISSING_COMPLETED_BARS":"AVAILABLE_AS_OF_RECEIPT",
    completedBars:verified.length,requiredBars:required.length,missingSlots,
    observedBars:list,latencyMinutes:verified.length?
      Number(((received-Date.parse(tradeDate+"T"+verified.at(-1)+":00+09:00")-300000)/60000).toFixed(2)):null,
  };
}

export function summarizeMorningProbes(records){
  const counts=new Map(MORNING_PROBE_SLOTS.map(t=>[t,{slot:t,checks:0,available:0,
    missing:0,inconsistent:0}]));
  const seen=new Set();let excluded=0;
  for(const r of Array.isArray(records)?records:[]){
    const row=counts.get(r?.probeSlot);
    const key=[r?.tradeDate,r?.code,r?.probeSlot].join(":");
    if(!row||seen.has(key)){excluded++;continue;}
    seen.add(key);row.checks++;
    if(r.status==="AVAILABLE_AS_OF_RECEIPT")row.available++;
    else if(r.status==="MISSING_COMPLETED_BARS")row.missing++;
    else row.inconsistent++;
  }
  return {policy:MORNING_PROBE_POLICY,bySlot:[...counts.values()],excluded,
    performanceEvidence:"NONE_NO_CONFIRMED_FILLS"};
}
