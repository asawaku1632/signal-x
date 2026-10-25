// Research-only deterministic replay of user-supplied daily OHLCV.
// No provider requests, persistence, notifications or trading actions.
import {normalizeResearchRows} from "./dualSurgeComparison.mjs";
import {fiveDayOutcome} from "./dualSurgeEvaluation.mjs";
import {eventIdentity} from "./dualSurgeEvidence.mjs";
import {validIsoSessionDate} from "./dualSurgeCalendar.mjs";

export function summarizeReplayResults(results){
 if(!Array.isArray(results))throw Error("INVALID_REPLAY_RESULTS");
 const summary={total:results.length,maturedPositive:0,maturedNegative:0,maturedFlat:0,pending:0,excluded:0,missing:0,mismatched:0,matched:0,unverified:0};
 for(const result of results){
  if(!result||typeof result.status!=="string"||typeof result.matches!=="boolean")throw Error("INVALID_REPLAY_RESULT");
  if(result.matches)summary.matched++;
  else summary.unverified++;
  if(result.status==="MATURED"){
   if(!Number.isFinite(result.calculatedReturnPct))throw Error("INVALID_MATURED_RETURN");
   if(result.calculatedReturnPct>0)summary.maturedPositive++;
   else if(result.calculatedReturnPct<0)summary.maturedNegative++;
   else summary.maturedFlat++;
   if(!result.matches)summary.mismatched++;
  }else if(result.status==="PENDING")summary.pending++;
  else if(result.status.startsWith("EXCLUDED_"))summary.excluded++;
  else if(result.status==="MISSING_PROVIDER_ROWS"||result.status==="MISSING_SIGNAL_SESSION"||result.status==="OUTSIDE_AS_OF_DATE")summary.missing++;
  else throw Error("UNKNOWN_REPLAY_STATUS");
 }
 return summary;
}
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
 return {eventCount:referenceEvents.length,checked:results.filter(x=>x.matches).length,allMatched:referenceEvents.length>0&&results.length===referenceEvents.length&&results.every(x=>x.matches),results,summary:summarizeReplayResults(results),readOnly:true,providerRequests:0,productionApproved:false};
}
