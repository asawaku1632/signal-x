/** Retrospective morning weakness cohort, with next-session close outcomes.
 * Never infer a 09:05 executable entry or intraminute low/high ordering.
 */
export function analyzeMa75MorningWeakness(observations,{minOverextension=30,minMorningDrop=1}={}){
 if(!Array.isArray(observations)||!Number.isFinite(minOverextension)||minOverextension<0||
 !Number.isFinite(minMorningDrop)||minMorningDrop<0)throw Error('INVALID_CONFIG');
 const rows=[...observations];
 for(let i=0;i<rows.length;i++){
  const r=rows[i];
  if(typeof r?.date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(r.date)||
   !Number.isFinite(r.close)||r.close<=0||!Number.isFinite(r.distancePercent)||
   (i>0&&rows[i-1].date>=r.date))throw Error('INVALID_OR_UNSORTED_OBSERVATIONS');
 }
 const candidates=rows.filter(r=>r.distancePercent>=minOverextension&&
  r.minuteStatus==='HISTORICAL_METRICS_ONLY'&&
  Number.isFinite(r.post905?.downsidePercent)&&
  r.post905.downsidePercent<=-minMorningDrop);
 const events=candidates.map(r=>{
  const index=rows.indexOf(r),next=rows[index+1];
  const nextClosePercent=next?Number(((next.close/r.close-1)*100).toFixed(4)):null;
  return {date:r.date,ma75DistancePercent:r.distancePercent,
   morningDownsidePercent:r.post905.downsidePercent,
   morningUpsidePercent:r.post905.upsidePercent,
   nextObservedDate:next?.date??null,nextClosePercent,
   nextSessionIsConsecutiveInValidatedTradingCalendar:false,
   outcomeKnownOnlyAfterNextClose:true};
 });
 const observed=events.filter(e=>e.nextClosePercent!==null);
 return {status:'HISTORICAL_MA75_MORNING_WEAKNESS_ONLY',
  minOverextension,minMorningDrop,candidateDays:events.length,
  observedNextCloseDays:observed.length,
  averageNextClosePercent:observed.length?Number((observed.reduce((s,e)=>s+e.nextClosePercent,0)/observed.length).toFixed(4)):null,
  events,independentEventsVerified:false,minuteLowTimeVerified:false,
  true905AvailabilityVerified:false,forwardValidationVerified:false,
  verifiedTradingEdge:false,eligibleForProduction:false,eligibleForNotifications:false};
}
