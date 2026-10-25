// Offline forward-outcome audit. Dates must be pre-verified exchange sessions.
// Never counts pending or excluded windows as wins.
import {fiveDayOutcome} from "./dualSurgeEvaluation.mjs";
export const HORIZONS=Object.freeze([1,3,5,10]);
export function auditForwardOutcomes({bars,signalDate,asOfDate,horizons=HORIZONS}={}){
 if(!Array.isArray(bars)||typeof signalDate!=="string"||typeof asOfDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(signalDate)||!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)||asOfDate<signalDate)throw Error("INVALID_FORWARD_AUDIT");
 if(!Array.isArray(horizons)||horizons.length===0||new Set(horizons).size!==horizons.length||horizons.some(h=>!HORIZONS.includes(h)))throw Error("INVALID_HORIZONS");
 const seen=new Set();
 let last="";
 for(const bar of bars){
  if(!bar||typeof bar.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(bar.date)||bar.date<=last||seen.has(bar.date))throw Error("UNSORTED_OR_DUPLICATE_SESSIONS");
  seen.add(bar.date);last=bar.date;
 }
 const cutoff=bars.filter(b=>b.date<=asOfDate);
 const index=cutoff.findIndex(b=>b.date===signalDate);
 if(index<0)return {status:"MISSING_SIGNAL_SESSION",outcomes:[],matured:0,pending:0,excluded:0,readOnly:true};
 const outcomes=horizons.map(horizon=>{
  const result=fiveDayOutcome(cutoff,index,horizon);
  return {horizon,status:result.status,returnPct:result.status==="MATURED"?result.returnPct:null};
 });
 return {status:"AUDITED",outcomes,matured:outcomes.filter(x=>x.status==="MATURED").length,pending:outcomes.filter(x=>x.status==="PENDING").length,excluded:outcomes.filter(x=>x.status.startsWith("EXCLUDED_")).length,readOnly:true,productionApproved:false};
}
