// Research-only pure helpers; not connected to production API.
export function adjustmentStatus(factor) {
 if(typeof factor!=="number"||!Number.isFinite(factor)||factor<=0)return "EXCLUDED_UNKNOWN_ADJUSTMENT";
 return factor===1?"ELIGIBLE":"EXCLUDED_CORPORATE_ACTION";
}
export function groupEvents(signals,sessions) {
 const indexes=new Map(sessions.map((date,i)=>[date,i]));
 const sorted=[...signals].sort((a,b)=>(indexes.get(a.date)??Infinity)-(indexes.get(b.date)??Infinity));
 const events=[];
 for(const s of sorted){
  const index=indexes.get(s.date);
  if(index===undefined)throw Error("UNKNOWN_SESSION");
  const prev=events.at(-1);
  if(prev&&prev.cohort===s.cohort&&index===prev.lastIndex+1){
   prev.endDate=s.date;prev.lastIndex=index;prev.signalDays++;
  }else events.push({cohort:s.cohort,startDate:s.date,endDate:s.date,firstIndex:index,lastIndex:index,signalDays:1});
 }
 return events;
}
export function fiveDayOutcome(bars,index,horizon=5){
 if(!Number.isInteger(index)||index<0||!Number.isInteger(horizon)||horizon<1)throw Error("INVALID_INDEX");
 const signal=bars[index],future=bars[index+horizon];
 if(!signal)return {status:"EXCLUDED_MISSING_DATA",returnPct:null};
 if(!future)return {status:"PENDING",returnPct:null};
 const window=bars.slice(index,index+horizon+1);
 if(window.some(b=>adjustmentStatus(b.adjFactor)!=="ELIGIBLE"))return {status:"EXCLUDED_CORPORATE_OR_UNKNOWN_ADJUSTMENT",returnPct:null};
 if(window.some(b=>!Number.isFinite(b.close)||b.close<=0))return {status:"EXCLUDED_MISSING_DATA",returnPct:null};
 return {status:"MATURED",returnPct:Number(((future.close/signal.close-1)*100).toFixed(3))};
}
export function nextOpenReturn(bars,index,horizon=5){
 if(!Number.isInteger(index)||index<0||!Number.isInteger(horizon)||horizon<1)throw Error("INVALID_INDEX");
 const entry=bars[index+1],exit=bars[index+horizon];
 if(!entry||!exit)return {status:"PENDING",returnPct:null};
 const window=bars.slice(index,index+horizon+1);
 if(window.some(b=>adjustmentStatus(b.adjFactor)!=="ELIGIBLE"))return {status:"EXCLUDED_CORPORATE_OR_UNKNOWN_ADJUSTMENT",returnPct:null};
 if(!Number.isFinite(entry.open)||entry.open<=0||!Number.isFinite(exit.close)||exit.close<=0)return {status:"EXCLUDED_MISSING_DATA",returnPct:null};
 return {status:"MATURED",returnPct:Number(((exit.close/entry.open-1)*100).toFixed(3))};
}
