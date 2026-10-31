/** Read-only aggregation of reconciled historical post-09:05 pilot reports. */
const pct=n=>Number(n.toFixed(5));
export function summarizePost905Cohort(reports){
 if(!Array.isArray(reports))throw new TypeError('INVALID_REPORTS');
 const seen=new Set(),accepted=[],excluded=[];
 for(const r of reports){
  const code=r?.code,date=r?.date,key=code+'|'+date;
  if(typeof code!=='string'||typeof date!=='string'||seen.has(key))
   throw new TypeError('INVALID_OR_DUPLICATE_COHORT_SCOPE');
  seen.add(key);
  const p=r?.post905;
  const valid=r.status==='HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH'&&
   r.dailyReconciliationMatched===true&&r.metricsReleasedForHistoricalResearch===true&&
   r.pageChainComplete===true&&r.historicalQualityHold===false&&
   p?.code===code&&p?.date===date&&p?.hindsightOnly===true&&
   p?.eligibleForNotifications===false&&p?.eligibleForProduction===false&&
   p?.pre905BarCount===5&&p?.post905MorningBarCount>0&&
   Number.isFinite(p?.upsideFromReferencePercent)&&
   Number.isFinite(p?.downsideFromReferencePercent);
  if(!valid){excluded.push({code,date,reason:'UNVERIFIED_OR_INCOMPLETE'});continue}
  accepted.push({code,date,upside:p.upsideFromReferencePercent,
   downside:p.downsideFromReferencePercent});
 }
 const n=accepted.length;
 const average=key=>n?pct(accepted.reduce((s,r)=>s+r[key],0)/n):null;
 const thresholds=[0.5,1,2].map(t=>({
  thresholdPercent:t,
  reachedCount:accepted.filter(r=>r.upside>=t-0.00001).length,
  denominator:n,
  reachedRatePercent:n?pct(100*accepted.filter(r=>r.upside>=t-0.00001).length/n):null
 }));
 return {version:'post905_cohort_shadow_v1',submitted:reports.length,accepted:n,
  excluded,uniqueCodes:new Set(accepted.map(r=>r.code)).size,
  uniqueDates:new Set(accepted.map(r=>r.date)).size,
  meanMaximumUpsidePercent:average('upside'),
  meanMinimumPriceChangePercent:average('downside'),
  thresholds,hindsightOnly:true,verifiedTradingEdge:false,
  eligibleForNotifications:false,eligibleForProduction:false};
}
