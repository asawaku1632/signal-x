// Offline-only pipeline: capture -> immutable receipt -> five-session attestation -> descriptive review.
// No database, external feed, notifications, AI promotion, or production writes.
import {buildMarketBreadthCaptureReceipt} from './marketBreadthCaptureReceipt.mjs';
import {linkMarketBreadthForwardOutcome} from './marketBreadthForwardLink.mjs';
import {runMarketBreadthResearchReview} from './marketBreadthReviewPipeline.mjs';
export function runMarketBreadthForwardResearchPipeline(entries,{generatedAt,minPerCohort=30,minDates=10}={}){
 if(!Array.isArray(entries)||entries.length>100000)throw new Error('INVALID_FORWARD_ENTRIES');
 const rejected=[],linked=[],rows=[],evidenceByRow=new WeakMap(),signalOwners=new Map(),outcomeOwners=new Map();
 for(let index=0;index<entries.length;index++){
  const entry=entries[index];
  const reject=reason=>rejected.push({index,reason});
  if(!entry||typeof entry!=='object'||Array.isArray(entry)){reject('INVALID_FORWARD_ENTRY');continue}
  const {envelope,sourceRecord,snapshotRecord,row,evidence}=entry;
  const receipt=buildMarketBreadthCaptureReceipt(envelope,{sourceRecord,snapshotRecord});
  if(!receipt.accepted){reject(receipt.reason);continue}
  const link=linkMarketBreadthForwardOutcome({captureReceipt:receipt,row,evidence});
  if(!link.linked){reject(link.reason);continue}
  // Collect all candidates first; reject every owner of a reused evidence ID.
  signalOwners.set(receipt.signalRecordId,[...(signalOwners.get(receipt.signalRecordId)??[]),index]);
  outcomeOwners.set(evidence.outcomeRecordId,[...(outcomeOwners.get(evidence.outcomeRecordId)??[]),index]);
  rows.push(row);evidenceByRow.set(row,evidence);
  linked.push({index,signalRecordId:receipt.signalRecordId,outcomeRecordId:evidence.outcomeRecordId,snapshotHash:receipt.snapshotHash});
 }
 const tainted=new Set();
 for(const owners of [...signalOwners.values(),...outcomeOwners.values()])if(owners.length>1)for(const index of owners)tainted.add(index);
 const cleanLinked=linked.filter(item=>!tainted.has(item.index));
 for(const item of linked)if(tainted.has(item.index))rejected.push({index:item.index,reason:'DUPLICATE_FORWARD_EVIDENCE'});
 const cleanRows=rows.filter((row,i)=>!tainted.has(linked[i].index));
 const review=runMarketBreadthResearchReview(cleanRows,row=>evidenceByRow.get(row),{generatedAt,minPerCohort,minDates});
 return {researchOnly:true,productionEligible:false,notificationEligible:false,submittedCount:entries.length,linkedCount:cleanLinked.length,rejected,linked:cleanLinked,review};
}
