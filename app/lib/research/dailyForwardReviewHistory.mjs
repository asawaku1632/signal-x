/**
 * Pure append-only review history builder for offline research proposals.
 * Caller must persist the returned record to an independently secured
 * append-only store if durable auditability is required.
 * No production AI, notifications, database, or deployment writes.
 */
const DECISIONS=new Set(["REVIEW_PENDING","REVIEW_HOLD","REVIEW_REJECTED","RESEARCH_CANDIDATE"]);
export function appendForwardResearchReview(history, event) {
  if (!Array.isArray(history)) throw new TypeError("history must be an array");
  if (!event || typeof event!=="object") throw new TypeError("event required");
  const required=["proposalId","reviewerId","reviewedAt","decision","reason","evidenceSha256"];
  const missing=required.filter((k)=>typeof event[k]!=="string"||!event[k].trim());
  if (missing.length) throw new Error("Missing review fields: "+missing.join(","));
  if (!DECISIONS.has(event.decision)) throw new Error("Invalid research review decision");
  if (!/^[a-f0-9]{64}$/i.test(event.evidenceSha256)) throw new Error("Invalid evidence hash");
  if (Number.isNaN(Date.parse(event.reviewedAt)) ||
      !/^\d{4}-\d{2}-\d{2}T/.test(event.reviewedAt)) throw new Error("Invalid review timestamp");
  const previous=history.at(-1);
  if (previous && Date.parse(event.reviewedAt)<Date.parse(previous.reviewedAt)) {
    throw new Error("Review timestamps must be nondecreasing");
  }
  const record=Object.freeze({
    sequence:history.length+1,
    proposalId:event.proposalId,
    reviewerId:event.reviewerId,
    reviewedAt:event.reviewedAt,
    decision:event.decision,
    reason:event.reason,
    evidenceSha256:event.evidenceSha256.toLowerCase(),
    productionApproval:false,
    autoApply:false,
  });
  return [...history,record];
}
