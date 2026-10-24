/**
 * Verified-provider-event projection only.
 * The caller MUST authenticate the Stripe webhook signature or Google Play
 * purchase token using provider APIs BEFORE calling this function.
 * This module never makes network calls or writes to a database.
 */
export type VerifiedBillingEvent = {
  provider: "stripe" | "google_play";
  externalSubscriptionId: string;
  eventId: string;
  eventAt: string;
  status: "active" | "trialing" | "grace_period" | "past_due" | "paused" | "canceled" | "expired" | "revoked";
  validUntil: string | null;
};
export type BillingProjection = {
  provider: "stripe" | "google_play";
  externalSubscriptionId: string;
  lastEventId: string;
  lastEventAt: string;
  status: VerifiedBillingEvent["status"];
  validUntil: string | null;
};
export type ProjectionOutcome =
  | { kind: "apply"; next: BillingProjection }
  | { kind: "ignore_duplicate" | "ignore_stale" | "reject_invalid" | "reject_identity_mismatch" };

const statuses = new Set(["active","trialing","grace_period","past_due","paused","canceled","expired","revoked"]);
const timestamp = (s: string | null) => s !== null && s.trim() !== "" && Number.isFinite(Date.parse(s)) ? Date.parse(s) : null;

export function projectVerifiedBillingEvent(
  previous: BillingProjection | null,
  event: VerifiedBillingEvent,
): ProjectionOutcome {
  if (!["stripe","google_play"].includes(event.provider) ||
      !statuses.has(event.status) ||
      !event.externalSubscriptionId?.trim() ||
      !event.eventId?.trim()) return { kind: "reject_invalid" };
  const eventTime = timestamp(event.eventAt);
  if (eventTime === null || (event.validUntil !== null && timestamp(event.validUntil) === null))
    return { kind: "reject_invalid" };
  if (previous) {
    if (previous.provider !== event.provider || previous.externalSubscriptionId !== event.externalSubscriptionId)
      return { kind: "reject_identity_mismatch" };
    if (previous.lastEventId === event.eventId) return { kind: "ignore_duplicate" };
    const oldTime = timestamp(previous.lastEventAt);
    if (oldTime === null || eventTime <= oldTime) return { kind: "ignore_stale" };
  }
  return { kind: "apply", next: {
    provider: event.provider,
    externalSubscriptionId: event.externalSubscriptionId,
    lastEventId: event.eventId,
    lastEventAt: event.eventAt,
    status: event.status,
    validUntil: event.validUntil,
  }};
}
