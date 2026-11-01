#!/usr/bin/env node
/** Offline research-only composition of validated MA75 daily events and overextension. */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {analyzeMa75Overextension} from './ma75-overextension.mjs';
try{
 const script=fileURLToPath(new URL('./run-ma75-daily-events.mjs',import.meta.url));
 const child=spawnSync(process.execPath,[script,...process.argv.slice(2)],{encoding:'utf8',maxBuffer:8*1024*1024,timeout:120000});
 if(child.error||child.status!==0)throw Error('DAILY_EVENT_AUDIT_FAILED '+String(child.stderr??child.error?.message).slice(0,150));
 const audit=JSON.parse(child.stdout);
 if(audit.status!=='HISTORICAL_MA75_DAILY_EVENTS_ONLY'||audit.validatedDailyBars<76||
  audit.corporateActionsIndependentlyVerified!==false||audit.eligibleForProduction!==false)throw Error('UNEXPECTED_DAILY_AUDIT_CONTRACT');
 const analysis=analyzeMa75Overextension(audit.events);
 console.log(JSON.stringify({code:audit.code,from:audit.from,to:audit.to,
  validatedDailyBars:audit.validatedDailyBars,ma75ComparisonDays:audit.days,
  breakoutDates:audit.breakoutDates,nearDates:audit.nearDates,reboundDates:audit.reboundDates,
  ...analysis,corporateActionsIndependentlyVerified:false,
  calendarCompletenessIndependentlyVerified:false,minuteDataJoined:false,
  actual905AvailabilityVerified:false,networkRequests:0,productionWrites:false},null,2));
}catch(e){console.error('MA75_OVEREXTENSION_BLOCKED '+e.message);process.exitCode=1;}
