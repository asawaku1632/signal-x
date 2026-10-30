/** One-shot offline analysis from verified local ledger structure and outcome JSON.
 * No disk writes, auth claims, network calls, or trading actions.
 */
import {inspectLocalSnapshotLedger} from "./localSnapshotLedger.mjs";
import {verifyLedgerCheckpoint} from "./ledgerCheckpoint.mjs";
import {reconcileDetachedSnapshots} from "./detachedSnapshotReconciliation.mjs";
const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return a.length%2?b[m]:(b[m-1]+b[m])/2;};
const round=x=>x===null?null:Number(x.toFixed(4));
export function auditLocalResearchBatch(records,outcomes,{checkpoint=null}={}){
 if(!Array.isArray(records)||!Array.isArray(outcomes))throw Error("INVALID_RESEARCH_BATCH");
 if(records.length>100000||outcomes.length>100000)throw Error("RESEARCH_BATCH_TOO_LARGE");
 const audit=inspectLocalSnapshotLedger(records);
 if(!audit.valid)return {version:"OFFLINE_RESEARCH_BATCH_V1",safe:false,reason:"CORRUPT_LEDGER",ledger:audit,signalEnabled:false};
 const check=checkpoint===null?null:verifyLedgerCheckpoint(records,checkpoint);
 if(check&&!check.valid)return {version:"OFFLINE_RESEARCH_BATCH_V1",safe:false,reason:check.reason,checkpoint:check,signalEnabled:false};
 const reconciliation=reconcileDetachedSnapshots(records.map(x=>x.snapshot),outcomes);
 const matches=reconciliation.matches;
 const vals=matches.map(x=>x.observationReturnPct);
 const mean=vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:null;
 return {version:"OFFLINE_RESEARCH_BATCH_V1",safe:true,ledger:{valid:true,recordCount:records.length,head:audit.head},
  checkpoint:check,reconciliation:{stats:reconciliation.stats},
  referenceResults:{matches:matches.length,meanPct:round(mean),medianPct:round(median(vals)),
   positivePct:vals.length?round(100*vals.filter(x=>x>0).length/vals.length):null},
  providerVerified:false,externalTimestampVerified:false,signalEnabled:false,readyForTrading:false,
  warning:"Local history and outcome comparisons are reference-only, not authenticated prospective trading returns."};
}
