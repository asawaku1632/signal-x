#!/usr/bin/env node
/** Research only: broad inventory of EXISTING local private archive cohorts.
 * Exact intra-cohort dates, full J-Quants day reconciliations, cross-archive
 * duplicated-date OHLCV checks. Never fabricate unobserved market-wide signals.
 * No network, writes, new API capture, trading, alerts or licensed raw output.
 */
import {readFileSync,statSync} from "node:fs";
import {resolve,basename} from "node:path";
import {fileURLToPath} from "node:url";
import {inventoryFolderEntries,inspectCaptureMetadata} from "./audit-bb-saved-archives.mjs";
import {reconcileCapturedTradeDay} from "../../app/lib/research/fourPatternJQuantsBridge.mjs";
import {replayBbCandleArchives} from "../../app/lib/research/bbCandleReplay.mjs";
import {validateBenchmarkCloses,priorMarketRegime} from "../../app/lib/research/bbMarketRegimeV1.mjs";
const fields=["minute","open","high","low","close","volume","turnover"];
const buyKey=x=>x.code+"|"+x.date+"|"+x.slot;
const finite=x=>typeof x==="number"&&Number.isFinite(x);
export function consolidateCohortEvents(candidates){
 const out=new Map(),quarantined=new Set();
 for(const e of candidates){
  if(!e||!/^[0-9]{3}[0-9A-Z]$/.test(e.code)||!/^20\d{2}-\d{2}-\d{2}$/.test(e.date)||
      !["09:20","11:20","14:15"].includes(e.slot)||
      !["UP","DOWN","SIDEWAYS"].includes(e.marketRegime)||
      !(e.after5dPct===null||finite(e.after5dPct)))throw Error("BAD_CANDIDATE_EVENT");
  const key=buyKey(e);
  if(quarantined.has(key))continue;
  const previous=out.get(key);
  if(!previous){out.set(key,e);continue;}
  const samePattern=[...previous.patterns].sort().join(",")===
    [...e.patterns].sort().join(",");
  const sameContext=previous.marketRegime===e.marketRegime;
  const matureBoth=previous.after5dPct!==null&&e.after5dPct!==null;
  const sameOutcome=!matureBoth||Math.abs(previous.after5dPct-e.after5dPct)<0.0002;
  if(!samePattern||!sameContext||!sameOutcome){
    quarantined.add(key);out.delete(key);continue;
  }
  if(e.after5dPct!==null&&previous.after5dPct===null)out.set(key,e);
 }
 return {events:[...out.values()],quarantinedSignalKeys:quarantined.size};
}
function auditedLocalCapture(a){
 const meta=inspectCaptureMetadata(a);
 const days=a.minuteDays.map((m,i)=>reconcileCapturedTradeDay({
  code:a.code,date:m.date,minutePages:m.pages,dailyPages:a.dailyDays[i].pages}));
 return {meta,days};
}
export function broadCohortAudit({benchmark,entries}){
 if(benchmark?.benchmark!=="TOPIX")throw Error("TOPIX_REQUIRED");
 const validated=validateBenchmarkCloses(benchmark.closes);
 if(!Array.isArray(entries)||entries.length<1||entries.length>300)throw Error("BAD_LOCAL_INVENTORY");
 const groups=new Map(),skipped=[],prices=new Map();
 let reconciledArchives=0;
 for(const {file,capture} of entries){
  let audited;
  try{audited=auditedLocalCapture(capture);}
  catch(e){skipped.push({file:basename(file),reason:"UNRECONCILED_CAPTURE"});continue;}
  // Cross-archive overlap must reconcile, even when dates are in separate cohorts.
  for(const d of audited.days){
   const k=d.code+"|"+d.date,prior=prices.get(k);
   if(prior&& (prior.length!==d.minutes.length||
     prior.some((p,i)=>fields.some(f=>p[f]!==d.minutes[i][f]))))
     throw Error("CONFLICTING_OVERLAPPING_OHLCV");
   prices.set(k,d.minutes);
  }
  reconciledArchives++;
  const signature=audited.meta.dateSignature;
  if(!groups.has(signature))groups.set(signature,[]);
  groups.get(signature).push(capture);
 }
 const candidates=[],cohortStats=[];
 for(const [signature,arr] of groups){
  const days=signature.split(","),dateFirst=days[0],dateLast=days.at(-1);
  const codes=[...new Set(arr.map(a=>a.code))];
  if(arr.length<2||days.length<2){
   skipped.push({first:dateFirst,last:dateLast,stocks:arr.length,reason:"NOT_MULTI_STOCK_COHORT"});
   continue;
  }
  if(codes.length!==arr.length)throw Error("DUPLICATE_CODE_IN_COHORT");
  let replay;
  try{replay=replayBbCandleArchives(arr,{exploratoryDetails:true});}
  catch(e){skipped.push({first:dateFirst,last:dateLast,stocks:arr.length,reason:"COHORT_REPLAY_BLOCKED"});continue;}
  const known=[],unknown=[];
  for(const event of replay.exploratoryBuyEvents){
    const m=priorMarketRegime(event.date,validated);
    (m.regime==="UNKNOWN"?unknown:known).push({...event,marketRegime:m.regime});
  }
  candidates.push(...known);
  cohortStats.push({first:dateFirst,last:dateLast,stocks:arr.length,
    tradingDates:days.length,signalCount:known.length,
    unclassifiedSignals:unknown.length,
    endOfArchiveMayCensorOutcomes:true});
 }
 const dedup=consolidateCohortEvents(candidates),groupsBySlot=new Map();
 for(const e of dedup.events){
  const k=e.date+"|"+e.slot;
  if(!groupsBySlot.has(k))groupsBySlot.set(k,[]);
  groupsBySlot.get(k).push(e);
 }
 const slotGroups=[...groupsBySlot].map(([k,rows])=>{
  const [date,time]=k.split("|");
  if(new Set(rows.map(x=>x.marketRegime)).size!==1)throw Error("MARKET_CLASSIFICATION_MISMATCH");
  const mature=rows.filter(x=>x.after5dPct!==null);
  return {date,time,observedSignals:rows.length,codes:rows.map(x=>x.code).sort(),
    market:rows[0].marketRegime,mature5d:mature.length,
    negative5d:mature.filter(x=>x.after5dPct<=0).length,
    examples:mature.map(x=>({code:x.code,after5dPct:x.after5dPct})).sort((a,b)=>a.code.localeCompare(b.code))};
 }).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
 return {status:"BB_WIDER_PRIVATE_SAMPLE_DESCRIPTIVE_ONLY",
  totalFiles:entries.length,reconciledArchives,
  sharedCohortsReplayed:cohortStats.length,
  duplicateOrConflictingSignalKeys:dedup.quarantinedSignalKeys,
  uniqueKnownBuyEvents:dedup.events.length,
  observedMultipleGroups:slotGroups.filter(x=>x.observedSignals>=2).length,
  observedSingleGroups:slotGroups.filter(x=>x.observedSignals===1).length,
  cohortStats,slotGroups,skipped,
  populationWarning:"Observed same-slot signals only in a changing, nonrandom captured universe; singleton does NOT mean no other stock had signal. Cohort archive end truncates 1/3/5-day outcomes. These cohorts must not be treated as complete-market observations.",
  comparativeRates:null,eligibleForProduction:false,eligibleForNotifications:false};
}
const load=p=>{const size=statSync(p).size;
 if(size<2||size>250000)throw Error("INVALID_TOPIX_INPUT_SIZE");
 return JSON.parse(readFileSync(p,"utf8"));};
const main=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 try{
  const args=process.argv.slice(2);
  if(args.length<2||args.length>6)throw Error("USAGE_TOPIX_THEN_PRIVATE_DIRECTORIES");
  console.log(JSON.stringify(broadCohortAudit({
   benchmark:load(args[0]),entries:inventoryFolderEntries(args.slice(1))
  }),null,2));
 }catch(e){console.error("BB_WIDER_AUDIT_BLOCKED",
   e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:"INVALID_PRIVATE_RESEARCH_INPUT");
  process.exitCode=1;}
}
