// Read-only, fail-closed research comparison; no production integration.
import {classifyMarketBreadth} from './marketBreadthShadow.mjs';
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const stamp=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s)?Date.parse(s):NaN;
function stats(rows){
 const v=rows.map(x=>x.return5dPct).sort((a,b)=>a-b),n=v.length;
 return {observations:n,uniqueDates:new Set(rows.map(x=>x.tradeDate)).size,uniqueSymbols:new Set(rows.map(x=>x.code)).size,
 mean5dPct:n?v.reduce((a,b)=>a+b,0)/n:null,median5dPct:n?(v[Math.floor((n-1)/2)]+v[Math.floor(n/2)])/2:null,
 positiveRate:n?v.filter(x=>x>0).length/n:null};
}
export function compareBreadthForward(snapshots,observations){
 const byDay=new Map(),seen=new Set(),groups={INDEX_BREADTH_DIVERGENCE:[],OBSERVED:[]};
 for(const raw of Array.isArray(snapshots)?snapshots:[]){
  const m=classifyMarketBreadth(raw);if(m.status==='UNAVAILABLE')continue;
  const previous=byDay.get(m.tradeDate);
  if(previous===null)continue; // Permanent quarantine, including third and later duplicates.
  if(previous!==undefined)byDay.set(m.tradeDate,null);
  else byDay.set(m.tradeDate,m);
 }
 let rejected=0;
 for(const row of Array.isArray(observations)?observations:[]){
  const m=byDay.get(row?.tradeDate),signalAt=stamp(row?.signalGeneratedAt),evaluatedAt=stamp(row?.evaluatedAt),marketAt=stamp(m?.observedAt);
  const key=`${row?.tradeDate}|${row?.code}`;
  if(!m||!/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(row?.code??'')||!valid(row?.return5dPct)||
   !Number.isFinite(signalAt)||!Number.isFinite(evaluatedAt)||!Number.isFinite(marketAt)||
   !(marketAt<signalAt&&signalAt<evaluatedAt)||row?.horizonTradingDays!==5||row?.outcomeVerified!==true||
   seen.has(key)){rejected++;continue;}
  seen.add(key);groups[m.status].push({tradeDate:row.tradeDate,code:row.code,return5dPct:row.return5dPct});
 }
 return {researchOnly:true,ruleVersion:'market-breadth-forward-v1',divergence:stats(groups.INDEX_BREADTH_DIVERGENCE),
 other:stats(groups.OBSERVED),rejected,warning:'Descriptive only; no significance, causality, or deployability established.'};
}
