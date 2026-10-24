// Research-only deterministic replay of user-supplied daily OHLCV.
// No provider requests, persistence, notifications or trading actions.
import {normalizeResearchRows} from "./dualSurgeComparison.mjs";
import {fiveDayOutcome} from "./dualSurgeEvaluation.mjs";
import {eventIdentity} from "./dualSurgeEvidence.mjs";
import {validIsoSessionDate} from "./dualSurgeCalendar.mjs";

export function replayDiagnosticEvents({referenceEvents,providerRowsByCode,asOfDate}){
 if(!Array.isArray(referenceEvents)||!providerRowsByCode||typeof providerRowsByCode!=="object"||Array.isArray(providerRowsByCode)||!validIsoSessionDate(asOfDate))throw Error("INVALID_REPLAY_INPUT");
 const seen=new Set(),rowsCache=new Map(),results=[];
 for(const event of referenceEvents){
  const id=eventIdentity(event);
  if(seen.has(id))throw Error("DUPLICATE_EVENT_IDENTITY");
  seen.add(id);
  const code=event.code;
  if(!Object.hasOwn(providerRowsByCode,code)){
   results.push({id,status:"MISSING_PROVIDER_ROWS",matches:false});continue;
  }
  if(!rowsCache.has(code))rowsCache.set(code,normalizeResearchRows(providerRowsByCode[code],code));
  const rows=rowsCache.get(code);
  const index=rows.findIndex(r=>r.date===event.startDate);
  if(index<0){results.push({id,status:"MISSING_SIGNAL_SESSION",matches:false});continue;}
  const cutoff=rows.filter(r=>r.date<=asOfDate);
  const indexAtCutoff=cutoff.findIndex(r=>r.date===event.startDate);
  if(indexAtCutoff<0){results.push({id,status:"OUTSIDE_AS_OF_DATE",matches:false});continue;}
  const outcome=fiveDayOutcome(cutoff,indexAtCutoff,5);
  const statusMatches=outcome.status===event.status;
  const returnMatches=outcome.status==="MATURED"?typeof event.returnPct==="number"&&Math.abs(outcome.returnPct-event.returnPct)<=0.001:event.returnPct===null;
  results.push({id,status:outcome.status,calculatedReturnPct:outcome.returnPct,referenceReturnPct:event.returnPct,matches:statusMatches&&returnMatches});
 }
 return {eventCount:referenceEvents.length,checked:results.filter(x=>x.matches).length,allMatched:results.length===referenceEvents.length&&results.every(x=>x.matches),results,readOnly:true,providerRequests:0,productionApproved:false};
}
