// Research-only pure helpers; not connected to production API.
export function adjustmentStatus(factor) {
 if(typeof factor!=="number"||!Number.isFinite(factor)||factor<=0)return "EXCLUDED_UNKNOWN_ADJUSTMENT";
 return factor===1?"ELIGIBLE":"EXCLUDED_CORPORATE_ACTION";
}
export function groupEvents(signals,sessions) {
 if(!Array.isArray(signals)||!Array.isArray(sessions)||new Set(sessions).size!==sessions.length)throw Error("INVALID_SESSIONS");
 const indexes=new Map(sessions.map((date,i)=>[date,i]));
 const seen=new Set(),sorted=[];
 for(const s of signals){
  if(!s||typeof s.cohort!=="string"||!s.cohort.trim())throw Error("INVALID_SIGNAL");
  const index=indexes.get(s.date);
  if(index===undefined)throw Error("UNKNOWN_SESSION");
  const key=s.cohort+"|"+index;
  if(seen.has(key))throw Error("DUPLICATE_SIGNAL");
  seen.add(key);sorted.push({...s,index});
 }
 sorted.sort((a,b)=>a.index-b.index||a.cohort.localeCompare(b.cohort));
 const events=[],lastByCohort=new Map();
 for(const s of sorted){
  const prev=lastByCohort.get(s.cohort);
  if(prev&&s.index===prev.lastIndex+1){
   prev.endDate=s.date;prev.lastIndex=s.index;prev.signalDays++;
  }else{
   const event={cohort:s.cohort,startDate:s.date,endDate:s.date,firstIndex:s.index,lastIndex:s.index,signalDays:1};
   events.push(event);lastByCohort.set(s.cohort,event);
  }
 }
 return events;
}
export function fiveDayOutcome(bars,index,horizon=5){
 if(!Number.isInteger(index)||index<0||!Number.isInteger(horizon)||horizon<1)throw Error("INVALID_INDEX");
 const signal=bars[index],future=bars[index+horizon];
 if(!signal)return {status:"EXCLUDED_MISSING_DATA",returnPct:null};
 if(!future)return {status:"PENDING",returnPct:null};
 const window=bars.slice(index,index+horizon+1);
 if(window.some(b=>!b||typeof b!=="object"))return {status:"EXCLUDED_MISSING_DATA",returnPct:null};
 if(window.some(b=>adjustmentStatus(b.adjFactor)!=="ELIGIBLE"))return {status:"EXCLUDED_CORPORATE_OR_UNKNOWN_ADJUSTMENT",returnPct:null};
 if(window.some(b=>typeof b.close!=="number"||!Number.isFinite(b.close)||b.close<=0))return {status:"EXCLUDED_MISSING_DATA",returnPct:null};
 return {status:"MATURED",returnPct:Number(((future.close/signal.close-1)*100).toFixed(3))};
}
export function nextOpenReturn(bars,index,horizon=5){
 if(!Number.isInteger(index)||index<0||!Number.isInteger(horizon)||horizon<1)throw Error("INVALID_INDEX");
 const entry=bars[index+1],exit=bars[index+horizon];
 if(!entry||!exit)return {status:"PENDING",returnPct:null};
 const window=bars.slice(index,index+horizon+1);
 if(window.some(b=>adjustmentStatus(b.adjFactor)!=="ELIGIBLE"))return {status:"EXCLUDED_CORPORATE_OR_UNKNOWN_ADJUSTMENT",returnPct:null};
 if(typeof entry.open!=="number"||!Number.isFinite(entry.open)||entry.open<=0||typeof exit.close!=="number"||!Number.isFinite(exit.close)||exit.close<=0)return {status:"EXCLUDED_MISSING_DATA",returnPct:null};
 return {status:"MATURED",returnPct:Number(((exit.close/entry.open-1)*100).toFixed(3))};
}
