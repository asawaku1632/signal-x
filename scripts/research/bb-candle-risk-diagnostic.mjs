#!/usr/bin/env node
/** BB_CANDLE_V1: small-sample risk audit, explicitly NOT an optimized trading rule.
 * Reads only existing local captures. Verifies overlapping 8053 minutes before
 * joining any dates; never writes, fetches, trades or emits licensed OHLCV.
 */
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {reconcileCapturedTradeDay} from "../../app/lib/research/fourPatternJQuantsBridge.mjs";
import {fiveMinuteFromReconciled,replayBbCandleArchives} from "../../app/lib/research/bbCandleReplay.mjs";
import {detectBbCandleV1} from "../../app/lib/research/bbCandleV1.mjs";
import {validateBenchmarkCloses,priorMarketRegime} from "../../app/lib/research/bbMarketRegimeV1.mjs";
import {verifyAndReplay8053} from "./verify-bb-8053-overlap.mjs";

const load=(file,max)=>{const sz=statSync(file).size;
 if(sz<2||sz>max)throw Error("INVALID_PRIVATE_FILE_SIZE");
 return JSON.parse(readFileSync(file,"utf8"));
};
const fixed=(n,d=4)=>typeof n==="number"&&Number.isFinite(n)?Number(n.toFixed(d)):null;
const key=e=>e.code+"|"+e.date+"|"+e.slot;
function reconciled(archive){
 return archive.minuteDays.map((m,i)=>reconcileCapturedTradeDay({
  code:archive.code,date:m.date,minutePages:m.pages,dailyPages:archive.dailyDays[i].pages
 }));
}
function merged8053(a,b){
 // Verify entire duplicate-minute OHLCV and all trade-day bridges first.
 verifyAndReplay8053(a,b);
 const days=new Map();
 for(const capture of [a,b]){
   for(let i=0;i<capture.minuteDays.length;i++){
     const m=capture.minuteDays[i];
     if(!days.has(m.date))days.set(m.date,{minute:m,daily:capture.dailyDays[i]});
   }
 }
 const values=[...days].sort((x,y)=>x[0].localeCompare(y[0]));
 return {code:"8053",minuteDays:values.map(x=>x[1].minute),
  dailyDays:values.map(x=>x[1].daily)};
}
/** No future bars are used in these features: all values are available only
 * after the completed pattern signal bar, prior to the simulated entry.
 */
export function featuresAtCompletedSignal(bars,hit){
 const i=hit.index;
 if(!Number.isInteger(i)||i<20||i>=bars.length||hit.direction!=="BUY")
  throw Error("INVALID_FEATURE_SIGNAL");
 const current=bars[i],previous=bars.slice(i-20,i);
 if(!previous.every(x=>Number.isFinite(x.volume)&&x.volume>0)||
    !Number.isFinite(current.volume)||current.volume<=0)
    throw Error("INVALID_SIGNAL_VOLUME");
 const mean=previous.reduce((s,x)=>s+x.volume,0)/previous.length;
 const range=current.high-current.low;
 if(range<=0||mean<=0)throw Error("INVALID_SIGNAL_RANGE");
 const body=Math.abs(current.close-current.open);
 return {
   bbWidthPct:fixed(100*hit.bbWidth),
   volumeVsPrior20:fixed(current.volume/mean),
   bodyToRangePct:fixed(100*body/range),
   last5BarsPct:fixed(100*(current.close/bars[i-5].close-1))
 };
}
export function buildRiskDiagnostics({benchmark,threeArchives,overlapFirst,overlapSecond}){
 if(benchmark?.benchmark!=="TOPIX"||
    !Array.isArray(threeArchives)||threeArchives.length!==3||
    !["3762","7203","7752"].every(c=>threeArchives.some(a=>a?.code===c)))
  throw Error("INVALID_RISK_COHORT");
 const index=validateBenchmarkCloses(benchmark.closes);
 const combined=[...threeArchives,merged8053(overlapFirst,overlapSecond)];
 const records=[],seen=new Set();
 for(const archive of combined){
   const replay=replayBbCandleArchives([archive],{exploratoryDetails:true});
   const bars=fiveMinuteFromReconciled(reconciled(archive));
   const hits=detectBbCandleV1(bars);
   const byIndex=new Map();
   for(const h of hits){
     if(h.direction!=="BUY")continue;
     const b=bars[h.index];
     if(!b)throw Error("INVALID_HIT_REFERENCE");
     const slotMinutes=Number(b.slot.slice(0,2))*60+Number(b.slot.slice(3))+10;
     const slot=String(Math.floor(slotMinutes/60)).padStart(2,"0")+":"+
       String(slotMinutes%60).padStart(2,"0");
     const eventKey=archive.code+"|"+b.date+"|"+slot;
     if(!byIndex.has(eventKey))byIndex.set(eventKey,{h,bars});
   }
   for(const e of replay.exploratoryBuyEvents){
     const k=key(e);
     if(seen.has(k))throw Error("DUPLICATE_SIGNAL_ACROSS_ARCHIVES");
     seen.add(k);
     const match=byIndex.get(k);
     if(!match)throw Error("SIGNAL_FEATURE_MISMATCH");
     const market=priorMarketRegime(e.date,index);
     if(market.regime==="UNKNOWN")throw Error("MISSING_PRIOR_MARKET_CONTEXT");
     const feat=featuresAtCompletedSignal(match.bars,match.h);
     records.push({code:e.code,date:e.date,time:e.slot,patterns:e.patterns,
       priorTopix5dPct:market.prior5dPct,priorMarket:market.regime,
       ...feat,after5dPct:e.after5dPct,
       worstDip5dPct:e.worstDip5dPct,
       intradayWorstDipPct:e.intradayWorstDipPct,
       outcome:e.after5dPct===null?"NOT_MATURE":
         e.after5dPct>0?"POSITIVE_5D":"NONPOSITIVE_5D"});
   }
 }
 records.sort((a,b)=>a.date.localeCompare(b.date)||a.code.localeCompare(b.code)||a.time.localeCompare(b.time));
 const mature=records.filter(e=>e.outcome!=="NOT_MATURE");
 const negative=mature.filter(e=>e.outcome==="NONPOSITIVE_5D");
 return {status:"BB_CANDLE_RISK_DIAGNOSTIC_DESCRIPTIVE_ONLY",
   codes:combined.map(x=>x.code),totalBuyEvents:records.length,
   mature5d:mature.length,negative5d:negative.length,
   records,findingsStatus:"TOO_FEW_INDEPENDENT_EVENTS_FOR_FILTER",
   comparison:"NO_THRESHOLD_TUNING_OR_TRADE_FILTER",
   lookaheadExcludedFromFeatures:true,
   eligibleForProduction:false,eligibleForNotifications:false,
   note:"Historical scenario outcomes use existing replay assumptions, not realized executable returns; one 8053 date pair reconciled and joined in memory."};
}
const running=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(running){
 try{
  if(process.argv.length!==7)throw Error("USAGE_TOPIX_THREE_STOCKS_TWO_8053_FILES");
  const [benchmark,...paths]=process.argv.slice(2);
  const [a,b,c,first,second]=paths.map(f=>load(f,8_000_000));
  console.log(JSON.stringify(buildRiskDiagnostics({
    benchmark:load(benchmark,250_000),threeArchives:[a,b,c],
    overlapFirst:first,overlapSecond:second
  }),null,2));
 }catch(e){
  console.error("BB_RISK_DIAGNOSTIC_BLOCKED",
    e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:"INVALID_PRIVATE_INPUT");
  process.exitCode=1;
 }
}
