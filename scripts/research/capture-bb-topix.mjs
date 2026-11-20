#!/usr/bin/env node
/** Owner-run, bounded public TOPIX daily-close acquisition for an offline
 * historical comparator. Exactly one GET; NEVER any licensed J-Quants calls.
 * No credentials, no DB writes, no alerts or production imports.
 */
import {mkdirSync,writeFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {validateBenchmarkCloses} from "../../app/lib/research/bbMarketRegimeV1.mjs";
export const TOPIX_CAPTURE_WINDOW=Object.freeze({first:"2026-09-25",last:"2026-11-04"});
const jstDate=seconds=>{
 if(!Number.isFinite(seconds)||seconds<=0)throw Error("INVALID_INDEX_TIMESTAMP");
 return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",
  year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(seconds*1000));
};
export function parseTopixYahooDaily(response){
 const result=response?.chart?.result?.[0];
 const times=result?.timestamp;
 const close=result?.indicators?.quote?.[0]?.close;
 if(!Array.isArray(times)||!Array.isArray(close)||times.length!==close.length)
   throw Error("INVALID_TOPIX_CHART");
 const rows=[];
 for(let i=0;i<times.length;i++){
   const date=jstDate(times[i]);
   if(date<TOPIX_CAPTURE_WINDOW.first||date>TOPIX_CAPTURE_WINDOW.last)continue;
   if(typeof close[i]!=="number"||!Number.isFinite(close[i])||close[i]<=0)
     throw Error("MISSING_TOPIX_DAILY_CLOSE");
   rows.push({date,close:close[i]});
 }
 const verified=validateBenchmarkCloses(rows);
 if(verified[0]?.date!==TOPIX_CAPTURE_WINDOW.first||
    verified.at(-1)?.date!==TOPIX_CAPTURE_WINDOW.last)
   throw Error("MISSING_TOPIX_WINDOW_BOUNDARY");
 return {benchmark:"TOPIX",source:"YAHOO_CHART_998405.T",
   first:verified[0].date,last:verified.at(-1).date,closes:verified};
}
export async function captureTopix({fetchImpl=fetch}={}){
 const p1=Math.floor(Date.parse("2026-09-24T00:00:00Z")/1000);
 const p2=Math.floor(Date.parse("2026-11-06T00:00:00Z")/1000);
 const url="https://query1.finance.yahoo.com/v8/finance/chart/998405.T?interval=1d&period1="+p1+"&period2="+p2;
 const response=await fetchImpl(url,{method:"GET",redirect:"error",cache:"no-store",
   signal:AbortSignal.timeout(12000),headers:{"Accept":"application/json"}});
 if(!response.ok)throw Error("TOPIX_PROVIDER_HTTP_"+response.status);
 return parseTopixYahooDaily(await response.json());
}
const running=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(running){
 try{
   if(process.argv.length!==2)throw Error("NO_ARGUMENTS_ALLOWED");
   const result=await captureTopix();
   const output=resolve(".private-research","bb-candle-topix-20260925-20261104.json");
   mkdirSync(dirname(output),{recursive:true});
   writeFileSync(output,JSON.stringify(result,null,2)+"\n",{flag:"wx",mode:0o600});
   console.log(JSON.stringify({status:"TOPIX_DAILY_CAPTURED_PRIVATE",
      first:result.first,last:result.last,verifiedDays:result.closes.length,
      file:output,eligibleForProduction:false},null,2));
 }catch(e){
   const reason=e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?
     e.message:"TOPIX_CAPTURE_FAILED_OR_FILE_EXISTS";
   console.error("TOPIX_CAPTURE_BLOCKED",reason);
   process.exitCode=1;
 }
}
