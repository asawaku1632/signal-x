#!/usr/bin/env node
/** Offline-only coverage audit: structural reconciliation and 09:05 metric eligibility are separate. */
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const args=process.argv.slice(2);
const dirArg=args.find(x=>x.startsWith('--dir='))?.slice(6)??'minute-research-reports';
const code=args.find(x=>x.startsWith('--code='))?.slice(7)??'3762';
const from=args.find(x=>x.startsWith('--from='))?.slice(7);
const to=args.find(x=>x.startsWith('--to='))?.slice(5);
const dateOK=d=>/^20\d{2}-\d{2}-\d{2}$/.test(d??'')&&
 !Number.isNaN(Date.parse(d+'T00:00:00Z'))&&
 new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
try{
 if(!/^[0-9]{3}[0-9A-Z]$/.test(code)||!dateOK(from)||!dateOK(to)||from>to||
  !/^[a-zA-Z0-9_.-]+$/.test(dirArg)||['.','..'].includes(dirArg)||
  args.some(x=>!/^--(dir|code|from|to)=/.test(x)))
  throw new Error('USAGE: --code=3762 --from=YYYY-MM-DD --to=YYYY-MM-DD [--dir=minute-research-reports]');
 const days=Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000);
 if(days>370)throw new Error('MAXIMUM_RANGE_370_CALENDAR_DAYS');
 const files=readdirSync(resolve(dirArg)).filter(f=>f.startsWith('research-'+code+'-')&&f.endsWith('.json'));
 if(files.length>1000)throw new Error('MAXIMUM_FILES_1000');
 const reconciled=[],metricEligible=[],metricUnavailable=[],quarantined=[],seen=new Set();
 for(const file of files){
  const date=file.slice(('research-'+code+'-').length,-5);
  if(!dateOK(date)||date<from||date>to)continue;
  if(seen.has(date))throw new Error('DUPLICATE_DATE: '+date);
  seen.add(date);
  let r;
  try{r=JSON.parse(readFileSync(resolve(dirArg,file),'utf8'));}
  catch{quarantined.push({date,reason:'UNREADABLE_JSON'});continue;}
  const structural=r.code===code&&r.date===date&&
   r.status==='HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH'&&
   r.dailyReconciliationMatched===true&&
   r.metricsReleasedForHistoricalResearch===true&&
   r.eligibleForNotifications===false&&r.eligibleForProduction===false&&
   Number.isInteger(r.parsedMinuteBars)&&r.parsedMinuteBars>0&&
   r.post905?.code===code&&r.post905?.date===date&&
   r.post905?.eligibleForNotifications===false&&r.post905?.eligibleForProduction===false;
  if(!structural){quarantined.push({date,reason:'STRUCTURAL_RECONCILIATION_UNVERIFIED'});continue;}
  const record={date,pre905Bars:r.post905.pre905BarCount,minuteBars:r.parsedMinuteBars};
  reconciled.push(record);
  const eligible=Number.isFinite(r.post905?.asOf905ReferenceClose)&&
   r.post905.asOf905ReferenceClose>0&&
   Number.isFinite(r.post905?.upsideFromReferencePercent)&&
   Number.isFinite(r.post905?.downsideFromReferencePercent);
  if(eligible)metricEligible.push(record);
  else metricUnavailable.push({date,reason:'MISSING_905_REFERENCE_OR_RETURNS',
   pre905Bars:r.post905.pre905BarCount,minuteBars:r.parsedMinuteBars});
 }
 const weekdays=[];
 for(let i=0;i<=days;i++){
  const d=new Date(Date.parse(from+'T00:00:00Z')+i*86400000);
  if(d.getUTCDay()!==0&&d.getUTCDay()!==6)weekdays.push(d.toISOString().slice(0,10));
 }
 const have=new Set(reconciled.map(r=>r.date));
 console.log(JSON.stringify({status:'OFFLINE_COVERAGE_INVENTORY_ONLY',code,from,to,
  reconciledDays:reconciled.length,structurallyReconciledDays:reconciled.length,
  post905MetricEligibleDays:metricEligible.length,
  post905MetricUnavailableDays:metricUnavailable.length,
  metricUnavailable,weekdayCandidates:weekdays.length,
  weekdayCandidatesWithoutReconciledReport:weekdays.filter(d=>!have.has(d)),
  warning:'Weekday candidates include Japanese exchange holidays; not an exchange trading calendar or API fetch list',
  pre905FiveBars:reconciled.filter(r=>r.pre905Bars===5).length,
  pre905FewerThanFiveBars:reconciled.filter(r=>Number.isInteger(r.pre905Bars)&&r.pre905Bars<5).length,
  quarantined,records:reconciled.sort((a,b)=>a.date.localeCompare(b.date)),
  ma75RequiredTradingSessions:76,ma75Verified:false,
  fullFrozenUniverseCovered:false,actual905AvailabilityVerified:false,
  eligibleForProduction:false,eligibleForNotifications:false,
  networkRequests:0,productionWrites:false},null,2));
}catch(e){console.error('COVERAGE_AUDIT_FAILED: '+e.message);process.exitCode=1;}
