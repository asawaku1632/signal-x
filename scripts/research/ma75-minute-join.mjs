/** Join already validated retrospective MA75 points with historical 09:05 report summaries. */
export function joinMa75Post905(points,reports,{code='3762'}={}){
 if(!Array.isArray(points)||!Array.isArray(reports)||!/^[0-9]{3}[0-9A-Z]$/.test(code))throw Error('INVALID_INPUT');
 const byDate=new Map();
 for(const r of reports){
  if(r?.code!==code||typeof r.date!=='string'||byDate.has(r.date))throw Error('INVALID_OR_DUPLICATE_MINUTE_REPORT');
  byDate.set(r.date,r);
 }
 return points.map(p=>{
  const r=byDate.get(p.date);
  const structural=r?.status==='HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH'&&
   r.dailyReconciliationMatched===true&&r.metricsReleasedForHistoricalResearch===true&&
   r.eligibleForProduction===false&&r.eligibleForNotifications===false&&
   r.post905?.code===code&&r.post905?.date===p.date&&
   r.post905?.eligibleForProduction===false&&r.post905?.eligibleForNotifications===false;
  const m=r?.post905;
  const eligible=structural&&Number.isFinite(m?.asOf905ReferenceClose)&&m.asOf905ReferenceClose>0&&
   Number.isFinite(m?.upsideFromReferencePercent)&&Number.isFinite(m?.downsideFromReferencePercent);
  return {...p,minuteStatus:!r?'MISSING_REPORT':!structural?'INVALID_RECONCILIATION':!eligible?'MISSING_905_METRIC':'HISTORICAL_METRICS_ONLY',
   post905:eligible?{referenceClose:m.asOf905ReferenceClose,
    morningHighestHigh:m.post905HighestHigh,morningLowestLow:m.post905LowestLow,
    upsidePercent:m.upsideFromReferencePercent,downsidePercent:m.downsideFromReferencePercent,
    firstOnePctHighAt:m.firstPost905OnePctHighAt??null,
    firstTwoPctHighAt:m.firstPost905TwoPctHighAt??null}:null,
   minuteLowTimeAvailable:false,minuteHighLowOrderKnown:false,
   actual905AvailabilityVerified:false,verifiedTradingEdge:false};
 });
}
