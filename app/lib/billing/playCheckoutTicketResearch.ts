/**
 * ISOLATED RESEARCH ONLY -- NOT AN HTTP ROUTE OR LIVE BILLING CAPABILITY.
 *
 * Issue: caller MUST obtain authenticatedSignalxUserId from a server session.
 * Redeem: caller MUST use a server-side Google Play Integrity decode API for
 * decodeWithTrustedGooglePlayIntegrity. Never accept client-supplied decoded JSON.
 * The Play Integrity token must be bound to this ticket via requestHash.
 *
 * Raw checkout tickets are returned ONCE; only a keyed digest is stored.
 * Ticket redemption is atomic, short lived, and does not create entitlements.
 * No OAuth secrets, signing keys or raw purchase tokens are ever persisted.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { obfuscatedSignalxPlayAccountId } from "./playInitialPurchaseApproval.ts";

type DB = Pick<Pool, "query">;
const PACKAGE = "com.signalx.app";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TICKET = /^[A-Za-z0-9_-]{43}$/;
const TTL_MS = 120_000;
const MAX_INTEGRITY_AGE_MS = 120_000;
const MAX_CLOCK_SKEW_MS = 30_000;

type Config = {
  allowedProductId:string;
  packageName:string;
  ticketDigestKey:string;
  accountBindingKey:string;
};
type NativeConfig = Config & { allowedPlaySigningCertificateDigests:readonly string[] };
type DecodedIntegrity = {
  requestDetails?: {
    requestPackageName?:string; requestHash?:string; timestampMillis?:string|number;
  };
  appIntegrity?: {
    appRecognitionVerdict?:string;packageName?:string;certificateSha256Digest?:string[];
  };
};
type VerifiedIntegrityDecoder = (opaqueToken:string)=>Promise<DecodedIntegrity|null>;

const configValid=(c:Config):boolean=>Boolean(
  c && c.packageName===PACKAGE && typeof c.allowedProductId==="string" &&
  c.allowedProductId.length>0 && c.allowedProductId.trim()===c.allowedProductId &&
  typeof c.ticketDigestKey==="string" && c.ticketDigestKey.length>=32 &&
  typeof c.accountBindingKey==="string" && c.accountBindingKey.length>=32 &&
  c.ticketDigestKey!==c.accountBindingKey
);

function ticketDigest(ticket:string,key:string):string {
  return createHmac("sha256",key)
    .update("signalx:play:checkout-ticket:v1\0").update(ticket).digest("hex");
}

/** Publicly safe request binding value, NOT the Google Play Integrity token. */
export function checkoutIntegrityRequestHash(
  digest:string,packageName:string,productId:string,
):string {
  if(!/^[a-f0-9]{64}$/.test(digest) || packageName!==PACKAGE ||
     !productId?.trim()) throw new Error("Invalid checkout challenge");
  return createHash("sha256").update(
    ["signalx:play:checkout-integrity:v1",digest,packageName,productId].join("\n")
  ).digest("base64url");
}

export type CheckoutIssueResult =
  | {kind:"issued";ticket:string;expiresAt:string;integrityRequestHash:string}
  | {kind:"invalid_input"|"disabled_user"|"unavailable"};

export async function issuePlayCheckoutTicketResearch(
  authenticatedSignalxUserId:string,
  config:Config,
  database:DB,
  now:Date=new Date(),
):Promise<CheckoutIssueResult> {
  if(!UUID.test(authenticatedSignalxUserId??"") || !configValid(config) ||
     !Number.isFinite(now.getTime())) return {kind:"invalid_input"};
  const ticket=randomBytes(32).toString("base64url");
  const digest=ticketDigest(ticket,config.ticketDigestKey);
  const expiresAt=new Date(now.getTime()+TTL_MS);
  try {
    const result=await database.query(
      `INSERT INTO public.signalx_play_checkout_tickets
        (ticket_digest,user_id,package_name,product_id,issued_at,expires_at)
       SELECT $1,u.id,$2,$3,$4,$5 FROM public.signalx_users AS u
       WHERE u.id=$6 AND u.disabled_at IS NULL
       RETURNING id`,
      [digest,config.packageName,config.allowedProductId,
       now.toISOString(),expiresAt.toISOString(),authenticatedSignalxUserId]
    );
    if(result.rowCount!==1) return {kind:"disabled_user"};
  } catch {return {kind:"unavailable"};}
  return {
    kind:"issued",ticket,expiresAt:expiresAt.toISOString(),
    integrityRequestHash:checkoutIntegrityRequestHash(
      digest,config.packageName,config.allowedProductId
    )
  };
}

