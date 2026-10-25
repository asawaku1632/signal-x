// Offline-only evidence validation. Does not grant permission to use a provider.
const EXPLICIT_TIMEZONE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
function validEvidenceUrl(value){
 if(typeof value!=="string")return false;
 try{const url=new URL(value);return url.protocol==="https:"&&Boolean(url.hostname)&&!url.username&&!url.password&&url.href===value;}catch{return false;}
}
export function validateEvidenceEntry(entry, asOf = new Date().toISOString()) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  if (entry.verified !== true || entry.revoked === true) return false;
  if (entry.status === "REJECTED" || entry.status === "EXPIRED") return false;
  if (!validEvidenceUrl(entry.evidenceUrl)) return false;
  if (typeof entry.reviewer !== "string" || !entry.reviewer.trim()) return false;
  if (typeof entry.reviewedAt !== "string" || !EXPLICIT_TIMEZONE.test(entry.reviewedAt) || !EXPLICIT_TIMEZONE.test(asOf)) return false;
  const reviewed = Date.parse(entry.reviewedAt);
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(reviewed) || !Number.isFinite(cutoff) || reviewed > cutoff) return false;
  if (entry.expiresAt !== undefined) {
    if (typeof entry.expiresAt !== "string" || !EXPLICIT_TIMEZONE.test(entry.expiresAt)) return false;
    const expires = Date.parse(entry.expiresAt);
    if (!Number.isFinite(expires) || expires <= cutoff || expires <= reviewed) return false;
  }
  return true;
}
