#!/usr/bin/env node
/**
 * Offline audit of already saved four-pattern J-Quants archive metadata.
 * No HTTP, database, updates, API key usage, output of OHLCV, or private data copies.
 * Does NOT claim the archives passed full minute/daily reconciliation.
 */
import {readdirSync,readFileSync,statSync} from "node:fs";
import {basename,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {validateBenchmarkCloses,priorMarketRegime} from "../../app/lib/research/bbMarketRegimeV1.mjs";

const pattern=/^four-pattern-jquants-[0-9]{3}[0-9A-Z]-20\d\d-\d\d-\d\d-20\d\d-\d\d-\d\d\.json$/;
const ticker=/^[0-9]{3}[0-9A-Z]$/;
const date=/^20\d\d-\d\d-\d\d$/;
export function inspectCaptureMetadata(a){
  if(!ticker.test(a?.code)||!Array.isArray(a.minuteDays)||!Array.isArray(a.dailyDays)||
     a.minuteDays.length!==a.dailyDays.length||a.minuteDays.length===0||a.minuteDays.length>50)
    throw Error("INVALID_ARCHIVE_STRUCTURE");
  const dates=[];
  for(let i=0;i<a.minuteDays.length;i++){
    const m=a.minuteDays[i],d=a.dailyDays[i];
    if(!date.test(m?.date)||m.date!==d?.date||
       (i>0&&m.date<=a.minuteDays[i-1].date)||
       !Array.isArray(m.pages)||!Array.isArray(d.pages))
      throw Error("INVALID_ARCHIVE_DATE_OR_PAGES");
    dates.push(m.date);
  }
  return {code:a.code,dates,first:dates[0],last:dates.at(-1),sessions:dates.length,
    dateSignature:dates.join(",")};
}
const safeFile=p=>{const size=statSync(p).size;if(size<2||size>16*1024*1024)throw Error("INVALID_SIZE");return JSON.parse(readFileSync(p,"utf8"));};
export function auditSavedCaptures({benchmark,folderEntries}){
  const closes=validateBenchmarkCloses(benchmark?.closes);
  if(benchmark?.benchmark!=="TOPIX"&&benchmark?.benchmark!=="NIKKEI225")
    throw Error("INVALID_BENCHMARK_NAME");
  if(!Array.isArray(folderEntries)||folderEntries.length===0||folderEntries.length>300)
    throw Error("INVALID_INVENTORY_INPUT");
  const files=[],rejected=[];
  const known=new Set();
  for(const e of folderEntries){
    try{
      if(typeof e?.file!=="string"||!pattern.test(basename(e.file)))continue;
      const m=inspectCaptureMetadata(e.capture);
      const key=m.code+"|"+m.dateSignature;
      if(known.has(key)){rejected.push({file:basename(e.file),reason:"DUPLICATE_CODE_DATE_COHORT"});continue;}
      known.add(key);
      const readyDates=m.dates.filter(d=>priorMarketRegime(d,closes).regime!=="UNKNOWN");
      files.push({file:e.file,code:m.code,first:m.first,last:m.last,
        sessions:m.sessions,benchmarkReadySessions:readyDates.length,
        fullBenchmarkCoverage:readyDates.length===m.sessions,
        dateSignature:m.dateSignature});
    }catch(e){rejected.push({file:basename(e?.file??"UNKNOWN"),reason:"INVALID_METADATA"});}
  }
  const grouped=new Map();
  for(const f of files){
    const x=grouped.get(f.dateSignature)??[];
    x.push(f);grouped.set(f.dateSignature,x);
  }
  const cohorts=[...grouped.values()].map(v=>({
    first:v[0].first,last:v[0].last,tradingDates:v[0].sessions,
    stocks:v.length,benchmarkReadySessions:v[0].benchmarkReadySessions,
    eligibleAsOneSharedCohort:v[0].sessions>=2&&v[0].fullBenchmarkCoverage,
    codes:v.map(x=>x.code).sort(),
    files:v.map(x=>x.file).sort()
  })).sort((a,b)=>b.stocks-a.stocks||b.tradingDates-a.tradingDates||a.first.localeCompare(b.first));
  return {status:"OFFLINE_PRIVATE_INVENTORY_ONLY",
    totalValidFiles:files.length,rejectedCount:rejected.length,
    rejects:rejected,cohorts,
    warning:"Metadata only; archives have NOT passed minute/daily reconciliation. Never sum overlapping cohorts or assume a new independent trading event.",
    eligibleForProduction:false,eligibleForNotifications:false};
}
export function inventoryFolderEntries(folders){
  const entries=[];
  for(const dir of folders){
    for(const name of readdirSync(dir)){
      if(!pattern.test(name))continue;
      const path=join(dir,name);
      entries.push({file:path,capture:safeFile(path)});
      if(entries.length>300)throw Error("TOO_MANY_LOCAL_ARCHIVES");
    }
  }
  return entries;
}
const running=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(running){
  try{
    const args=process.argv.slice(2);
    if(args.length<2||args.length>6)throw Error("USAGE_BENCHMARK_THEN_1_TO_5_DIRECTORIES");
    const [bench,...dirs]=args;
    const out=auditSavedCaptures({benchmark:safeFile(bench),folderEntries:inventoryFolderEntries(dirs)});
    // Avoid noisy disclosure of absolute private paths in terminal output.
    console.log(JSON.stringify({...out,cohorts:out.cohorts.map(x=>({
      first:x.first,last:x.last,tradingDates:x.tradingDates,stocks:x.stocks,
      benchmarkReadySessions:x.benchmarkReadySessions,eligibleAsOneSharedCohort:x.eligibleAsOneSharedCohort,
      codes:x.codes,filenames:x.files.map(f=>basename(f))
    }))},null,2));
  }catch(e){
    console.error("BB_ARCHIVE_INVENTORY_BLOCKED",
      e instanceof Error && /^[A-Z_0-9]+$/.test(e.message)?e.message:"UNAVAILABLE_OR_BAD_LOCAL_ARCHIVE");
    process.exitCode=1;
  }
}
