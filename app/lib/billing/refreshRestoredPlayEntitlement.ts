/**
 * SERVER-ONLY Google Play restoration -> PREMIUM entitlement refresh.
 * Requires an existing immutable Play token -> SIGNALX user binding.
 * Verification and ownership are rechecked; no new users or bindings created.
 * No public API route and no production wiring.
 */
import type { Pool, PoolClient } from "pg";
import { preflightExistingPlayRestoration } from "./playRestorationPreflight.ts";
import { fingerprintPlayPurchaseToken } from "./playTokenFingerprint.ts";

type DB = Pick<Pool, "connect" | "query">;
type Config = Parameters<typeof preflightExistingPlayRestoration>[1];
type HttpGet = Parameters<typeof preflightExistingPlayRestoration>[3];

export type RestoredEntitlementResult =
  | { kind:"refreshed"; userId:string; validUntil:string }
  | { kind:"invalid_input" | "provider_rejected" | "inactive" | "unbound" |
      "owner_mismatch" | "product_mismatch" | "unavailable" | "disabled_user" |
      "missing_entitlement" | "revoked_requires_review" | "stale_verification" };

export async function refreshRestoredPlayEntitlement(
  request: {authenticatedSignalxUserId:string;purchaseToken:string},
  config:Config,
  database:DB,
  httpGet:HttpGet,
  now:Date=new Date(),
):Promise<RestoredEntitlementResult> {
  const preflight=await preflightExistingPlayRestoration(request,config,database,httpGet,now);
  if(preflight.kind!=="verified_existing") return {kind:preflight.kind};
  let fingerprint:string;
  try {
    fingerprint=fingerprintPlayPurchaseToken(request.purchaseToken,config.fingerprintSecret);
  } catch { return {kind:"invalid_input"}; }
  let client:PoolClient;
  try {client=await database.connect();} catch {return {kind:"unavailable"};}
  let inTransaction=false;
  try {
    await client.query("BEGIN");inTransaction=true;
    const user=await client.query(
      "SELECT id FROM public.signalx_users WHERE id=$1 AND disabled_at IS NULL FOR KEY SHARE",
      [preflight.signalxUserId]
    );
    if(user.rowCount!==1){
      await client.query("ROLLBACK");inTransaction=false;
      return {kind:"disabled_user"};
    }
    const binding=await client.query(
      `SELECT user_id,package_name,product_id
       FROM public.signalx_play_purchase_bindings
       WHERE purchase_token_fingerprint=$1 FOR UPDATE`,[fingerprint]
    );
    if(binding.rowCount!==1 || binding.rows[0].user_id!==preflight.signalxUserId ||
       binding.rows[0].package_name!==config.packageName ||
       binding.rows[0].product_id!==config.productId){
      await client.query("ROLLBACK");inTransaction=false;
      return {kind:"owner_mismatch"};
    }
    const existing=await client.query(
      `SELECT user_id,revoked_at,provider_event_at
       FROM public.signalx_premium_entitlements
       WHERE provider='google_play' AND external_subscription_id=$1 FOR UPDATE`,[fingerprint]
    );
    if(existing.rowCount===0){
      await client.query("ROLLBACK");inTransaction=false;
      return {kind:"missing_entitlement"};
    }
    if(existing.rowCount!==1 || existing.rows[0].user_id!==preflight.signalxUserId){
      await client.query("ROLLBACK");inTransaction=false;
      return {kind:"owner_mismatch"};
    }
    if(existing.rows[0].revoked_at!==null){
      await client.query("ROLLBACK");inTransaction=false;
      return {kind:"revoked_requires_review"};
    }
    const verifiedAt=now.toISOString();
    const prev=existing.rows[0].provider_event_at;
    if(prev && Date.parse(String(prev))>now.getTime()){
      await client.query("ROLLBACK");inTransaction=false;
      return {kind:"stale_verification"};
    }
    const updated=await client.query(
      `UPDATE public.signalx_premium_entitlements
       SET status=$2,valid_until=$3,provider_event_at=$4,updated_at=NOW()
       WHERE provider='google_play' AND external_subscription_id=$1
         AND user_id=$5 AND revoked_at IS NULL`,
      [fingerprint,preflight.status,preflight.validUntil,verifiedAt,preflight.signalxUserId]
    );
    if(updated.rowCount!==1) throw new Error("Missing entitlement while refreshing");
    await client.query(
      `UPDATE public.signalx_play_purchase_bindings SET last_verified_at=$2
       WHERE purchase_token_fingerprint=$1 AND user_id=$3`,
      [fingerprint,verifiedAt,preflight.signalxUserId]
    );
    await client.query("COMMIT");inTransaction=false;
    return {kind:"refreshed",userId:preflight.signalxUserId,validUntil:preflight.validUntil};
  } catch {
    if(inTransaction) {try{await client.query("ROLLBACK");}catch{/* ignore rollback failure */}}
    return {kind:"unavailable"};
  } finally {
    client.release();
  }
}
