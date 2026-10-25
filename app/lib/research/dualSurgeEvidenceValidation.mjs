// Offline-only evidence validation. Does not grant permission to use a provider.
export function validateEvidenceEntry(entry, asOf = new Date().toISOString()) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  if (entry.verified !== true || entry.revoked === true) return false;
  if (entry.status === "REJECTED" || entry.status === "EXPIRED") return false;
  if (typeof entry.evidenceUrl !== "string" || !entry.evidenceUrl.startsWith("https://")) return false;
  if (typeof entry.reviewer !== "string" || !entry.reviewer.trim()) return false;
  if (typeof entry.reviewedAt !== "string") return false;
  const reviewed = Date.parse(entry.reviewedAt);
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(reviewed) || !Number.isFinite(cutoff) || reviewed > cutoff) return false;
  if (entry.expiresAt !== undefined) {
    if (typeof entry.expiresAt !== "string") return false;
    const expires = Date.parse(entry.expiresAt);
    if (!Number.isFinite(expires) || expires <= cutoff || expires <= reviewed) return false;
  }
  return true;
}
