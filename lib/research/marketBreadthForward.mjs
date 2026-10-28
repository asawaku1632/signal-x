// Read-only research comparison. No database, network, or trading side effects.
import { classifyMarketBreadth } from './marketBreadthShadow.mjs';

const dateRE = /^\d{4}-\d{2}-\d{2}$/;
const valid = n => typeof n === 'number' && Number.isFinite(n);
function stats(rows) {
  const values = rows.map(r => r.return5dPct).sort((a,b)=>a-b);
  const n = values.length;
  return { observations:n, uniqueDates:new Set(rows.map(r=>r.tradeDate)).size,
    uniqueSymbols:new Set(rows.map(r=>r.code)).size,
    mean5dPct:n?values.reduce((a,b)=>a+b,0)/n:null,
    median5dPct:n?(values[Math.floor((n-1)/2)]+values[Math.floor(n/2)])/2:null,
    positiveRate:n?values.filter(x=>x>0).length/n:null };
}
/** Strict as-of join: market snapshot must predate signal generation; 5d outcome must be later. */
export function compareBreadthForward(snapshots, observations) {
  const marketByDay = new Map();
  for(const snapshot of Array.isArray(snapshots)?snapshots:[]) {
    const classified=classifyMarketBreadth(snapshot);
    if(classified.status==='UNAVAILABLE')continue;
    const previous=marketByDay.get(classified.tradeDate);
    // Multiple intraday snapshots are ambiguous without an explicit matching rule.
    if(previous)marketByDay.set(classified.tradeDate,null);
    else if(!marketByDay.has(classified.tradeDate))marketByDay.set(classified.tradeDate,classified);
  }
  const seen=new Set(), groups={INDEX_BREADTH_DIVERGENCE:[],OBSERVED:[]};
  let rejected=0;
  for(const row of Array.isArray(observations)?observations:[]) {
    const m=marketByDay.get(row?.tradeDate);
    const signalAt=Date.parse(row?.signalGeneratedAt??'');
    const evaluatedAt=Date.parse(row?.evaluatedAt??'');
    const marketAt=Date.parse(m?.observedAt??'');
    const key=`${row?.tradeDate}|${row?.code}`;
    if(!m || !dateRE.test(row?.tradeDate??'') || !/^[0-9]{4}[A-Z]?$/.test(row?.code??'') ||
       !valid(row?.return5dPct) || !Number.isFinite(signalAt) || !Number.isFinite(evaluatedAt) ||
       !(marketAt < signalAt && signalAt < evaluatedAt) ||
       row?.horizonTradingDays!==5 || row?.outcomeVerified!==true || seen.has(key)) { rejected++;continue; }
    seen.add(key);
    groups[m.status].push({tradeDate:row.tradeDate,code:row.code,return5dPct:row.return5dPct});
  }
  return {researchOnly:true,ruleVersion:'market-breadth-forward-v1',
    divergence:stats(groups.INDEX_BREADTH_DIVERGENCE),other:stats(groups.OBSERVED),rejected,
    warning:'Descriptive only; no significance, causality, or deployability established.'};
}
