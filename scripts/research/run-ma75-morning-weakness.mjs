#!/usr/bin/env node
/** No-network research-only cohort using existing MA75 and minute summaries. */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {analyzeMa75MorningWeakness} from './ma75-morning-weakness.mjs';
try{
 const script=fileURLToPath(new URL('./run-ma75-minute-join.mjs',import.meta.url));
 const run=spawnSync(process.execPath,[script,...process.argv.slice(2)],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
 if(run.error||run.status!==0)throw Error('MINUTE_JOIN_FAILED '+String(run.stderr).slice(0,160));
 const joined=JSON.parse(run.stdout);
 if(joined.status!=='HISTORICAL_MA75_MINUTE_SUMMARY_JOIN_ONLY'||joined.eligibleForProduction!==false)throw Error('UNSAFE_JOIN_CONTRACT');
 const result=analyzeMa75MorningWeakness(joined.observations);
 console.log(JSON.stringify({code:joined.code,observationDays:joined.observationDays,minuteMetricDays:joined.minuteMetricDays,
  ...result,networkRequests:0,productionWrites:false,
  caveat:'Next observed close is not an executable fill; 09:05 outcomes are hindsight, and this cohort is too small for a trading edge.'},null,2));
}catch(e){console.error('MA75_MORNING_WEAKNESS_BLOCKED '+e.message);process.exitCode=1;}
