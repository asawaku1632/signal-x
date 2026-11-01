#!/usr/bin/env node
/* Sequential, bounded, completely offline audit of private J-Quants captures. */
import {readFileSync,lstatSync,writeFileSync} from 'node:fs';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {auditMa75SavedDays} from '../../app/lib/research/ma75SavedDays.mjs';
const frozen=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
const privateRoot=()=>resolve('research-private');
const isPrivate=p=>{
 const rel=relative(privateRoot(),resolve(p));
 return rel!==''&&rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel);
};
export function parseSavedDayArgs(argv){
 const o={};
 for(const a of argv){
  const m=/^--(manifest|output)=(.+)$/.exec(a);
  if(!m||o[m[1]])throw new TypeError('BAD_OR_DUPLICATE_ARGUMENT');
  o[m[1]]=m[2];
 }
 if(!o.manifest||!o.output||!o.manifest.endsWith('.json')||
  !o.output.endsWith('.json')||resolve(o.manifest)===resolve(o.output)||
  !isPrivate(o.manifest)||!isPrivate(o.output))
  throw new TypeError('REQUIRE_PRIVATE_MANIFEST_AND_DISTINCT_OUTPUT');
 return o;
}
export function runSavedDayAudit(argv,{
 read=readFileSync,stat=lstatSync,write=writeFileSync,
 clock=()=>new Date()
}={}){
 const opts=parseSavedDayArgs(argv);
 const load=(path,max)=>{
  if(!isPrivate(path))throw new TypeError('SOURCE_OUTSIDE_PRIVATE_DIRECTORY');
  const s=stat(path);
  if(!s.isFile()||s.isSymbolicLink()||s.size<1||s.size>max)
   throw new TypeError('INVALID_OR_OVERSIZED_PRIVATE_SOURCE');
  const raw=read(path,'utf8');
  if(Buffer.byteLength(raw,'utf8')>max)throw new TypeError('TOO_LARGE_PRIVATE_SOURCE');
  return JSON.parse(raw);
 };
 const manifest=load(opts.manifest,256*1024);
 if(manifest?.version!=='ma75_private_day_manifest_v1'||
  !Array.isArray(manifest.sessions)||!Array.isArray(manifest.entries)||
  typeof manifest.calendarFile!=='string')
  throw new TypeError('INVALID_PRIVATE_DAILY_MANIFEST');
 const calendar=load(manifest.calendarFile,2*1024*1024);
 const freeze=JSON.parse(read(frozen,'utf8'));
 const now=clock(),asOf=now instanceof Date&&Number.isFinite(now.getTime())?
  now.toISOString():null;
 const report=auditMa75SavedDays(freeze,{
  sessions:manifest.sessions,entries:manifest.entries,calendar,asOf,
  load:file=>load(file,16*1024*1024)
 });
 write(opts.output,JSON.stringify(report,null,2)+'\n',{
  flag:'wx',mode:0o600,encoding:'utf8'
 });
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const r=runSavedDayAudit(process.argv.slice(2));
  process.stdout.write(JSON.stringify({savedDayCount:r.examinedDateFiles,
   missingDayCount:r.missingDates.length,
   structuralHistoricalCoverageComplete:r.structuralHistoricalCoverageComplete,
   eligibleForNotifications:false})+'\n');
 }catch{
  process.stderr.write('PRIVATE_MA75_OFFLINE_AUDIT_BLOCKED\n');
  process.exitCode=1;
 }
}
