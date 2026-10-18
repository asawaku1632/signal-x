/**
 * Read-only server-side Play purchase restoration preflight.
 * A verified Google Play purchase is NOT itself permission to reassign ownership.
 * No DB inserts or writes, no entitlement grants, no production endpoint.
 * Provider OAuth token and HMAC secret MUST be server-held.
 */
import type { Pool } from "pg";
import { lookupVerifiedPlaySubscription } from "./playSubscriptionLookup.ts";
import { fingerprintPlayPurchaseToken } from "./playTokenFingerprint.ts";

type DB = Pick<Pool, "query">;
type HttpGet = Parameters<typeof lookupVerifiedPlaySubscription>[1];
type RestoreRequest = { authenticatedSignalxUserId: string; purchaseToken: string };
type TrustedConfig = {
  packageName: string;
  productId: string;
  oauthAccessToken: string;
  fingerprintSecret: string;
};
export type RestorePreflightResult =
  | { kind: "verified_existing"; signalxUserId: string; validUntil: string }
  | { kind: "invalid_input" | "provider_rejected" | "inactive" | "unbound" |
          "owner_mismatch" | "product_mismatch" | "unavailable" };

export async function preflightExistingPlayRestoration(
  request: RestoreRequest,
  config: TrustedConfig,
  database: DB,
  httpGet: HttpGet,
  now: Date = new Date(),
): Promise<RestorePreflightResult> {
  if (!request?.authenticatedSignalxUserId?.trim() ||
      request.authenticatedSignalxUserId !== request.authenticatedSignalxUserId.trim() ||
      !request.purchaseToken?.trim() || !config?.packageName?.trim() ||
      !config.productId?.trim() || !config.fingerprintSecret ||
      !Number.isFinite(now.getTime())) return { kind: "invalid_input" };
  const verification = await lookupVerifiedPlaySubscription({
    packageName: config.packageName,
    expectedPackageName: config.packageName,
    productId: config.productId,
    oauthAccessToken: config.oauthAccessToken,
    purchaseToken: request.purchaseToken,
    now,
  },httpGet);
  if (!verification.ok) return { kind: "provider_rejected" };
  if (!["active", "trialing", "grace_period"].includes(verification.state.status) ||
      !verification.state.validUntil ||
      Date.parse(verification.state.validUntil) <= now.getTime())
    return { kind: "inactive" };

  let fingerprint: string;
  try {
    fingerprint=fingerprintPlayPurchaseToken(request.purchaseToken,config.fingerprintSecret);
  } catch { return { kind: "invalid_input" }; }
  let rows: Array<{user_id:string;package_name:string;product_id:string}>;
  try {
    const result=await database.query(
      `SELECT user_id, package_name, product_id
         FROM public.signalx_play_purchase_bindings
         WHERE purchase_token_fingerprint=$1`,
      [fingerprint]
    );
    rows=result.rows;
  } catch { return { kind: "unavailable" }; }
  if (rows.length===0) return { kind: "unbound" };
  if (rows.length!==1) return { kind: "unavailable" };
  const owner=rows[0];
  if (owner.user_id!==request.authenticatedSignalxUserId) return { kind: "owner_mismatch" };
  if (owner.package_name!==config.packageName || owner.product_id!==config.productId)
    return { kind: "product_mismatch" };
  return {
    kind: "verified_existing",
    signalxUserId: owner.user_id,
    validUntil: verification.state.validUntil,
  };
}
