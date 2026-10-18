/** Pure parser for a SERVER-VERIFIED purchases.subscriptionsv2.get response.
 * NOT an API client: caller must authenticate to Google and verify package,
 * product and bound purchase token before invoking this parser.
 */
export type PlaySubscriptionView = {
  subscriptionState?: string;
  // Server-authenticated fields from Google Play subscriptionsv2.get.
  // The client must never be allowed to invent these values.
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  linkedPurchaseToken?: string;
  lineItems?: Array<{productId?: string; expiryTime?: string}>;
};
export type PlayAccessDecision = { status: "active"|"trialing"|"grace_period"|"paused"|"past_due"|"expired"|"canceled"|"revoked"; validUntil: string|null };
const statusMap: Record<string,PlayAccessDecision["status"]> = {
  SUBSCRIPTION_STATE_ACTIVE:"active",
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD:"grace_period",
  SUBSCRIPTION_STATE_ON_HOLD:"past_due",
  SUBSCRIPTION_STATE_PAUSED:"paused",
  SUBSCRIPTION_STATE_CANCELED:"active",
  SUBSCRIPTION_STATE_EXPIRED:"expired",
  SUBSCRIPTION_STATE_PENDING:"past_due",
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED:"canceled",
};
export function interpretVerifiedPlaySubscription(
  data: PlaySubscriptionView,
  expectedProductId: string,
  now: Date = new Date(),
): PlayAccessDecision {
  const denied: PlayAccessDecision = {status:"expired",validUntil:null};
  if (!expectedProductId?.trim() || !Number.isFinite(now.getTime())) return denied;
  const status = statusMap[data?.subscriptionState ?? ""];
  if (!status) return denied;
  const items = (data.lineItems ?? []).filter(item=>item.productId === expectedProductId);
  const times = items.map(item=>item.expiryTime).filter((s):s is string=>Boolean(s && Number.isFinite(Date.parse(s))));
  if (!times.length) return denied;
  const latest = times.reduce((a,b)=> Date.parse(a)>Date.parse(b)?a:b);
  if (Date.parse(latest) <= now.getTime()) return denied;
  return {status,validUntil:latest};
}
