/**
 * ISOLATED SERVER-ONLY FIRST PURCHASE REGISTRATION.
 * No public route, no production wiring, and no payment creation/acknowledgment.
 *
 * A trusted caller supplies the authenticated NextAuth user ID; we independently
 * read Google Play's subscription and require its obfuscated account ID.
 * Both the purchase binding and entitlement update occur in ONE transaction.
 */
import type { Pool, PoolClient } from "pg";
import {
  assessVerifiedFirstPlayPurchase,
  type ApprovedFirstPlayPurchase,
  type FirstPurchaseDecision,
} from "./playInitialPurchaseApproval.ts";

type DB = Pick<Pool, "connect">;
type HttpGet = Parameters<typeof assessVerifiedFirstPlayPurchase>[2];
type Config = Parameters<typeof assessVerifiedFirstPlayPurchase>[1];
export type FirstPurchaseResult =
  | { kind: "registered" | "refreshed"; userId: string; validUntil: string }
  | { kind: "invalid_input" | "provider_unverified" | "inactive" |
      "account_mismatch" | "linked_purchase_requires_migration" |
      "disabled_user" | "owner_conflict" | "revoked_requires_review" |
      "stale_verification" };

export async function registerFirstPlayPurchase(
  request: { authenticatedSignalxUserId: string; purchaseToken: string },
  config: Config,
  database: DB,
  httpGet: HttpGet,
  now: Date = new Date(),
): Promise<FirstPurchaseResult> {
  const approval: FirstPurchaseDecision =
    await assessVerifiedFirstPlayPurchase(request, config, httpGet, now);
  if (approval.kind !== "eligible_verified") return {kind:approval.kind};
  return persistApprovedPurchase(database, approval.candidate);
}

async function persistApprovedPurchase(
  database: DB,
  p: ApprovedFirstPlayPurchase,
): Promise<FirstPurchaseResult> {
  const client: PoolClient = await database.connect();
  let inTransaction=false;
  try {
    await client.query("BEGIN");
    inTransaction=true;
    const user=await client.query(
      "SELECT id FROM public.signalx_users WHERE id=$1 AND disabled_at IS NULL FOR KEY SHARE",
      [p.userId]
    );
    if(user.rowCount !== 1){
      await client.query("ROLLBACK");inTransaction=false;
      return {kind:"disabled_user"};
    }

    const inserted=await client.query(
      `INSERT INTO public.signalx_play_purchase_bindings
        (user_id,purchase_token_fingerprint,package_name,product_id,last_verified_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (purchase_token_fingerprint) DO NOTHING RETURNING id`,
      [p.userId,p.purchaseTokenFingerprint,p.packageName,p.productId,p.verifiedAt]
    );
    const binding=await client.query(
      `SELECT user_id,package_name,product_id
         FROM public.signalx_play_purchase_bindings
         WHERE purchase_token_fingerprint=$1 FOR UPDATE`,
      [p.purchaseTokenFingerprint]
    );
    if(binding.rowCount !== 1 ||
       binding.rows[0].user_id !== p.userId ||
       binding.rows[0].package_name !== p.packageName ||
       binding.rows[0].product_id !== p.productId){
      await client.query("ROLLBACK");inTransaction=false;
      return {kind:"owner_conflict"};
    }
    await client.query(
      `INSERT INTO public.signalx_premium_entitlements
        (user_id,provider,external_subscription_id,status,valid_until,provider_event_at)
       VALUES ($1,'google_play',$2,$3,$4,$5)
       ON CONFLICT (provider,external_subscription_id) DO NOTHING`,
      [p.userId,p.purchaseTokenFingerprint,p.status,p.validUntil,p.verifiedAt]
    );
    const entitlement=await client.query(
      `SELECT user_id,revoked_at,provider_event_at
         FROM public.signalx_premium_entitlements
         WHERE provider='google_play' AND external_subscription_id=$1 FOR UPDATE`,
      [p.purchaseTokenFingerprint]
    );
    if(entitlement.rowCount !== 1 || entitlement.rows[0].user_id !== p.userId){
      await client.query("ROLLBACK");inTransaction=false;
      return {kind:"owner_conflict"};
    }
    if(entitlement.rows[0].revoked_at != null){
      await client.query("ROLLBACK");inTransaction=false;
      return {kind:"revoked_requires_review"};
    }
    const lastEvent=entitlement.rows[0].provider_event_at;
    if(lastEvent && Date.parse(String(lastEvent)) > Date.parse(p.verifiedAt)){
      await client.query("ROLLBACK");inTransaction=false;
      return {kind:"stale_verification"};
    }

    // Enforce monotonic verification time; never overwrite immutable owner.
    await client.query(
      `UPDATE public.signalx_premium_entitlements
       SET status=$2, valid_until=$3, provider_event_at=$4, updated_at=NOW()
       WHERE provider='google_play' AND external_subscription_id=$1
         AND user_id=$5 AND revoked_at IS NULL`,
      [p.purchaseTokenFingerprint,p.status,p.validUntil,p.verifiedAt,p.userId]
    );
    await client.query(
      `UPDATE public.signalx_play_purchase_bindings
       SET last_verified_at=$2
       WHERE purchase_token_fingerprint=$1 AND user_id=$3`,
      [p.purchaseTokenFingerprint,p.verifiedAt,p.userId]
    );
    await client.query("COMMIT");inTransaction=false;
    return {
      kind:inserted.rowCount === 1 ? "registered" : "refreshed",
      userId:p.userId, validUntil:p.validUntil
    };
  } catch(error) {
    if(inTransaction) {
      try {await client.query("ROLLBACK");} catch { /* preserve original error */ }
    }
    throw error;
  } finally {
    client.release();
  }
}
