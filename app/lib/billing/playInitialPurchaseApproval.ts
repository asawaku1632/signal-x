/**
 * Server-only first Google Play subscription preflight. Not an API route.
 * Authenticated userId MUST come from the NextAuth server session, not the request body.
 * OAuth token and both HMAC keys MUST come from server-side secrets.
 * This function only returns a candidate for later transactional persistence.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { lookupVerifiedPlaySubscription } from "./playSubscriptionLookup.ts";
import { fingerprintPlayPurchaseToken } from "./playTokenFingerprint.ts";

type HttpGet = Parameters<typeof lookupVerifiedPlaySubscription>[1];
export type ApprovedFirstPlayPurchase = {
  userId: string;
  purchaseTokenFingerprint: string;
  packageName: string;
  productId: string;
  status: "active" | "trialing" | "grace_period";
  validUntil: string;
  verifiedAt: string;
};
export type FirstPurchaseDecision =
  | { kind: "eligible_verified"; candidate: ApprovedFirstPlayPurchase }
  | { kind: "invalid_input" | "provider_unverified" | "inactive" |
      "account_mismatch" | "linked_purchase_requires_migration" };

type ServerConfig = {
  packageName: string;
  productId: string;
  oauthAccessToken: string;
  purchaseFingerprintKey: string;
  accountBindingKey: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Supply this exact opaque ID to BillingFlowParams.setObfuscatedAccountId. */
export function obfuscatedSignalxPlayAccountId(userId: string, secret: string): string {
  if (!uuid.test(userId) || !secret || secret.length < 32)
    throw new Error("Invalid Play account binding input");
  return createHmac("sha256", secret)
    .update("signalx:play:account:v1\0").update(userId).digest("hex");
}

export async function assessVerifiedFirstPlayPurchase(
  request: { authenticatedSignalxUserId: string; purchaseToken: string },
  config: ServerConfig,
  httpGet: HttpGet,
  now: Date = new Date(),
): Promise<FirstPurchaseDecision> {
  if (!request || !config || !uuid.test(request.authenticatedSignalxUserId ?? "") ||
      typeof request.purchaseToken !== "string" || !request.purchaseToken.trim() ||
      !config.packageName?.trim() || !config.productId?.trim() ||
      !config.oauthAccessToken?.trim() || !Number.isFinite(now.getTime()) ||
      config.accountBindingKey?.length < 32 || config.purchaseFingerprintKey?.length < 32 ||
      config.accountBindingKey === config.purchaseFingerprintKey) return { kind: "invalid_input" };

  const verified = await lookupVerifiedPlaySubscription({
    packageName: config.packageName,
    expectedPackageName: config.packageName,
    productId: config.productId,
    purchaseToken: request.purchaseToken,
    oauthAccessToken: config.oauthAccessToken,
    now,
  }, httpGet);
  if (!verified.ok) return { kind: "provider_unverified" };
  const state = verified.state;
  if ((state.status !== "active" && state.status !== "trialing" && state.status !== "grace_period") ||
      !state.validUntil || Date.parse(state.validUntil) <= now.getTime())
    return { kind: "inactive" };

  // Linked tokens represent plan changes / replacements; NEVER grant a second
  // entitlement until an atomic old-token migration/revocation flow exists.
  if (verified.purchase.linkedPurchaseToken)
    return { kind: "linked_purchase_requires_migration" };

  const providerAccountId = verified.purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (!providerAccountId || !/^[0-9a-f]{64}$/.test(providerAccountId))
    return { kind: "account_mismatch" };
  const expected = obfuscatedSignalxPlayAccountId(request.authenticatedSignalxUserId, config.accountBindingKey);
  if (!timingSafeEqual(Buffer.from(providerAccountId, "hex"), Buffer.from(expected, "hex")))
    return { kind: "account_mismatch" };

  let fingerprint: string;
  try {
    fingerprint = fingerprintPlayPurchaseToken(request.purchaseToken, config.purchaseFingerprintKey);
  } catch {
    return { kind: "invalid_input" };
  }
  return { kind: "eligible_verified", candidate: {
    userId: request.authenticatedSignalxUserId,
    purchaseTokenFingerprint: fingerprint,
    packageName: config.packageName,
    productId: config.productId,
    status: state.status,
    validUntil: state.validUntil,
    verifiedAt: now.toISOString(),
  }};
}
