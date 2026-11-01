#!/usr/bin/env node
/** Offline-only aggregation of reconciled historical one-code/day reports.
 * No API access, credentials, database writes, trading signals or notifications.
 */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const files=process.argv.slice(2);
if(files.length===0||files.length>100) {
 console.error('Usage: node scripts/research/summarize-minute-reports.mjs report1.json [report2.json ...] (1-100 files)');
 process.exitCode=1;
} else {
 try {
  const seen=new Set(), rows=[];
  for(const file of files){
   const r=JSON.parse(readFileSync(resolve(file),'utf8'));
   if(r.status!=='HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH'||
      r.dailyReconciliationMatched!==true||
      r.metricsReleasedForHistoricalResearch!==true||
      r.eligibleForProduction!==false||r.eligibleForNotifications!==false||
      !/^20\\d{2}-\\d{2}-\\d{2}$/.test(r.date)||
      !/^[0-9]{3}[0-9A-Z]$/.test(r.code)||
      !Number.isFinite(r.post905?.upsideFromReferencePercent)||
      !Number.isFinite(r.post905?.downsideFromReferencePercent)||
      r.post905?.code!==r.code||r.post905?.date!==r.date)
    throw new Error('INVALID_OR_UNRECONCILED_REPORT: '+file);
   const key=r.code+':'+r.date;
   if(seen.has(key))throw new Error('DUPLICATE_CODE_DATE: '+key);
   seen.add(key);
   rows.push({code:r.code,date:r.date,upsidePct:r.post905.upsideFromReferencePercent,
     downsidePct:r.post905.downsideFromReferencePercent,
     pre905Bars:r.post905.pre905BarCount,
     minuteBars:r.parsedMinuteBars});
  }
  const mean=k=>rows.reduce((s,r)=>s+r[k],0)/rows.length;
  console.log(JSON.stringify({
   status:'OFFLINE_HISTORICAL_DESCRIPTIVE_ONLY',count:rows.length,
   uniqueCodes:new Set(rows.map(r=>r.code)).size,
   uniqueDates:new Set(rows.map(r=>r.date)).size,
   averageMaximumMorningUpsidePct:mean('upsidePct'),
   averageMaximumMorningDownsidePct:mean('downsidePct'),
   records:rows.sort((a,b)=>a.date.localeCompare(b.date)||a.code.localeCompare(b.code)),
   caveats:['Intraday extrema are not executable returns or win rates',
    'No chronological high/low execution ordering, fees, slippage or actual 09:05 availability',
    'Does not verify 76-session MA75 coverage, 953-code universe, or trading edge'],
   eligibleForNotifications:false,eligibleForProduction:false
  },null,2));
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
