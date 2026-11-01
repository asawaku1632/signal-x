#!/usr/bin/env node
/**
 * Read one already-saved JSON bundle; write a summary only with exclusive create.
 * Absolutely no J-Quants or Supabase calls, secrets, cron or production effects.
 */
import {lstatSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {auditMa75OriginalDailyBundle} from '../../app/lib/research/ma75OriginalDailyBundle.mjs';

const MAX_JSON_BYTES=50*1024*1024;
const FROZEN_FILE=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
export function parseMa75BundleArgs(argv){
 const args={};
 for(const token of argv){
  const match=/^--(input|output)=(.+)$/.exec(token);
  if(!match||args[match[1]])throw new TypeError('REQUIRE_UNIQUE_--input_AND_--output_JSON');
  args[match[1]]=match[2];
 }
 if(!args.input||!args.output||!args.input.endsWith('.json')||
    !args.output.endsWith('.json')||
    resolve(args.input)===resolve(args.output))
  throw new TypeError('REQUIRE_DISTINCT_JSON_PATHS');
 return args;
}
export function summarizeMa75BundleFiles({input,output}, {
 read=readFileSync,stat=lstatSync,write=writeFileSync,now=()=>new Date()
}={}){
 const file=stat(input);
 if(!file.isFile()||file.isSymbolicLink()||file.size<=0||file.size>MAX_JSON_BYTES)
   throw new TypeError('INVALID_INPUT_FILE_OR_SIZE');
 const raw=read(input,'utf8');
 if(Buffer.byteLength(raw,'utf8')>MAX_JSON_BYTES)
   throw new TypeError('INPUT_EXCEEDS_SAFE_SIZE');
 const freeze=JSON.parse(read(FROZEN_FILE,'utf8'));
 const bundle=JSON.parse(raw);
 const auditClock=now();
 if(!(auditClock instanceof Date)||!Number.isFinite(auditClock.getTime()))
  throw new TypeError('INVALID_AUDIT_SYSTEM_CLOCK');
 const summary=auditMa75OriginalDailyBundle(freeze,bundle,{
  asOf:auditClock.toISOString()
 });
 // Always exclusive: do not overwrite a previous audit or source file.
 write(output,JSON.stringify(summary,null,2)+'\n',{
   flag:'wx',encoding:'utf8',mode:0o600
 });
 return summary;
}
export function main(argv=process.argv.slice(2)){
 const args=parseMa75BundleArgs(argv);
 const summary=summarizeMa75BundleFiles(args);
 process.stdout.write(JSON.stringify({
  status:summary.structural76DayCoverage?
   'HISTORICAL_STRUCTURAL_MATCH_ONLY':'HISTORICAL_RESEARCH_BLOCKED',
  submittedDateCaptures:summary.submittedDateCaptures,
  missingDates:summary.missingDateCaptures.length,
  eligibleForNotifications:false,eligibleForProduction:false
 })+'\n');
 return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main()}catch{
  // Do not relay exception text: untrusted source JSON might contain secrets.
  process.stderr.write('MA75_OFFLINE_BUNDLE_FAILED: INVALID_OR_UNTRUSTED_INPUT\n');
  process.exitCode=1;
 }
}
