#!/usr/bin/env node
/** Manual, read-only JSON export audit. No credentials, network, DB writes or notifications. */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {adaptPreopenDbRows} from "../app/lib/research/preopenDbAdapter.mjs";
import {classifyPreopenResearchDates} from "../app/lib/research/preopenResearchPartition.mjs";
export function analyzePreopenExportJson(text){
 if(typeof text!=="string"||Buffer.byteLength(text)>5*1024*1024)throw Error("INVALID_PREOPEN_JSON_EXPORT");
 const data=JSON.parse(text);
 if(!Array.isArray(data))throw Error("EXPECTED_JSON_ARRAY");
 const rows=adaptPreopenDbRows(data);
 return {...classifyPreopenResearchDates(rows),inputMode:"MANUAL_OFFLINE_JSON_EXPORT",liveDbAccess:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.length!==1||args[0].startsWith("-")){
  process.stderr.write("Usage: node scripts/report-preopen-json-export.mjs approved-preopen-rows.json\n");process.exitCode=2;
 }else try{
  const result=analyzePreopenExportJson(readFileSync(args[0],"utf8"));
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
 }catch(e){process.stderr.write("Preopen export rejected: "+e.message+"\n");process.exitCode=1;}
}
