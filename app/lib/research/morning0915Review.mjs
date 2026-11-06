/**
 * Owner-only morning 09:15+ shadow review.
 *
 * Reads completed provider bars known by RECEIPT, not hypothetical exchange
 * fills, a historical 09:15 quote, or an AI-power trading signal.
 * No database writes, notifications, brokerage orders or production ranking.
 */
import {jstParts} from "./entryTimeShadow.mjs";
import {MARKET_FORWARD_POLICY} from "./morningMarketForward.mjs";

export const MORNING_0915_REVIEW_VERSION="MORNING_0915_COMPLETED_BAR_US_RISK_SHADOW_V1";
const expected=["09:00","09:05","09:10"];
const slots=new Set(["09:15","09:20","09:25","09:30"]);
const positive=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
const volume=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0;
const isDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+"T00:00:00Z"))&&
  new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const ms=x=>typeof x==="string"&&/(Z|[+-]\d{2}(?::?\d{2})?)$/.test(x)?
  Date.parse(x):NaN;
const round=x=>Number(x.toFixed(3));
const HHMM=x=>Date.parse(x+"+09:00");

/** One pre-open US reference observation: never infer current JPX safety. */
export function inspectPreopenNasdaq(marketRow,tradeDate,asOf){
  const unavailable=(reason)=>({state:"UNKNOWN",reason,changePct:null,
    source:"YAHOO_DAILY_REFERENCE_ONLY",verifiedJapanMarket:false});
  const now=ms(asOf);
  if(!isDate(tradeDate)||!Number.isFinite(now))return unavailable("INVALID_REVIEW_ASOF");
  if(!marketRow||marketRow.trade_date!==tradeDate||
    marketRow.policy_version!==MARKET_FORWARD_POLICY||
    marketRow.state!=="COMPLETE"||marketRow.source!=="Yahoo Finance daily chart")
    return unavailable("MISSING_PREOPEN_SNAPSHOT");
  const captured=ms(marketRow.captured_at);
  if(!Number.isFinite(captured)||captured>now)return unavailable("FUTURE_OR_INVALID_CAPTURE");
  const cap=jstParts(captured);
  if(cap.date!==tradeDate||cap.minute<520||cap.minute>=535)
    return unavailable("NOT_PREOPEN_0840_0855");
  const quote=marketRow.quotes?.nasdaq,sourceAt=ms(quote?.sourceTimestamp);
  if(quote?.state!=="REFERENCE"||!positive(quote?.price)||
     typeof quote?.changePct!=="number"||!Number.isFinite(quote.changePct)||
     quote.changePct < -50||quote.changePct>50||
     !isDate(quote.quoteDate)||quote.quoteDate>=tradeDate||
     !Number.isFinite(sourceAt)||sourceAt>captured||
     Date.parse(tradeDate+"T00:00:00Z")-Date.parse(quote.quoteDate+"T00:00:00Z")>5*86400000)
    return unavailable("INVALID_OR_STALE_NASDAQ_REFERENCE");
  return {state:quote.changePct<=-3?"PAUSE_US_SHOCK":"US_NO_SHOCK_TRIGGER",
    reason:quote.changePct<=-3?"NASDAQ_DECLINE_AT_LEAST_3_PERCENT":
      "US_REFERENCE_ONLY_JPX_NOT_CHECKED",
    changePct:quote.changePct,source:"YAHOO_DAILY_REFERENCE_ONLY",
    sourceTimestamp:quote.sourceTimestamp,capturedAt:new Date(captured).toISOString(),
    verifiedJapanMarket:false};
}

/** Completed 09:00/09:05/09:10 OHLCV fields here are only OPEN/CLOSE/VOLUME.
 * The 09:15 bar and any later bar can never enter this 09:15 study.
 * A review observed at 09:30 is NEVER labelled known at 09:15.
 */
