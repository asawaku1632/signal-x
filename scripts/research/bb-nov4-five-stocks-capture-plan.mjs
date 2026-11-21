#!/usr/bin/env node
/**
 * Read-only DRY RUN: exact five-stock coverage gaps for 2026-11-04 14:15
 * BB_CANDLE_V1 observed multi-stock signal. NEVER fetches or writes data.
 * Only existing historical private capture metadata is inventoried.
 */
import {resolve,basename} from "node:path";
import {fileURLToPath} from "node:url";
import {inventoryFolderEntries} from "./audit-bb-saved-archives.mjs";
import {planFourPatternCapture} from "./capture-four-pattern-jquants.mjs";
import {resolveTseTradingDatesAfter} from "../../app/lib/technicalObservation/tseMarketCalendar.ts";

export const TARGET_SIGNAL_DATE="2026-11-04";
export const TARGET_STOCKS=Object.freeze(["1945","7203","7752","8316","8601"]);
export const TARGET_AFTER_DATES=Object.freeze(resolveTseTradingDatesAfter(TARGET_SIGNAL_DATE,5));

export function planSevenStockCompletion(entries,{now=new Date("2026-11-21T10:00:00+09:00")}={}){
 if(!Array.isArray(entries)||entries.length<1||entries.length>300)
   throw Error("INVALID_LOCAL_ARCHIVE_INVENTORY");
 const covered=new Map(TARGET_STOCKS.map(code=>[code,new Set()]));
 for(const {capture} of entries){
  if(!covered.has(capture?.code))continue;
  if(!Array.isArray(capture.minuteDays)||!Array.isArray(capture.dailyDays)||
      capture.minuteDays.length!==capture.dailyDays.length)
     throw Error("INVALID_CAPTURE_STRUCTURE");
  for(let i=0;i<capture.minuteDays.length;i++){
   const d=capture.minuteDays[i]?.date;
   if(d!==capture.dailyDays[i]?.date)throw Error("MISMATCHED_CAPTURE_DATES");
   covered.get(capture.code).add(d);
  }
 }
 const perStock=[],missingPairs=[];
 for(const code of TARGET_STOCKS){
  if(!covered.get(code).has(TARGET_SIGNAL_DATE))
    throw Error("ORIGINAL_SIGNAL_DAY_NOT_PRESENT");
  const missing=TARGET_AFTER_DATES.filter(d=>!covered.get(code).has(d));
  const plans=missing.length?[planFourPatternCapture([
    "--code="+code,"--dates="+missing.join(","),"--skip-financial"
  ],now)]:[];
  if(plans.some(p=>p.execute||p.skipFinancial!==true))throw Error("NOT_DRY_RUN");
  const plan=plans[0]??null;
  perStock.push({code,missingDates:missing,missingCount:missing.length,
    observedFollowingDates:5-missing.length,
    dryRun:plan?{filename:plan.filename,maxRequests:plan.maxRequests,
      execute:plan.execute,skipFinancial:plan.skipFinancial}:null});
  for(const date of missing)missingPairs.push({code,date});
 }
 const maxRequests=perStock.reduce((sum,s)=>sum+(s.dryRun?.maxRequests??0),0);
 return {status:"BB_NOV4_FIVE_STOCKS_CAPTURE_PLAN_NO_API",signalDate:TARGET_SIGNAL_DATE,
  slot:"14:15",alreadyMature:["6326","8410"],
  targetStocks:[...TARGET_STOCKS],after5TradingDates:[...TARGET_AFTER_DATES],
  sourceArchiveFiles:entries.length,missingStockDates:missingPairs.length,
  maxRequestsUnderExistingFourPageCap:maxRequests,perStock,missingPairs,
  note:"Upper bound counts up to four minute pages and four daily pages per stock-date; not actual requests or billing. API key entitlement and subscription charges are not established. Historical selected cohort only.",
  zeroApiCalls:true,filesWritten:false,eligibleForProduction:false,
  eligibleForNotifications:false};
}
const main=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 try{
  const dirs=process.argv.slice(2);
  if(dirs.length<1||dirs.length>5)throw Error("USAGE_ONE_TO_FIVE_PRIVATE_CAPTURE_FOLDERS");
  const result=planSevenStockCompletion(inventoryFolderEntries(dirs));
  // Print only code/dates/filename, never provider rows or secret variables.
  console.log(JSON.stringify(result,null,2));
 }catch(e){
  console.error("BB_NOV4_CAPTURE_PLAN_BLOCKED",
    e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:"BAD_PRIVATE_ARCHIVE");
  process.exitCode=1;
 }
}
