#!/usr/bin/env node
/** Offline daily MA75 event extraction from validated local captures only. */
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {validateMa75SavedDailyForReplay,readMa75PrivateSavedDate} from './ma75-jquants-bulk-retrospective.mjs';
import {classifyMa75DailyEvents} from './ma75-daily-events.mjs';
try{
 const args=process.argv.slice(2);
 if(args.some(a=>!/^--(code|from|to)=/.test(a))||new Set(args.map(a=>a.split('=')[0])).size!==args.length)throw Error('INVALID_ARGUMENTS');
 const get=k=>args.find(x=>x.startsWith('--'+k+'='))?.split('=').slice(1).join('=');
 const code=get('code')??'3762',from=get('from')??'2026-07-01',to=get('to')??'2026-10-30';
 const validDay=d=>/^20\d{2}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
 if(!/^[0-9]{3}[0-9A-Z]$/.test(code)||![from,to].every(validDay)||from>to)throw Error('INVALID_SCOPE');
 const freeze=JSON.parse(readFileSync(new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url),'utf8'));
 if(!freeze.codes.includes(code))throw Error('CODE_NOT_FROZEN');
 const dates=readdirSync(resolve('research-private')).filter(n=>/^20\d{2}-\d{2}-\d{2}-jquants-daily\.json$/.test(n)).map(n=>n.slice(0,10)).filter(d=>d>=from&&d<=to).sort();
 const rows=[];
 for(const date of dates){
  const saved=readMa75PrivateSavedDate(join(resolve('research-private'),date+'-jquants-daily.json'));
  const projected=validateMa75SavedDailyForReplay(freeze,date,saved);
  const entry=projected.audit.rows.find(x=>x.code===code);
  if(entry?.status!=='DAILY_BAR'||!Number.isFinite(entry.bar?.close)||entry.bar.close<=0)throw Error('BLOCKED_DAILY_BAR_'+date);
  rows.push({date,close:entry.bar.close});
 }
 if(rows.length<76)throw Error('NEED_AT_LEAST_76_VALID_DAILY_BARS');
 const result=classifyMa75DailyEvents(rows);
 console.log(JSON.stringify({status:'HISTORICAL_MA75_DAILY_EVENTS_ONLY',code,from,to,validatedDailyBars:rows.length,
  ...result,corporateActionsIndependentlyVerified:false,calendarCompletenessIndependentlyVerified:false,
  intradayJoined:false,forwardOutcomeVerified:false,networkRequests:0,productionWrites:false},null,2));
}catch(e){console.error('MA75_DAILY_EVENTS_BLOCKED '+String(e.message).slice(0,120));process.exitCode=1;}