export function inspect0915CompletedBars(probe,tradeDate,code){
  const unavailable=(reason)=>({state:"UNAVAILABLE",reason,sourceSlot:null,
    observedAt:null,proxyPrice:null,changeFromFirstOpenPct:null,
    lastBarVolume:null,threeBarVolume:null,trendUp:false});
  if(!isDate(tradeDate)||typeof code!=="string"||!/^[0-9A-Z]{4}$/.test(code))
    return unavailable("INVALID_REVIEW_TARGET");
  if(!probe||probe.tradeDate!==tradeDate||probe.code!==code||
     probe.status!=="AVAILABLE_AS_OF_RECEIPT"||
     probe.sourceStatus!=="INDICATIVE_ONLY")
    return unavailable("MISSING_VERIFIED_COMPLETED_BARS");
  const requested=ms(probe.requestedAt),received=ms(probe.receivedAt);
  if(!Number.isFinite(requested)||!Number.isFinite(received)||received<requested)
    return unavailable("INVALID_REQUEST_RECEIPT_ORDER");
  const requestedJst=jstParts(requested),receivedJst=jstParts(received);
  const slotMinute=Number(probe.probeSlot?.slice(0,2))*60+
    Number(probe.probeSlot?.slice(3));
  if(!slots.has(probe.probeSlot)||requestedJst.date!==tradeDate||
     receivedJst.date!==tradeDate||
     requestedJst.minute<slotMinute||requestedJst.minute>=slotMinute+5||
     receivedJst.minute<slotMinute||receivedJst.minute>=slotMinute+5)
    return unavailable("OUTSIDE_OR_ROLLED_CAPTURE_SLOT");
  if(!Array.isArray(probe.observedBars)||probe.observedBars.length<3||
     probe.observedBars.length>7)return unavailable("INCONSISTENT_BAR_COUNT");
  const seen=new Map();
  for(const bar of probe.observedBars){
    const start=ms(bar?.barStartAt);
    if(!bar?.barClosedByReceipt||!Number.isFinite(start)||
       start+300000>received||start%300000!==0||
       !positive(bar.open)||!positive(bar.close)||!volume(bar.volume))
      return unavailable("FUTURE_OR_INVALID_COMPLETED_BAR");
    const parts=jstParts(start);
    if(parts.date!==tradeDate||seen.has(parts.hhmm)||
       parts.minute<540||parts.minute>=receivedJst.minute||
       parts.minute%5!==0)return unavailable("DUPLICATE_OR_WRONG_DAY_BAR");
    if(bar.slot!==parts.hhmm)return unavailable("BAR_SLOT_TIMESTAMP_MISMATCH");
    seen.set(parts.hhmm,bar);
  }
  if(expected.some(t=>!seen.has(t)))return unavailable("MISSING_0915_REQUIRED_BAR");
  const bars=expected.map(t=>seen.get(t));
  const first=bars[0],last=bars[2];
  const trendUp=last.close>first.open&&
    bars[1].close>=bars[0].close&&bars[2].close>=bars[1].close;
  return {state:"OBSERVED",reason:null,sourceSlot:probe.probeSlot,
    observedAt:new Date(received).toISOString(),
    provider:"YAHOO_INDICATIVE_5M",proxyPrice:last.close,
    changeFromFirstOpenPct:round((last.close-first.open)/first.open*100),
    lastBarVolume:last.volume,threeBarVolume:bars.reduce((s,b)=>s+b.volume,0),
    trendUp,volumeConfirmed:bars.every(b=>b.volume>0),
    eligibleForRealOrders:false};
}

export function assess0915ShadowReview({tradeDate,candidate,probe,marketRow,
  budgetYen=380000,shares=100}={}){
  if(!isDate(tradeDate))throw Error("INVALID_TRADE_DATE");
  const code=String(candidate?.code??"");
  if(!/^[0-9A-Z]{4}$/.test(code))throw Error("INVALID_FROZEN_CANDIDATE");
  const asOf=probe?.receivedAt??"";
  const price=inspect0915CompletedBars(probe,tradeDate,code);
  const macro=inspectPreopenNasdaq(marketRow,tradeDate,asOf);
  const ref=Number(candidate.referencePrice);
  const proposedCost=price.state==="OBSERVED"&&Number.isInteger(shares)&&shares>0?
    Number((price.proxyPrice*shares).toFixed(2)):null;
  const withinBudget=proposedCost!==null&&Number.isFinite(budgetYen)&&budgetYen>0&&
    proposedCost<=budgetYen;
  const gapPct=price.state==="OBSERVED"&&positive(ref)?
    round((price.proxyPrice-ref)/ref*100):null;
  // No green or buy-eligible result without current JPX breadth and a
  // REAL executable quote. This output is never consumed by trading.
  let status,reason;
  if(macro.state==="PAUSE_US_SHOCK"){
    status="PAUSE_MARKET_RISK";reason="PREOPEN_NASDAQ_SHOCK";
  }else if(price.state!=="OBSERVED"){
    status="WAIT_FOR_BAR_DATA";reason=price.reason;
  }else if(macro.state==="UNKNOWN"){
    status="WAIT_FOR_MARKET_DATA";reason=macro.reason;
  }else if(!withinBudget){
    status="OVER_BUDGET_REFERENCE";reason="INDICATIVE_COST_EXCEEDS_BUDGET";
  }else if(gapPct===null||gapPct<=-3||gapPct>=5){
    status="CAUTION_REFERENCE_GAP";reason="GAP_OR_FROZEN_PRICE_INVALID";
  }else if(price.trendUp&&price.volumeConfirmed&&
           price.changeFromFirstOpenPct>=0.5){
    status="TREND_WATCH_ONLY";reason="3_COMPLETED_BARS_RISING_NOT_AN_ORDER";
  }else {
    status="CAUTION_WEAK_MOMENTUM";reason="TREND_OR_VOLUME_NOT_CONFIRMED";
  }
  return {policy:MORNING_0915_REVIEW_VERSION,tradeDate,code,rank:candidate.rank,
    status,reason,sourceSlot:price.sourceSlot,observedAt:price.observedAt,
    market:macro,opening:price,referenceCost100Yen:shares===100?proposedCost:null,
    referenceGapPct:gapPct,withinReferenceBudget:withinBudget,
    eligibleForTrading:false,eligibleForNotifications:false,eligibleForAiPower:false,
    caution:"Only completed bars at actual receipt time; not a 09:15 bid/ask or proof of fills. The US reference does not certify Japanese market safety."};
}

export function summarize0915ShadowReviews(reviews){
  const list=Array.isArray(reviews)?reviews:[];
  const counts={};
  for(const r of list){
    const key=r?.status??"UNKNOWN";
    counts[key]=(counts[key]??0)+1;
  }
  return {policy:MORNING_0915_REVIEW_VERSION,total:list.length,counts,
    watchOnly:list.filter(x=>x.status==="TREND_WATCH_ONLY").length,
    paused:list.filter(x=>x.status==="PAUSE_MARKET_RISK").length,
    actualBuySignals:0,tradingEnabled:false,forwardAccuracy:null};
}
