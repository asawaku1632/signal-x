import { createHash, createPublicKey } from "node:crypto";

export const MIN_RSA_MODULUS_BITS = 3072;

function parseRsaSpkiPem(pem) {
  if (!(typeof pem === "string" || Buffer.isBuffer(pem))) throw new TypeError("TRUSTED_PUBLIC_KEY_REQUIRED");
  const text = Buffer.isBuffer(pem) ? pem.toString("ascii") : pem;
  if (!/^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----\s*$/.test(text)) throw new TypeError("TRUSTED_KEY_MUST_BE_PEM_SPKI");
  let key; try { key=createPublicKey(text); } catch { throw new TypeError("MALFORMED_TRUSTED_PUBLIC_KEY"); }
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
