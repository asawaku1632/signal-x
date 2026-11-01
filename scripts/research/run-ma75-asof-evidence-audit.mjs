#!/usr/bin/env node
/** Offline composition: historical MA75 summary and as-of knowledge audit. */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {auditMa75DecisionEvidence} from './ma75-asof-evidence-audit.mjs';
try{
 const script=fileURLToPath(new URL('./run-ma75-minute-join.mjs',import.meta.url));
 const run=spawnSync(process.execPath,[script,...process.argv.slice(2)],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
 if(run.error||run.status!==0)throw Error('JOIN_FAILED '+String(run.stderr).slice(0,150));
 const data=JSON.parse(run.stdout);
 if(data.status!=='HISTORICAL_MA75_MINUTE_SUMMARY_JOIN_ONLY'||data.eligibleForProduction!==false)throw Error('INVALID_SOURCE');
 const result=auditMa75DecisionEvidence(data.observations);
 console.log(JSON.stringify({code:data.code,observationDays:data.observationDays,minuteMetricDays:data.minuteMetricDays,...result,
  networkRequests:0,productionWrites:false},null,2));
}catch(e){console.error('ASOF_AUDIT_BLOCKED '+e.message);process.exitCode=1;}