export type CheckoutRedeemResult =
  | {kind:"redeemed";productId:string;obfuscatedAccountId:string}
  | {kind:"invalid_input"|"not_available"|"untrusted_android"|"unavailable"};

export async function redeemPlayCheckoutTicketResearch(
  request:{ticket:string;opaqueIntegrityToken:string},
  config:NativeConfig,
  database:DB,
  decodeWithTrustedGooglePlayIntegrity:VerifiedIntegrityDecoder,
  now:Date=new Date(),
):Promise<CheckoutRedeemResult> {
  if(!request || !TICKET.test(request.ticket??"") ||
     typeof request.opaqueIntegrityToken!=="string" ||
     !request.opaqueIntegrityToken.trim() ||
     request.opaqueIntegrityToken.length>8192 ||
     !configValid(config) || !Number.isFinite(now.getTime()) ||
     !Array.isArray(config.allowedPlaySigningCertificateDigests) ||
     config.allowedPlaySigningCertificateDigests.length===0 ||
     config.allowedPlaySigningCertificateDigests.some(x=>typeof x!=="string" || !x.trim()) ||
     typeof decodeWithTrustedGooglePlayIntegrity!=="function")
    return {kind:"invalid_input"};

  const digest=ticketDigest(request.ticket,config.ticketDigestKey);
  let row:{user_id:string;product_id:string;package_name:string;issued_at:Date;expires_at:Date;consumed_at:Date|null};
  try {
    const data=await database.query(
      `SELECT user_id,product_id,package_name,issued_at,expires_at,consumed_at
       FROM public.signalx_play_checkout_tickets WHERE ticket_digest=$1`,
      [digest]
    );
    if(data.rowCount!==1) return {kind:"not_available"};
    row=data.rows[0];
  }catch {return {kind:"unavailable"};}
  if(row.consumed_at || row.package_name!==config.packageName ||
     row.product_id!==config.allowedProductId ||
     now.getTime()<new Date(row.issued_at).getTime() ||
     now.getTime()>=new Date(row.expires_at).getTime())
    return {kind:"not_available"};

  // Verified Google decoder is a deliberate UNIMPLEMENTED production boundary.
  // App Links alone do not prove the origin or integrity of an API caller.
  let decoded:DecodedIntegrity|null;
  try { decoded=await decodeWithTrustedGooglePlayIntegrity(request.opaqueIntegrityToken); }
  catch {return {kind:"untrusted_android"};}
  const details=decoded?.requestDetails;
  const app=decoded?.appIntegrity;
  const ts=Number(details?.timestampMillis);
  const certs=app?.certificateSha256Digest;
  const expectedHash=checkoutIntegrityRequestHash(digest,config.packageName,row.product_id);
  if(!details || !app ||
     details.requestPackageName!==config.packageName ||
     details.requestHash!==expectedHash ||
     app.packageName!==config.packageName ||
     app.appRecognitionVerdict!=="PLAY_RECOGNIZED" ||
     !Number.isFinite(ts) || ts<=0 ||
     now.getTime()-ts>MAX_INTEGRITY_AGE_MS ||
     ts-now.getTime()>MAX_CLOCK_SKEW_MS ||
     !Array.isArray(certs) ||
     !certs.some(digest=>config.allowedPlaySigningCertificateDigests.includes(digest)))
    return {kind:"untrusted_android"};
  try {
    const claimed=await database.query(
      `UPDATE public.signalx_play_checkout_tickets AS t
       SET consumed_at=$2
       WHERE t.ticket_digest=$1 AND t.consumed_at IS NULL
         AND t.issued_at<=$2 AND t.expires_at>$2
         AND t.package_name=$3 AND t.product_id=$4
         AND EXISTS (
           SELECT 1 FROM public.signalx_users AS u
           WHERE u.id=t.user_id AND u.disabled_at IS NULL
         )
       RETURNING t.user_id`,
      [digest,now.toISOString(),config.packageName,config.allowedProductId]
    );
    if(claimed.rowCount!==1) return {kind:"not_available"};
    return {
      kind:"redeemed",
      productId:row.product_id,
      obfuscatedAccountId:obfuscatedSignalxPlayAccountId(
        claimed.rows[0].user_id,config.accountBindingKey
      )
    };
  } catch {return {kind:"unavailable"};}
}
