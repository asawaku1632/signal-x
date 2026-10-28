// Offline-only pipeline: capture -> immutable receipt -> five-session attestation -> descriptive review.
// No database, external feed, notifications, AI promotion, or production writes.
import {buildMarketBreadthCaptureReceipt} from './marketBreadthCaptureReceipt.mjs';
import {linkMarketBreadthForwardOutcome} from './marketBreadthForwardLink.mjs';
import {runMarketBreadthResearchReview} from './marketBreadthReviewPipeline.mjs';
export function runMarketBreadthForwardResearchPipeline(entries,{generatedAt,minPerCohort=30,minDates=10}={}){
 if(!Array.isArray(entries)||entries.length>100000)throw new Error('INVALID_FORWARD_ENTRIES');
 const rejected=[],linked=[],rows=[],evidenceByRow=new WeakMap(),seenSignals=new Set(),seenOutcomes=new Set();
 for(let index=0;index<entries.length;index++){
  const entry=entries[index];
  const reject=reason=>rejected.push({index,reason});
  if(!entry||typeof entry!=='object'||Array.isArray(entry)){reject('INVALID_FORWARD_ENTRY');continue}
  const {envelope,sourceRecord,snapshotRecord,row,evidence}=entry;
  const receipt=buildMarketBreadthCaptureReceipt(envelope,{sourceRecord,snapshotRecord});
  if(!receipt.accepted){reject(receipt.reason);continue}
  const link=linkMarketBreadthForwardOutcome({captureReceipt:receipt,row,evidence});
  if(!link.linked){reject(link.reason);continue}
  if(seenSignals.has(receipt.signalRecordId)||seenOutcomes.has(evidence.outcomeRecordId)){reject('DUPLICATE_FORWARD_EVIDENCE');continue}
  seenSignals.add(receipt.signalRecordId);seenOutcomes.add(evidence.outcomeRecordId);
  rows.push(row);evidenceByRow.set(row,evidence);
  linked.push({index,signalRecordId:receipt.signalRecordId,outcomeRecordId:evidence.outcomeRecordId,snapshotHash:receipt.snapshotHash});
 }
 const review=runMarketBreadthResearchReview(rows,row=>evidenceByRow.get(row),{generatedAt,minPerCohort,minDates});
 return {researchOnly:true,productionEligible:false,notificationEligible:false,submittedCount:entries.length,linkedCount:linked.length,rejected,linked,review};
}
