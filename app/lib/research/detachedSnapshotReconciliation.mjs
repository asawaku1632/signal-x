/** Append-only IN-MEMORY shadow audit. Never persists, authenticates or trades. */
import {inspectDetachedSnapshot} from "./detachedSnapshotContract.mjs";
export function reconcileDetachedSnapshots(snapshots,outcomes=[]){
 if(!Array.isArray(snapshots)||!Array.isArray(outcomes))throw Error("INVALID_SHADOW_RECONCILIATION");
 const seen=new Map(),stats={input:snapshots.length,intact:0,invalid:0,duplicates:0,conflicts:0,matchedOutcomes:0,unmatchedOutcomes:0,invalidOutcomes:0};
 for(const s of snapshots){
  if(!inspectDetachedSnapshot(s).structurallyIntact){stats.invalid++;continue;}
  const key=s.date+"|"+s.code;
  if(seen.has(key)){if(seen.get(key).digest===s.digest)stats.duplicates++;else stats.conflicts++;continue;}
  seen.set(key,s);stats.intact++;
 }
 const matches=[];
 for(const o of outcomes){
  if(!o||typeof o.date!=="string"||typeof o.code!=="string"||
   typeof o.sourceDate!=="string"||o.sourceDate<=o.date||
   typeof o.sourcePrice!=="number"||!Number.isFinite(o.sourcePrice)||o.sourcePrice<=0){stats.invalidOutcomes++;continue;}
  const snapshot=seen.get(o.date+"|"+o.code);
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
