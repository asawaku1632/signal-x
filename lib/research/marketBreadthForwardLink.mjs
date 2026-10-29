// Research-only linkage of a verified capture receipt to an independently attested 5-session outcome.
// Never creates provenance attestations or calculates returns from mutable display data.
import {verifyMarketBreadthResearchPair} from './marketBreadthEvidenceGate.mjs';
export function linkMarketBreadthForwardOutcome({captureReceipt,row,evidence}={}){
 const fail=reason=>({linked:false,reason,researchOnly:true,productionEligible:false,notificationEligible:false});
 if(!captureReceipt||captureReceipt.accepted!==true||captureReceipt.receiptVersion!=='market-breadth-capture-receipt-v1'||captureReceipt.productionEligible!==false)return fail('CAPTURE_RECEIPT_UNVERIFIED');
 if(!row||!evidence||typeof row!=='object'||typeof evidence!=='object')return fail('OUTCOME_EVIDENCE_MISSING');
 if(captureReceipt.signalRecordId!==evidence.signalRecordId||captureReceipt.code!==row.code||captureReceipt.tradeDate!==row.tradeDate||captureReceipt.signalGeneratedAt!==row.signalGeneratedAt)return fail('CAPTURE_OUTCOME_BINDING_MISMATCH');
 if(evidence.signalProvenanceVerified!==true||evidence.signalGeneratedAt!==captureReceipt.signalGeneratedAt)return fail('INDEPENDENT_SIGNAL_ATTESTATION_MISSING');
 const verdict=verifyMarketBreadthResearchPair(row,evidence);
 if(!verdict.eligible)return fail(verdict.reason);
 return {linked:true,researchOnly:true,productionEligible:false,notificationEligible:false,ruleVersion:'market-breadth-forward-link-v1',captureReceiptVersion:captureReceipt.receiptVersion,verifiedPair:verdict};
}
