#!/usr/bin/env node
/** Offline original J-Quants daily integrity audit and SMA75 join, one code. */
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {validateMa75SavedDailyForReplay,readMa75PrivateSavedDate} from './ma75-jquants-bulk-retrospective.mjs';
const argv=process.argv.slice(2);
const get=k=>argv.find(x=>x.startsWith('--'+k+'='))?.slice(k.length+3);
const code=get('code')??'3762',from=get('from')??'2026-07-01',to=get('to')??'2026-10-30';
const dir=get('dir')??'research-private';
const validDay=d=>/^20\d{2}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
try{
 if(!/^[0-9]{3}[0-9A-Z]$/.test(code)||![from,to].every(validDay)||from>to||
 !/^[a-zA-Z0-9_.-]+$/.test(dir)||dir==='.'||dir==='..'||
 argv.some(a=>!/^--(code|from|to|dir)=/.test(a)))throw Error('INVALID_ARGUMENTS');
 const freeze=JSON.parse(readFileSync(new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url),'utf8'));
 if(!freeze.codes.includes(code))throw Error('CODE_NOT_FROZEN');
 const files=readdirSync(resolve(dir)).filter(x=>/^20\d{2}-\d{2}-\d{2}-jquants-daily\.json$/.test(x)).sort();
 const dates=files.map(x=>x.slice(0,10)).filter(d=>d>=from&&d<=to);
 const rows=[],blocked=[];
 for(const date of dates){
  try{
   const saved=readMa75PrivateSavedDate(join(resolve(dir),date+'-jquants-daily.json'));
   if(!saved)throw Error('MISSING');
   const projected=validateMa75SavedDailyForReplay(freeze,date,saved);
   const entry=projected.audit.rows.find(r=>r.code===code);
   if(!entry||entry.status!=='DAILY_BAR')throw Error('MISSING_OR_INVALID_FROZEN_DAILY_BAR');
   const b=entry.bar;
   const close=b?.close??b?.Close??b?.C;
   if(typeof close!=='number'||!Number.isFinite(close)||close<=0)throw Error('INVALID_CLOSE');
   rows.push({date,close});
  }catch(e){blocked.push({date,reason:String(e.message).slice(0,90)});}
 }
 const evaluated=[];
 for(let i=75;i<rows.length;i++){
  // Prior 75 closes only, never include today's close in the reference.
  const prior=rows.slice(i-75,i);
  const sma75=prior.reduce((s,r)=>s+r.close,0)/75;
  evaluated.push({date:rows[i].date,close:rows[i].close,prior75Sma:Number(sma75.toFixed(6)),
   closeAbovePrior75Sma:rows[i].close>sma75});
 }
 console.log(JSON.stringify({status:'OFFLINE_DAILY_INTEGRITY_AND_SMA75_AUDIT_ONLY',
  code,from,to,filesInspected:dates.length,validatedDailyBars:rows.length,
  blocked,firstValidatedDate:rows[0]?.date??null,lastValidatedDate:rows.at(-1)?.date??null,
  prior75SmaEvaluatedDays:blocked.length?0:evaluated.length,
  samples:blocked.length?[]:evaluated.slice(-10),
  adjustedPriceSeriesVerified:false,corporateActionsVerified:false,
  calendarCompletenessIndependentlyVerified:false,
  joinedMinuteBarsValidated:false,actual905AvailabilityVerified:false,
  verifiedTradingEdge:false,eligibleForProduction:false,eligibleForNotifications:false,
  networkRequests:0,productionWrites:false,
  caveat:'If any daily capture fails, suppress SMA results. This is close-only descriptive SMA, not an intraday executable strategy.'},null,2));
}catch(e){console.error('MA75_DAILY_AUDIT_FAILED '+e.message);process.exitCode=1;}
