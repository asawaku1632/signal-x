/**
 * Pure, side-effect-free premium access policy.
 * No Stripe/Play API calls and no database writes.
 */
export type BillingProvider = "stripe" | "google_play";
export type EntitlementStatus = "active" | "trialing" | "grace_period" | "past_due" | "paused" | "canceled" | "expired" | "revoked";
export type Entitlement = {
  userId: string;
  provider: BillingProvider;
  externalSubscriptionId: string;
  status: EntitlementStatus;
  validUntil: Date | string | null;
  revokedAt?: Date | string | null;
};
function validDate(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}
export function hasPremiumAccess(
  signalxUserId: string | null | undefined,
  entitlements: readonly Entitlement[],
  now: Date = new Date(),
): boolean {
  if (!signalxUserId || !signalxUserId.trim()) return false;
  const current = now.getTime();
  if (!Number.isFinite(current)) return false;
  return entitlements.some((item) => {
    if (item.userId !== signalxUserId) return false;
    if (!["stripe", "google_play"].includes(item.provider)) return false;
    if (!item.externalSubscriptionId || !item.externalSubscriptionId.trim()) return false;
    if (item.revokedAt != null) return false;
    if (!["active", "trialing", "grace_period"].includes(item.status)) return false;
    const until = validDate(item.validUntil);
    return until !== null && until > current;
  });
}
