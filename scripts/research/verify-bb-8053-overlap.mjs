#!/usr/bin/env node
/** Research only. Read two locally captured same-stock archives, reconcile
 * every trade day, compare duplicated days at each 1-minute OHLCV+turnover.
 * Never modify input files, print licensed OHLCV, upload data, or place trades.
 */
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {reconcileCapturedTradeDay} from "../../app/lib/research/fourPatternJQuantsBridge.mjs";
import {assertContinuousTseSessions} from "../../app/lib/research/fourPatternTradingDayForward.mjs";
import {replayBbCandleArchives} from "../../app/lib/research/bbCandleReplay.mjs";
const fields=["minute","open","high","low","close","volume","turnover"];
const get=p=>{const size=statSync(p).size;if(size<1||size>8_000_000)throw Error("INVALID_ARCHIVE_SIZE");return JSON.parse(readFileSync(p,"utf8"));};
function daysOf(archive){
 if(archive?.code!=="8053"||!Array.isArray(archive.minuteDays)||!Array.isArray(archive.dailyDays)||
 archive.minuteDays.length!==archive.dailyDays.length||archive.minuteDays.length<2||archive.minuteDays.length>35)
   throw Error("INVALID_8053_ARCHIVE");
 return archive.minuteDays.map((m,i)=>{
   const d=archive.dailyDays[i];
   if(!m||!d||m.date!==d.date||i&&m.date<=archive.minuteDays[i-1].date)
     throw Error("INVALID_CAPTURE_DATES");
   return reconcileCapturedTradeDay({code:"8053",date:m.date,minutePages:m.pages,dailyPages:d.pages});
 });
}
export function verifyAndReplay8053(first,second){
 const a=daysOf(first),b=daysOf(second),lookup=new Map(a.map((d,i)=>[d.date,i]));
 let overlap=0;
 for(let i=0;i<b.length;i++){
   const d=b[i],prior=lookup.get(d.date);
   if(prior!==undefined){
     overlap++;
     const old=a[prior];
     if(old.minutes.length!==d.minutes.length||
       old.minutes.some((v,j)=>fields.some(k=>v[k]!==d.minutes[j][k])))
       throw Error("OVERLAP_MINUTE_MISMATCH");
   }
 }
 if(overlap<1)throw Error("NO_OVERLAPPING_DATES");
 const entries=new Map();
 for(let i=0;i<first.minuteDays.length;i++)
   entries.set(first.minuteDays[i].date,{minute:first.minuteDays[i],daily:first.dailyDays[i]});
 for(let i=0;i<second.minuteDays.length;i++){
   const m=second.minuteDays[i],d=second.dailyDays[i];
   if(!entries.has(m.date))entries.set(m.date,{minute:m,daily:d});
 }
 const sorted=[...entries].sort((a,b)=>a[0].localeCompare(b[0]));
 const merged={code:"8053",minuteDays:sorted.map(([,v])=>v.minute),
   dailyDays:sorted.map(([,v])=>v.daily)};
 const allDays=daysOf(merged);
 assertContinuousTseSessions(allDays);
 const result=replayBbCandleArchives([merged],{exploratoryDetails:true});
 const target=result.exploratoryBuyEvents.filter(x=>x.date==="2026-10-27"||x.date==="2026-10-29");
 return {status:"PRIVATE_OVERLAP_VERIFIED_READ_ONLY",code:"8053",
   overlapTradingDates:overlap,mergedTradingDates:allDays.length,
   first:allDays[0].date,last:allDays.at(-1).date,
   buyEventsOnDates:target,eligibleForTrading:false,eligibleForProduction:false,
   note:"Hypothetical historical returns; no live execution assumptions verified. Incomplete 5-day outcomes remain null."};
}
const running=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(running){
 try{
   if(process.argv.length!==4)throw Error("USAGE_TWO_LOCAL_8053_FILES");
   const result=verifyAndReplay8053(get(process.argv[2]),get(process.argv[3]));
   console.log(JSON.stringify(result,null,2));
 }catch(e){
   console.error("BB_8053_JOIN_BLOCKED",
    e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:"BAD_PRIVATE_ARCHIVE");
   process.exitCode=1;
 }
}
