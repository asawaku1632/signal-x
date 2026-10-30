/** Offline diagnostic for exact missing or invalid intraday slots. Never fetches quotes. */
import {jstParts} from "./entryTimeShadow.mjs";
const pos=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
const hhmm=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
export function auditExitBarCoverage(date,bars,{start="09:10",end="15:25"}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("INVALID_DATE");
 const minute=x=>{if(!/^\d{2}:\d{2}$/.test(x))throw Error("INVALID_CLOCK");const [h,m]=x.split(":").map(Number);if(h>23||m>59||m%5)throw Error("INVALID_CLOCK");return h*60+m};
 const begin=minute(start),finish=minute(end);
 if(begin>finish)throw Error("INVALID_WINDOW");
 const observed=new Map();
 for(const b of Array.isArray(bars)?bars:[]){
  if(!Number.isSafeInteger(b?.time)||b.time<=0)continue;
  const p=jstParts(b.time*1000);if(p.date===date&&!observed.has(p.hhmm))observed.set(p.hhmm,b);
 }
 const missing=[],invalid=[],valid=[];
 for(const [a,z] of [[540,685],[750,925]]){
  for(let t=Math.max(a,begin);t<=Math.min(z,finish);t+=5){
   const key=hhmm(t),bar=observed.get(key);
   if(!bar){missing.push(key);continue}
   if(![bar.open,bar.high,bar.low,bar.close].every(pos)||
      bar.low>Math.min(bar.open,bar.close)||bar.high<Math.max(bar.open,bar.close)){
    invalid.push(key);continue;
   }
   valid.push(key);
  }
 }
 return {date,start,end,expected:valid.length+missing.length+invalid.length,
  valid:valid.length,missing,invalid,complete:missing.length===0&&invalid.length===0,
  retrospectiveOnly:true,independentSourceVerified:false};
}
