#!/usr/bin/env node
// OFFLINE SHADOW ONLY. Explicit JSON file, no API/DB/network. No licensed data printed.
import {readFileSync} from 'node:fs';
import {evaluateDailyEvent,firstPostReleaseSession} from './earnings-postreaction-core.mjs';
const file=process.argv[2];
if (!file || process.argv.length!==3) { console.error('Usage: node scripts/research/earnings-postreaction-local.mjs <local-json-file>');process.exit(2); }
const input=JSON.parse(readFileSync(file,'utf8'));
if (!Array.isArray(input.sessions)||!Array.isArray(input.events)||!input.events.length) throw Error('sessions and nonempty events required');
const seen=new Set(), rows=[], excluded={};
const exclude=s=>{excluded[s]=(excluded[s]||0)+1};
for(const e of input.events){
  if(!e || !/^\d{4,5}$/.test(e.code||'') || typeof e.releasedAtJst!=='string'||!Array.isArray(e.bars)) {exclude('INVALID_EVENT');continue;}
  const key=e.code+'|'+e.releasedAtJst;
  if(seen.has(key)){exclude('DUPLICATE_EVENT');continue;} seen.add(key);
  const mapped=firstPostReleaseSession(e.releasedAtJst,input.sessions);
  if(mapped.status!=='OK'){exclude(mapped.status);continue;}
  if(!['POSITIVE','NEGATIVE','UNKNOWN'].includes(e.fundamentalClass)){exclude('UNKNOWN_CLASS');continue;}
  const evaluated=evaluateDailyEvent({eventDate:mapped.eventDate,bars:e.bars});
  if(evaluated.status!=='OK'){exclude(evaluated.status);continue;}
  for(const o of evaluated.outcomes) rows.push({group:e.fundamentalClass,h:o.horizon,status:o.status,value:o.returnPct,code:e.code});
}
const summary=[];
for(const group of ['POSITIVE','NEGATIVE','UNKNOWN'])for(const h of [1,2,3,5,10,20]){
  const subset=rows.filter(r=>r.group===group&&r.h===h),valid=subset.filter(r=>r.status==='MATURED').map(r=>r.value).sort((a,b)=>a-b);
  const n=valid.length,mean=n?valid.reduce((a,b)=>a+b,0)/n:null;
  summary.push({group,horizon:h,matured:n,pending:subset.length-n,uniqueCodes:new Set(subset.filter(r=>r.status==='MATURED').map(r=>r.code)).size,meanPct:mean,medianPct:n?(valid[Math.floor((n-1)/2)]+valid[Math.floor(n/2)])/2:null,positiveRate:n?valid.filter(v=>v>0).length/n:null});
}
console.log(JSON.stringify({status:'OFFLINE_EXPLORATORY_NOT_TRADE_ELIGIBLE',eventsReceived:input.events.length,excluded,summary},null,2));
