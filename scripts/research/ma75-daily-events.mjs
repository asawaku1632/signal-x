/** Pure, retrospective MA75 daily event classifier. No executable signals. */
export function classifyMa75DailyEvents(rows,{nearPercent=3}={}){
 if(!Array.isArray(rows)||!Number.isFinite(nearPercent)||nearPercent<0||nearPercent>20)throw new TypeError('INVALID_INPUT');
 const seen=new Set();
 for(const r of rows){
  if(typeof r?.date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(r.date)||
   !Number.isFinite(r.close)||r.close<=0||seen.has(r.date))throw new TypeError('INVALID_OR_DUPLICATE_DAILY_BAR');
  seen.add(r.date);
 }
 for(let i=1;i<rows.length;i++)if(rows[i-1].date>=rows[i].date)throw new TypeError('NON_CHRONOLOGICAL_DAILY_BARS');
 const events=[];
 for(let i=75;i<rows.length;i++){
  const sma=rows.slice(i-75,i).reduce((s,r)=>s+r.close,0)/75;
  const prevSma=i>=76?rows.slice(i-76,i-1).reduce((s,r)=>s+r.close,0)/75:null;
  const close=rows[i].close,prev=rows[i-1].close;
  const above=close>sma,prevAbove=prevSma===null?null:prev>prevSma;
  const distancePercent=(close/sma-1)*100;
  const breakout=prevAbove===false&&above;
  const near=above&&distancePercent<=nearPercent;
  // A descriptive two-day rebound after a prior-day MA75 proximity.
  const priorNear=prevSma!==null&&prev>prevSma&&
   (prev/prevSma-1)*100<=nearPercent;
  const rebound=priorNear&&above&&close>prev;
  events.push({date:rows[i].date,close,prior75Sma:Number(sma.toFixed(6)),
   distancePercent:Number(distancePercent.toFixed(4)),above,breakout,
   nearFromAbove:near,reboundAfterPriorNear:rebound,
   priorDaySmaAvailable:prevSma!==null});
 }
 return {version:'ma75_daily_event_shadow_v1',days:events.length,
  breakoutDates:events.filter(x=>x.breakout).map(x=>x.date),
  nearDates:events.filter(x=>x.nearFromAbove).map(x=>x.date),
  reboundDates:events.filter(x=>x.reboundAfterPriorNear).map(x=>x.date),
  events,forwardOutcomeVerified:false,actual905AvailabilityVerified:false,
  eligibleForProduction:false,eligibleForNotifications:false};
}
