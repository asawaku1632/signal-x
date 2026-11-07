/** Descriptive daily SMA75 context. Does not select candidates or authorize alerts. */
export function evaluateNightMa75(input, expectedTimes) {
 const unavailable={status:"INSUFFICIENT_HISTORY"};
 if(!Array.isArray(input)||!Array.isArray(expectedTimes)||expectedTimes.length<76)return unavailable;
 const times=expectedTimes.slice(-76);
 if(times.some((t,i)=>!Number.isFinite(t)||(i>0&&t<=times[i-1])))return {status:"INVALID_HISTORY"};
 const byTime=new Map();
 for(const bar of input){
  if(!bar||!Number.isFinite(bar.time))return {status:"INVALID_HISTORY"};
  if(byTime.has(bar.time))return {status:"INVALID_HISTORY"};
  byTime.set(bar.time,bar);
 }
 const bars=times.map(time=>byTime.get(time));
 if(bars.some(bar=>!bar||!Number.isFinite(bar.close)||bar.close<=0))return unavailable;
 const previous=bars.slice(0,75).reduce((sum,bar)=>sum+bar.close,0)/75;
 const value=bars.slice(1).reduce((sum,bar)=>sum+bar.close,0)/75;
 const close=bars[75].close;
 return {status:"AVAILABLE",value,previous,rising:value>previous,
  above:close>value,breakout:close>value&&bars[74].close<=previous,
  distancePercent:(close/value-1)*100};
}
