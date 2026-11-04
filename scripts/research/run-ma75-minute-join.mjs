#!/usr/bin/env node
/** Read-only MA75 overextension + reconciled minute summary join. */
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {joinMa75Post905} from './ma75-minute-join.mjs';
try{
 const script=fileURLToPath(new URL('./run-ma75-overextension.mjs',import.meta.url));
 const run=spawnSync(process.execPath,[script,...process.argv.slice(2)],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
 if(run.error||run.status!==0)throw Error('MA75_AUDIT_FAILED '+String(run.stderr).slice(0,120));
 const audit=JSON.parse(run.stdout);
 if(audit.status!=='HISTORICAL_OVEREXTENSION_DESCRIPTIVE_ONLY'||audit.eligibleForProduction!==false)throw Error('INVALID_AUDIT');
 const reports=audit.points.map(p=>{
  const file=resolve('minute-research-reports',`research-${audit.code}-${p.date}.json`);
  try{return JSON.parse(readFileSync(file,'utf8'));}catch(e){
   if(e.code==='ENOENT')return null;
   throw Error('UNREADABLE_MINUTE_REPORT_'+p.date);
  }
 }).filter(Boolean);
 const joined=joinMa75Post905(audit.points,reports,{code:audit.code});
 console.log(JSON.stringify({status:'HISTORICAL_MA75_MINUTE_SUMMARY_JOIN_ONLY',code:audit.code,
  observationDays:joined.length,minuteMetricDays:joined.filter(p=>p.post905).length,
  unavailableDates:joined.filter(p=>!p.post905).map(p=>({date:p.date,reason:p.minuteStatus})),
  observations:joined,minuteLowTimeAvailable:false,actual905AvailabilityVerified:false,
  verifiedTradingEdge:false,eligibleForProduction:false,eligibleForNotifications:false,
  networkRequests:0,productionWrites:false,
  caveat:'Only 09:05-10:00 retrospective high/low summaries; cannot identify low time or low-to-rebound chronology.'},null,2));
}catch(e){console.error('MA75_MINUTE_JOIN_BLOCKED '+e.message);process.exitCode=1;}
