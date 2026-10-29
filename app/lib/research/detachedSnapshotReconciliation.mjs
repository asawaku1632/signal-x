/** Append-only IN-MEMORY shadow audit. Never persists, authenticates or trades. */
import {inspectDetachedSnapshot} from "./detachedSnapshotContract.mjs";
const validDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
export function reconcileDetachedSnapshots(snapshots,outcomes=[]){
 if(!Array.isArray(snapshots)||!Array.isArray(outcomes))throw Error("INVALID_SHADOW_RECONCILIATION");
 const seen=new Map(),stats={input:snapshots.length,intact:0,invalid:0,duplicates:0,conflicts:0,matchedOutcomes:0,unmatchedOutcomes:0,invalidOutcomes:0,duplicateOutcomes:0};
 const seenOutcomes=new Set();
 for(const s of snapshots){
  if(!inspectDetachedSnapshot(s).structurallyIntact){stats.invalid++;continue;}
  const key=s.date+"|"+s.code;
  if(seen.has(key)){if(seen.get(key).digest===s.digest)stats.duplicates++;else stats.conflicts++;continue;}
  seen.set(key,s);stats.intact++;
 }
 const matches=[];
 for(const o of outcomes){
  if(!o||!validDate(o.date)||typeof o.code!=="string"||!/^(?:\d{4}|\d{3}[A-Z])$/.test(o.code)||
   !validDate(o.sourceDate)||o.sourceDate<=o.date||
   typeof o.sourcePrice!=="number"||!Number.isFinite(o.sourcePrice)||o.sourcePrice<=0){stats.invalidOutcomes++;continue;}
  const outcomeKey=o.date+"|"+o.code;
  if(seenOutcomes.has(outcomeKey)){stats.duplicateOutcomes++;continue;}
  seenOutcomes.add(outcomeKey);
  const snapshot=seen.get(outcomeKey);
  if(!snapshot){stats.unmatchedOutcomes++;continue;}
  stats.matchedOutcomes++;
  matches.push({date:o.date,code:o.code,snapshotDigest:snapshot.digest,
    observationReturnPct:Number((100*(o.sourcePrice/snapshot.price-1)).toFixed(4)),
    sourceDate:o.sourceDate,referenceOnly:true,independentlyVerified:false});
 }
 return {version:"DETACHED_SNAPSHOT_RECONCILIATION_V1",stats,matches,
  acceptedForTrading:false,persisted:false,
  warning:"Matching an outcome to a self-asserted snapshot is not provider authentication, external time attestation, or a trading backtest."};
}
