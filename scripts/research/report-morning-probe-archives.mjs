#!/usr/bin/env node
/**
 * Offline read-only researcher report for USER-SAVED JSON evidence.
 * Usage: node scripts/research/report-morning-probe-archives.mjs one.json two.json
 * No network calls, no database writes, no retrospective trade labels.
 */
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {summarizeMorningProbeArchives,verifyMorningProbeArchive}
  from "../../app/lib/research/morningProbeArchive.mjs";

const args=process.argv.slice(2);
if(args.length<1||args.length>200){
  console.error("Usage: node scripts/research/report-morning-probe-archives.mjs <saved-json> [more-json]");
  process.exitCode=2;
}else{
  const files=[];
  const rejected=[];
  for(const arg of args){
    try {
      if(typeof arg!=="string"||!arg.toLowerCase().endsWith(".json"))
        throw Error("NOT_JSON");
      const path=resolve(arg);
      if(statSync(path).size>256*1024)throw Error("EVIDENCE_FILE_TOO_LARGE");
      const content=JSON.parse(readFileSync(path,"utf8"));
      // Accept the exported sealed archive, not the entire HTTP wrapper.
      if(!verifyMorningProbeArchive(content))throw Error("INVALID_DIGEST_OR_ASOF");
      files.push(content);
    }catch(error){
      rejected.push({file:arg,reason:error instanceof Error?error.message:"UNKNOWN"});
    }
  }
  const report=summarizeMorningProbeArchives(files);
  process.stdout.write(JSON.stringify({...report,filesAccepted:files.length,
    filesRejected:rejected.length,discarded:rejected},null,2)+"\n");
  if(rejected.length||!files.length)process.exitCode=1;
}
