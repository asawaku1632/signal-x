// Research-only contract-scope precheck. Never fetches quotes or grants production rights.
const REQUIRED = ["research","storage","derivedDisplay","retention"];
export function assessProviderScope(license = {}, asOf = new Date().toISOString()) {
  const reasons = [];
  if (!license || typeof license !== "object" || Array.isArray(license)) return {allowed:false,reasons:["INVALID_LICENSE"],productionApproved:false};
  if (typeof license.provider !== "string" || !license.provider.trim()) reasons.push("PROVIDER_MISSING");
  if (typeof license.product !== "string" || !license.product.trim()) reasons.push("PRODUCT_MISSING");
  if (license.status !== "APPROVED") reasons.push("LICENSE_NOT_APPROVED");
  if (license.revoked === true) reasons.push("LICENSE_REVOKED");
  if (typeof license.approvalReference !== "string" || !license.approvalReference.trim()) reasons.push("APPROVAL_REFERENCE_MISSING");
  if (typeof license.approvedBy !== "string" || !license.approvedBy.trim()) reasons.push("APPROVER_MISSING");
  const now = Date.parse(asOf), expiry = Date.parse(license.expiresAt);
  if (!Number.isFinite(now) || !Number.isFinite(expiry) || expiry <= now) reasons.push("LICENSE_EXPIRED_OR_UNDATED");
  for (const permission of REQUIRED) if (license.permissions?.[permission] !== true) reasons.push("SCOPE_NOT_APPROVED_" + permission);
  return {allowed:reasons.length===0,reasons,productionApproved:false};
}
