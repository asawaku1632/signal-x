/** Retrospective MA75 extension: overextension and subsequent close-to-close drawdown.
 * Descriptive only. Never generates buy or sell instructions.
 */
export function analyzeMa75Overextension(events,{thresholds=[20,30,40,50],drawdownPercent=5}={}){
 if(!Array.isArray(events)||!Array.isArray(thresholds)||thresholds.length===0||
 thresholds.some(t=>!Number.isFinite(t)||t<0||t>200)||!Number.isFinite(drawdownPercent)||drawdownPercent<=0||drawdownPercent>100)
 throw new TypeError('INVALID_PARAMETERS');
 const dates=new Set();
 for(let i=0;i<events.length;i++){
  const e=events[i];
  if(typeof e?.date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(e.date)||
   !Number.isFinite(e.close)||e.close<=0||!Number.isFinite(e.prior75Sma)||e.prior75Sma<=0||
   dates.has(e.date)||(i>0&&events[i-1].date>=e.date))throw new TypeError('INVALID_EVENTS');
  dates.add(e.date);
 }
 const points=events.map((e,i)=>{
  const distancePercent=(e.close/e.prior75Sma-1)*100;
  const prior=events[i-1];
  const changePercent=prior?(e.close/prior.close-1)*100:null;
  const peak=events.slice(0,i+1).reduce((p,r)=>Math.max(p,r.close),0);
  const peakDrawdownPercent=(e.close/peak-1)*100;
  return {date:e.date,close:e.close,prior75Sma:e.prior75Sma,
   distancePercent:Number(distancePercent.toFixed(4)),
   thresholdHits:thresholds.filter(t=>distancePercent>=t),
   priorCloseChangePercent:changePercent===null?null:Number(changePercent.toFixed(4)),
   observedWindowPeak:peak,observedWindowDrawdownPercent:Number(peakDrawdownPercent.toFixed(4)),
   observedWindowDrawdownReached:peakDrawdownPercent<=-drawdownPercent};
 });
 return {status:'HISTORICAL_OVEREXTENSION_DESCRIPTIVE_ONLY',observationDays:points.length,
  thresholdDayCounts:Object.fromEntries(thresholds.map(t=>[String(t),points.filter(p=>p.thresholdHits.includes(t)).length])),
  drawdownThresholdPercent:drawdownPercent,
  firstObservedDrawdownDate:points.find(p=>p.observedWindowDrawdownReached)?.date??null,
  points,independentEventCountNotEstablished:true,
  preWindowPeakUnknown:true,forwardOutcomeVerified:false,verifiedTradingEdge:false,
  eligibleForProduction:false,eligibleForNotifications:false};
}
