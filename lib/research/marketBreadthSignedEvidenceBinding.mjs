// Offline binding of signed hashes to one signal and one outcome. Never authorizes production.
import {createHash} from 'node:crypto';
import {verifyMarketBreadthExternalAttestation} from './marketBreadthExternalAttestation.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const validHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s);
export function bindMarketBreadthSignedEvidence({signalReceipt,outcomeRecord,attestation,trustedPublicKeyPem,trustedKeyFingerprint}={}){
 const fail=reason=>({bound:false,independentlyTrusted:false,productionEligible:false,researchOnly:true,reason});
 if(!signalReceipt||!outcomeRecord||!attestation)return fail('SIGNED_EVIDENCE_MISSING');
 if(typeof signalReceipt.signalRecordId!=='string'||typeof signalReceipt.sourceRecordId!=='string'||!validHash(signalReceipt.payloadHash)||!validHash(signalReceipt.sourceHash))return fail('SIGNAL_EVIDENCE_INCOMPLETE');
 if(typeof outcomeRecord.outcomeRecordId!=='string'||typeof outcomeRecord.signalRecordId!=='string'||!validHash(outcomeRecord.outcomeHash))return fail('OUTCOME_EVIDENCE_INCOMPLETE');
 if(outcomeRecord.signalRecordId!==signalReceipt.signalRecordId||outcomeRecord.code!==signalReceipt.code||outcomeRecord.tradeDate!==signalReceipt.tradeDate)return fail('SIGNED_EVIDENCE_BINDING_MISMATCH');
 const boundHash=hash(JSON.stringify(['market-breadth-signed-evidence-v1',signalReceipt.signalRecordId,signalReceipt.sourceRecordId,signalReceipt.code,signalReceipt.tradeDate,signalReceipt.payloadHash.toLowerCase(),signalReceipt.sourceHash.toLowerCase(),outcomeRecord.outcomeRecordId,outcomeRecord.outcomeHash.toLowerCase()]));
 if(attestation.evidenceHash?.toLowerCase()!==boundHash)return fail('SIGNED_EVIDENCE_HASH_MISMATCH');
 const verified=verifyMarketBreadthExternalAttestation({attestation,trustedPublicKeyPem,trustedKeyFingerprint});
 if(!verified.signatureValid)return fail(verified.reason);
 return {bound:true,independentlyTrusted:false,productionEligible:false,researchOnly:true,reason:'AUDITOR_AUTHORITY_AND_LICENSE_NOT_INDEPENDENTLY_ESTABLISHED',boundHash,signalRecordId:signalReceipt.signalRecordId,outcomeRecordId:outcomeRecord.outcomeRecordId};
}
export function hashMarketBreadthSignedEvidenceBinding(signalReceipt,outcomeRecord){
 return hash(JSON.stringify(['market-breadth-signed-evidence-v1',signalReceipt.signalRecordId,signalReceipt.sourceRecordId,signalReceipt.code,signalReceipt.tradeDate,signalReceipt.payloadHash.toLowerCase(),signalReceipt.sourceHash.toLowerCase(),outcomeRecord.outcomeRecordId,outcomeRecord.outcomeHash.toLowerCase()]));
}
