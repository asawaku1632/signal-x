#!/usr/bin/env node
/** Read-only inventory of the exact post-signal TSE sessions missing from
 * 5-day outcomes of the existing stitched historical BB_CANDLE_V1 sample.
 * No API calls, no data acquisition, no file writes, no execution advice.
 */
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {inventoryFolderEntries} from "./audit-bb-saved-archives.mjs";
import {auditStitchedStocks} from "./bb-stitch-stock-captures.mjs";
import {resolveTseTradingDatesAfter} from "../../app/lib/technicalObservation/tseMarketCalendar.ts";

export function planMissingFiveDays({baseline,entries}){
 if(baseline?.status!=="BB_STITCHED_LOCAL_OBSERVATIONS_ONLY"||
    !Array.isArray(baseline.groupedEvents)||!Array.isArray(entries)||entries.length<1)
   throw Error("INVALID_STITCH_BASELINE");
 const available=new Map(),allSignalKeys=new Set();
 for(const {capture} of entries){
  if(!capture||typeof capture.code!=="string"||!Array.isArray(capture.minuteDays)||
      !Array.isArray(capture.dailyDays)||capture.minuteDays.length!==capture.dailyDays.length)
   throw Error("INVALID_ARCHIVE_DAY_INVENTORY");
  const dates=available.get(capture.code)??new Set();
  for(let i=0;i<capture.minuteDays.length;i++){
   const m=capture.minuteDays[i],d=capture.dailyDays[i];
   if(!m||m.date!==d?.date)throw Error("INVALID_PAIR_DATE");
   dates.add(m.date);
  }
  available.set(capture.code,dates);
 }
 const pending=[];
 let counted=0;
 for(const group of baseline.groupedEvents){
  for(const code of group.codes){
   const k=code+"|"+group.date+"|"+group.slot;
   if(allSignalKeys.has(k))throw Error("DUPLICATE_BASELINE_SIGNAL");
   allSignalKeys.add(k);counted++;
  }
  if(group.mature5d+group.notMature5d!==group.codes.length)
    throw Error("INCONSISTENT_BASELINE_COUNTS");
  if(!Array.isArray(group.examples)||group.examples.length!==group.mature5d)
    throw Error("INCONSISTENT_BASELINE_EXAMPLES");
  const matureSet=new Set(group.examples.map(e=>e.code));
  if(matureSet.size!==group.mature5d||group.examples.some(e=>!group.codes.includes(e.code)))
    throw Error("INVALID_BASELINE_MATURE_SET");
  for(const code of group.codes.filter(code=>!matureSet.has(code))){
   const following=resolveTseTradingDatesAfter(group.date,5);
   const local=available.get(code);
   if(!local?.has(group.date))throw Error("SIGNAL_NOT_IN_ARCHIVE");
   const missing=following.filter(date=>!local.has(date));
   if(missing.length===0)throw Error("UNMATURE_DESPITE_COMPLETE_DATES");
   pending.push({code,date:group.date,slot:group.slot,
     observedSameSlotStocks:group.distinctObservedStocks,
     priorMarket:group.priorMarket,
     exitDate5d:following.at(-1),
     missingTradingDates:missing,
     missingCount:missing.length,
     availableFollowingSessions:following.length-missing.length});
  }
 }
 if(counted!==baseline.uniqueClassifiedBuyEvents||pending.length+baseline.mature5d!==counted)
   throw Error("BASELINE_TOTAL_MISMATCH");
 pending.sort((a,b)=>b.observedSameSlotStocks-a.observedSameSlotStocks||
   a.missingCount-b.missingCount||a.date.localeCompare(b.date)||a.code.localeCompare(b.code));
 const uniqueStockDates=new Map();
 for(const e of pending){
  if(!uniqueStockDates.has(e.code))uniqueStockDates.set(e.code,new Set());
  for(const date of e.missingTradingDates)uniqueStockDates.get(e.code).add(date);
 }
 const priority= [...uniqueStockDates].flatMap(([code,dates])=>[...dates].map(date=>({code,date})))
   .sort((a,b)=>a.date.localeCompare(b.date)||a.code.localeCompare(b.code));
 return {status:"BB_5D_MISSING_DATES_PLAN_ONLY",
  sourceArchiveFiles:baseline.sourceArchiveFiles,
  observedBuyEvents:counted,mature5d:baseline.mature5d,pending5d:pending.length,
  distinctMissingStockDates:priority.length,
  missingBySignal:pending,uniqueMissingStockDates:priority,
  note:"A stock/date is counted once in the proposed retrieval inventory even when it completes multiple pending signals. The 5 following sessions are required for complete 5-day worst-dip evaluation; the 5th session close is required for only endpoint return. This plan does NOT prove provider availability or API cost. No data fetched.",
  eligibleForProduction:false,eligibleForNotifications:false};
}
const readTopix=p=>{const size=statSync(p).size;
 if(size<2||size>250000)throw Error("INVALID_TOPIX_SIZE");
 return JSON.parse(readFileSync(p,"utf8"));
};
const isMain=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{
  const args=process.argv.slice(2);
  if(args.length<2||args.length>6)throw Error("USAGE_TOPIX_THEN_ARCHIVE_FOLDERS");
  const entries=inventoryFolderEntries(args.slice(1));
  const baseline=auditStitchedStocks({benchmark:readTopix(args[0]),entries});
  console.log(JSON.stringify(planMissingFiveDays({baseline,entries}),null,2));
 }catch(e){
  console.error("BB_MISSING_5D_PLAN_BLOCKED",
   e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:"INVALID_PRIVATE_INPUT");
  process.exitCode=1;
 }
}
