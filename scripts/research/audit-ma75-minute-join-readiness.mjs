#!/usr/bin/env node
/** Offline, read-only MA75 + 09:05 source readiness. Never asserts an edge. */
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
const argv=process.argv.slice(2);
const get=k=>argv.find(x=>x.startsWith('--'+k+'='))?.slice(k.length+3);
const code=get('code')??'3762',minuteDir=get('minute-dir')??'minute-research-reports',dailyDir=get('daily-dir')??'research-private';
const from=get('from')??'2026-07-01',to=get('to')??'2026-10-30';
const validDay=d=>/^20\d{2}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
try{
 if(!/^[0-9]{3}[0-9A-Z]$/.test(code)||![from,to].every(validDay)||from>to||
 [minuteDir,dailyDir].some(x=>!/^[a-zA-Z0-9_.-]+$/.test(x)||x==='.'||x==='..')||
 argv.some(x=>!/^--(code|minute-dir|daily-dir|from|to)=/.test(x)))
 throw Error('INVALID_ARGUMENTS');
 const names=readdirSync(resolve(minuteDir)).filter(x=>x.startsWith('research-'+code+'-')&&x.endsWith('.json')).sort();
 const rows=[],invalid=[];
 for(const name of names){
  const date=name.slice(('research-'+code+'-').length,-5);
  if(!validDay(date)||date<from||date>to)continue;
  try{
   const r=JSON.parse(readFileSync(join(resolve(minuteDir),name),'utf8'));
   if(r.code!==code||r.date!==date||r.status!=='HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH'||
    r.dailyReconciliationMatched!==true||r.metricsReleasedForHistoricalResearch!==true||
    r.eligibleForProduction!==false||r.eligibleForNotifications!==false||
    r.post905?.code!==code||r.post905?.date!==date||
    !Number.isInteger(r.parsedMinuteBars)||r.parsedMinuteBars<1)throw Error('INVALID_RECONCILIATION');
   rows.push({date,minuteBars:r.parsedMinuteBars,pre905Bars:r.post905.pre905BarCount,
    post905MetricEligible:Number.isFinite(r.post905.asOf905ReferenceClose)&&r.post905.asOf905ReferenceClose>0&&
    Number.isFinite(r.post905.upsideFromReferencePercent)&&Number.isFinite(r.post905.downsideFromReferencePercent)});
  }catch{invalid.push(date);}
 }
 const dailyNames=existsSync(resolve(dailyDir))?new Set(readdirSync(resolve(dailyDir))):new Set();
 const matchedDailyFileDates=rows.filter(r=>dailyNames.has(r.date+'-jquants-daily.json')).map(r=>r.date);
 console.log(JSON.stringify({status:'OFFLINE_MA75_SOURCE_READINESS_ONLY',code,from,to,
  structurallyReconciledMinuteDates:rows.length,post905MetricEligibleDates:rows.filter(r=>r.post905MetricEligible).length,
  post905MetricUnavailableDates:rows.filter(r=>!r.post905MetricEligible).map(r=>r.date),
  localDailyCaptureFilenameMatches:matchedDailyFileDates.length,
  localDailyCaptureFilenameMissing:rows.filter(r=>!dailyNames.has(r.date+'-jquants-daily.json')).map(r=>r.date),
  invalidMinuteReports:invalid,
  dailyCaptureContentsValidated:false,ma75Computed:false,joinedBarSeriesValidated:false,
  actual905AvailabilityVerified:false,verifiedTradingEdge:false,
  eligibleForProduction:false,eligibleForNotifications:false,networkRequests:0,productionWrites:false,
  note:'Daily filename presence does not establish valid MA75 inputs. Requires integrity-checked daily bar extraction, 75-session warmup, chronology and forward validation.'},null,2));
}catch(e){console.error('MA75_READINESS_FAILED '+e.message);process.exitCode=1;}
