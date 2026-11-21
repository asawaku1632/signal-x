#!/usr/bin/env node
/**
 * Research-only bounded J-Quants V2 TOPIX daily capture. Private, create-only.
 * No logging of keys, JSON payloads or data. No Vercel or production writes.
 * Opt-in explicit --execute and existing research env gate.
 */
import {mkdirSync,writeFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {validateBenchmarkCloses} from "../../app/lib/research/bbMarketRegimeV1.mjs";

export const TOPIX_JQUANTS_WINDOW=Object.freeze({first:"2026-09-25",last:"2026-11-04"});
export const TOPIX_JQUANTS_URL="https://api.jquants.com/v2/indices/bars/daily/topix";
export function validateTopixJQuantsPages(pages){
 if(!Array.isArray(pages)||pages.length<1||pages.length>4)throw Error("INVALID_TOPIX_PAGE_COUNT");
 const closes=[];
 for(const page of pages){
   if(!Array.isArray(page?.data))throw Error("INVALID_TOPIX_PAGE");
   for(const r of page.data){
     if(typeof r?.Date!=="string"||
        r.Date<TOPIX_JQUANTS_WINDOW.first||r.Date>TOPIX_JQUANTS_WINDOW.last||
        typeof r.C!=="number"||!Number.isFinite(r.C)||r.C<=0)
       throw Error("INVALID_TOPIX_PROVIDER_ROW");
     closes.push({date:r.Date,close:r.C});
   }
 }
 closes.sort((a,b)=>a.date.localeCompare(b.date));
 if(closes.some((x,i)=>i>0&&x.date===closes[i-1].date))
   throw Error("DUPLICATE_TOPIX_DATE");
 const valid=validateBenchmarkCloses(closes);
 if(valid[0]?.date!==TOPIX_JQUANTS_WINDOW.first||valid.at(-1)?.date!==TOPIX_JQUANTS_WINDOW.last)
   throw Error("INCOMPLETE_TOPIX_BOUNDARIES");
 return {benchmark:"TOPIX",source:"JQUANTS_V2_TOPIX_DAILY",first:valid[0].date,last:valid.at(-1).date,closes:valid};
}
export async function captureTopixJQuants({apiKey,fetchImpl=fetch}={}){
 if(typeof apiKey!=="string"||!apiKey.trim())throw Error("JQUANTS_KEY_NOT_READY");
 const pages=[],seen=new Set();
 let token=null;
 for(let page=0;page<4;page++){
   const url=new URL(TOPIX_JQUANTS_URL);
   url.searchParams.set("from",TOPIX_JQUANTS_WINDOW.first);
   url.searchParams.set("to",TOPIX_JQUANTS_WINDOW.last);
   if(token)url.searchParams.set("pagination_key",token);
   let response;
   try{
     response=await fetchImpl(url,{method:"GET",redirect:"error",cache:"no-store",
       credentials:"omit",referrerPolicy:"no-referrer",
       signal:AbortSignal.timeout(12000),
       headers:{"x-api-key":apiKey,"accept":"application/json"}});
   }catch{throw Error("JQUANTS_TOPIX_NETWORK_ERROR")}
   if(!response?.ok)throw Error("JQUANTS_TOPIX_HTTP_"+(Number.isInteger(response?.status)?response.status:"UNKNOWN"));
   let body;
   try{body=await response.json()}catch{throw Error("JQUANTS_TOPIX_INVALID_JSON")}
   if(!Array.isArray(body?.data))throw Error("JQUANTS_TOPIX_INVALID_ENVELOPE");
   pages.push({data:body.data});
   const next=body.pagination_key??null;
   if(next===null||next==="")return validateTopixJQuantsPages(pages);
   if(typeof next!=="string"||next.length>256||next===token||seen.has(next))
      throw Error("JQUANTS_TOPIX_INVALID_PAGINATION");
   seen.add(next);token=next;
 }
 throw Error("JQUANTS_TOPIX_TOO_MANY_PAGES");
}
const running=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(running){
 try{
   if(process.argv.length!==3||process.argv[2]!=="--execute")throw Error("EXPLICIT_EXECUTE_REQUIRED");
   if(process.env.JQUANTS_RESEARCH_PROBE_ENABLED!=="true"||!process.env.JQUANTS_API_KEY)
     throw Error("LOCAL_PRIVATE_RESEARCH_ENV_NOT_READY");
   const data=await captureTopixJQuants({apiKey:process.env.JQUANTS_API_KEY});
   const path=resolve(".private-research","bb-candle-topix-20260925-20261104.json");
   mkdirSync(dirname(path),{recursive:true,mode:0o700});
   writeFileSync(path,JSON.stringify(data,null,2)+"\n",{flag:"wx",mode:0o600});
   console.log(JSON.stringify({status:"TOPIX_JQUANTS_CAPTURED_PRIVATE",
     verifiedDays:data.closes.length,first:data.first,last:data.last,
     file:path,eligibleForProduction:false},null,2));
 }catch(e){
   const msg=e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?
     e.message:"TOPIX_JQUANTS_CAPTURE_FAILED_OR_FILE_EXISTS";
   console.error("TOPIX_JQUANTS_BLOCKED",msg);
   process.exitCode=1;
 }
}
