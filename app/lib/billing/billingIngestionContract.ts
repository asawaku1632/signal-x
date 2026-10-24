/**
 * Explicit trust boundary for future billing ingestion.
 * This is NOT a webhook endpoint and NEVER validates signatures or purchase tokens.
 * The consumer must obtain a VerifiedBillingNotice from a trusted server adapter
 * after provider authentication, then atomically persist the idempotency event.
 */
export type VerificationProof = "stripe_signature" | "google_play_developer_api";
export type VerifiedBillingNotice = {
  provider: "stripe" | "google_play";
  eventId: string;
  subscriptionId: string;
  occurredAt: string;
  verification: VerificationProof;
};
export type IngestionDecision = { accepted: true; dedupeKey: string } |
  { accepted: false; reason: "invalid" | "verification_mismatch" };

export function validateVerifiedBillingNotice(input: VerifiedBillingNotice): IngestionDecision {
  if (!input ||
      !["stripe", "google_play"].includes(input.provider) ||
      typeof input.eventId !== "string" || !input.eventId.trim() || input.eventId.length > 255 ||
      typeof input.subscriptionId !== "string" || !input.subscriptionId.trim() || input.subscriptionId.length > 255 ||
      typeof input.occurredAt !== "string" || !Number.isFinite(Date.parse(input.occurredAt)))
    return { accepted: false, reason: "invalid" };
  if ((input.provider === "stripe" && input.verification !== "stripe_signature") ||
      (input.provider === "google_play" && input.verification !== "google_play_developer_api"))
    return { accepted: false, reason: "verification_mismatch" };
  return { accepted: true, dedupeKey: JSON.stringify([input.provider,input.eventId]) };
}
