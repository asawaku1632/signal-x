import { createHash, createPublicKey } from "node:crypto";

export const MIN_RSA_MODULUS_BITS = 3072;

const PUBLIC_KEY_BEGIN = "-----BEGIN PUBLIC KEY-----";
const PUBLIC_KEY_END = "-----END PUBLIC KEY-----";

function countOccurrences(text, marker) {
  let count=0,index=0;
  while ((index=text.indexOf(marker,index)) !== -1) { count++;index+=marker.length; }
  return count;
}

function extractSinglePublicKeyPem(text) {
  if (countOccurrences(text,"-----BEGIN") !== 1 || countOccurrences(text,"-----END") !== 1) throw new TypeError("TRUSTED_KEY_MUST_BE_SINGLE_PEM_SPKI");
  const begin=text.indexOf(PUBLIC_KEY_BEGIN),end=text.indexOf(PUBLIC_KEY_END);
  if (begin<0 || end<begin+PUBLIC_KEY_BEGIN.length) throw new TypeError("TRUSTED_KEY_MUST_BE_PEM_SPKI");
  const before=text.slice(0,begin),after=text.slice(end+PUBLIC_KEY_END.length),body=text.slice(begin+PUBLIC_KEY_BEGIN.length,end);
  if (!/^\s*$/.test(before) || !/^\s*$/.test(after)) throw new TypeError("TRUSTED_KEY_MUST_BE_SINGLE_PEM_SPKI");
  if (!body.trim()) throw new TypeError("MALFORMED_TRUSTED_PUBLIC_KEY");
  return text.slice(begin,end+PUBLIC_KEY_END.length);
}

function parseRsaSpkiPem(pem) {
  if (!(typeof pem === "string" || Buffer.isBuffer(pem))) throw new TypeError("TRUSTED_PUBLIC_KEY_REQUIRED");
  const text = Buffer.isBuffer(pem) ? pem.toString("ascii") : pem;
  const singlePem=extractSinglePublicKeyPem(text);
  let key; try { key=createPublicKey(singlePem); } catch { throw new TypeError("MALFORMED_TRUSTED_PUBLIC_KEY"); }
  if (key.type !== "public" || key.asymmetricKeyType !== "rsa") throw new TypeError("TRUSTED_KEY_MUST_BE_RSA");
  if ((key.asymmetricKeyDetails?.modulusLength ?? 0) < MIN_RSA_MODULUS_BITS) throw new TypeError("TRUSTED_RSA_KEY_TOO_WEAK");
  return key;
}

export function operatorPublicKeyFingerprint(pem) {
  const key=parseRsaSpkiPem(pem);const der=key.export({type:"spki",format:"der"});
  return `sha256:${createHash("sha256").update(der).digest("hex")}`;
}

export function validateTrustedOperatorPublicKey({ pem, approvedFingerprint }) {
  const key=parseRsaSpkiPem(pem);const der=key.export({type:"spki",format:"der"});const fingerprint=`sha256:${createHash("sha256").update(der).digest("hex")}`;
  if (typeof approvedFingerprint !== "string" || approvedFingerprint !== fingerprint) throw new TypeError("TRUSTED_KEY_FINGERPRINT_MISMATCH");
  return Object.freeze({key,fingerprint});
}

// The provider owns repository-external storage (for example an OS-managed,
// read-only public-key file). This boundary never requests or accepts a private key.
export async function loadTrustedOperatorPublicKey({ publicKeyProvider, approvedFingerprint }) {
  if (typeof publicKeyProvider !== "function") throw new TypeError("PUBLIC_KEY_PROVIDER_REQUIRED");
  const pem=await publicKeyProvider();return validateTrustedOperatorPublicKey({pem,approvedFingerprint});
}
