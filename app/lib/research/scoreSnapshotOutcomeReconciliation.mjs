/** Offline evidence manifest: never promotes a self-reported hash to independent proof.
 * A snapshot is considered only when its digest matches the original.
 */
import {inspectDetachedSnapshot} from "./detachedSnapshotContract.mjs";
export function reconcileScoreSnapshotEvidence(snapshots,outcomes){
 if(!Array.isArray(snapshots)||!Array.isArray(outcomes)||snapshots.length>10000||outcomes.length>10000)throw Error("INVALID_SCORE_EVIDENCE_INPUT");
 const seen=new Set(),outcomeMap=new Map(),counts={snapshots:snapshots.length,intact:0,invalid:0,duplicate:0,waitingOutcome:0,postDecisionOutcome:0,descriptivePairs:0};
 for(const o of outcomes){
  if(!o||typeof o.date!=="string"||typeof o.code!=="string")throw Error("INVALID_OUTCOME_KEY");
  const k=o.date+"|"+o.code;
  if(outcomeMap.has(k))throw Error("DUPLICATE_OUTCOME_KEY");
  outcomeMap.set(k,o);
 }
 const rows=[];
 for(const s of snapshots){
  const key=String(s?.date)+"|"+String(s?.code);
  if(seen.has(key)){counts.duplicate++;rows.push({key,status:"DUPLICATE_SNAPSHOT"});continue;}seen.add(key);
  const integrity=inspectDetachedSnapshot(s);
  if(!integrity.structurallyIntact){counts.invalid++;rows.push({key,status:"INVALID_SNAPSHOT"});continue;}
  counts.intact++;
  const o=outcomeMap.get(key);
  if(!o){counts.waitingOutcome++;rows.push({key,status:"OUTCOME_PENDING"});continue;}
  const outcomeAt=o.availableAt;
  if(typeof outcomeAt!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(outcomeAt)||!Number.isFinite(Date.parse(outcomeAt))||Date.parse(outcomeAt)<=Date.parse(s.capturedAt)||!Number.isFinite(o.nextPrice)||o.nextPrice<=0||o.tradeDate<=s.date){
   counts.postDecisionOutcome++;rows.push({key,status:"UNVERIFIED_OUTCOME_ORDER"});continue;
  }
  counts.descriptivePairs++;rows.push({key,status:"SELF_ATTESTED_DESCRIPTIVE_PAIR",returnPct:Number(((o.nextPrice/s.price-1)*100).toFixed(4))});
 }
 return {counts,rows,exAnteExternallyVerified:false,outcomesExternallyVerified:false,approvedForTraining:false,approvedForTrading:false,
 warning:"A valid digest is self-consistency, not external proof of when a snapshot was actually committed, or of provider prices."};
}
