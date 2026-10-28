// Offline cryptographic check only. Trust in the auditor key and data rights must be established separately.
import {createHash,createPublicKey,verify} from 'node:crypto';
const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s);
export function verifyMarketBreadthExternalAttestation({attestation,trustedPublicKeyPem,trustedKeyFingerprint}={}){
 const fail=reason=>({signatureValid:false,independentlyTrusted:false,productionEligible:false,researchOnly:true,reason});
 if(!attestation||typeof attestation!=='object'||Array.isArray(attestation)||!hex(attestation.evidenceHash)||typeof attestation.signature!=='string'||typeof trustedPublicKeyPem!=='string'||!hex(trustedKeyFingerprint))return fail('ATTESTATION_FIELDS_MISSING');
 let key;
 try{key=createPublicKey(trustedPublicKeyPem)}catch{return fail('INVALID_AUDITOR_PUBLIC_KEY')}
 if(key.asymmetricKeyType!=='ed25519')return fail('UNSUPPORTED_AUDITOR_KEY');
 const fingerprint=createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex');
 if(fingerprint.toLowerCase()!==trustedKeyFingerprint.toLowerCase())return fail('AUDITOR_KEY_NOT_TRUSTED');
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(attestation.signature))return fail('INVALID_ATTESTATION_SIGNATURE');
 const signature=Buffer.from(attestation.signature,'base64');
 if(signature.length!==64)return fail('INVALID_ATTESTATION_SIGNATURE');
 const valid=verify(null,Buffer.from(attestation.evidenceHash.toLowerCase(),'utf8'),key,signature);
 if(!valid)return fail('ATTESTATION_SIGNATURE_MISMATCH');
 return {signatureValid:true,independentlyTrusted:false,productionEligible:false,researchOnly:true,reason:'AUDITOR_AUTHORITY_AND_LICENSE_NOT_INDEPENDENTLY_ESTABLISHED',evidenceHash:attestation.evidenceHash.toLowerCase(),auditorKeyFingerprint:fingerprint};
}
