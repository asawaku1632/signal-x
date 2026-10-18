/**
 * Google Play subscription acknowledgement safety gate (PURE / ISOLATED).
 *
 * Inputs MUST come from a fresh server-authorized subscriptionsv2.get response
 * and transactionally committed server-side ownership/entitlement records.
 * Passing these objects is not itself proof of provider verification.
 * No HTTP requests, payment actions, or automatic entitlement changes here.
 *
 * Google's acknowledgementState may be PENDING even for an active subscription.
 * A committed, correctly attributed entitlement should be acknowledged promptly.
 */
import {
  interpretVerifiedPlaySubscription,
  type PlaySubscriptionView,
} from "./playSubscriptionState.ts";

export type PlayAckDecision =
  | {kind:"acknowledge_required"}
  | {kind:"already_acknowledged"}
  | {kind:"blocked"; reason:
       "invalid_input"|"wrong_owner"|"wrong_product"|"not_entitled"|
       "provider_inactive"|"linked_token"|"unverified_account"|
       "unknown_acknowledgement_state"};

type CommittedOwnership = {
  userId:string;
  packageName:string;
  productId:string;
  tokenFingerprint:string;
};
type CommittedEntitlement = {
  userId:string;
  provider:"google_play";
  externalSubscriptionId:string;
  status:string;
  validUntil:string|null;
  revokedAt:string|null;
};

export function planVerifiedPlaySubscriptionAcknowledgement(
  input:{
    verifiedProviderPurchase:PlaySubscriptionView;
    expectedPackageName:string;
    expectedProductId:string;
    expectedObfuscatedAccountId:string;
    expectedUserId:string;
    expectedTokenFingerprint:string;
    persistedOwner:CommittedOwnership|null;
    persistedEntitlement:CommittedEntitlement|null;
  },
  now:Date=new Date(),
):PlayAckDecision {
  if(!input || !Number.isFinite(now.getTime()) ||
     !input.expectedUserId?.trim() ||
     !input.expectedTokenFingerprint?.trim() ||
     !input.expectedPackageName?.trim() ||
     !input.expectedProductId?.trim() ||
     !/^[a-f0-9]{64}$/.test(input.expectedObfuscatedAccountId??""))
    return {kind:"blocked",reason:"invalid_input"};

  const p=input.verifiedProviderPurchase;
  if(!p || !Array.isArray(p.lineItems) ||
     !p.lineItems.some(item=>item?.productId===input.expectedProductId))
    return {kind:"blocked",reason:"wrong_product"};

  // This does NOT accept TWA purchase token possession as proof of ownership.
  if(p.externalAccountIdentifiers?.obfuscatedExternalAccountId!==input.expectedObfuscatedAccountId)
    return {kind:"blocked",reason:"unverified_account"};
  if(p.linkedPurchaseToken)
    return {kind:"blocked",reason:"linked_token"};
  const status=interpretVerifiedPlaySubscription(p,input.expectedProductId,now);
  if(!["active","trialing","grace_period"].includes(status.status) ||
     !status.validUntil || Date.parse(status.validUntil)<=now.getTime())
    return {kind:"blocked",reason:"provider_inactive"};

  const binding=input.persistedOwner;
  if(!binding || binding.userId!==input.expectedUserId ||
      binding.packageName!==input.expectedPackageName ||
      binding.tokenFingerprint!==input.expectedTokenFingerprint)
    return {kind:"blocked",reason:"wrong_owner"};
  if(binding.productId!==input.expectedProductId)
    return {kind:"blocked",reason:"wrong_product"};

  const e=input.persistedEntitlement;
  if(!e || e.userId!==input.expectedUserId ||
     e.provider!=="google_play" ||
     e.externalSubscriptionId!==input.expectedTokenFingerprint ||
     e.revokedAt!==null ||
     !["active","trialing","grace_period"].includes(e.status) ||
     !e.validUntil || Date.parse(e.validUntil)<=now.getTime())
    return {kind:"blocked",reason:"not_entitled"};

  switch(p.acknowledgementState){
    case "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED": return {kind:"already_acknowledged"};
    case "ACKNOWLEDGEMENT_STATE_PENDING": return {kind:"acknowledge_required"};
    default: return {kind:"blocked",reason:"unknown_acknowledgement_state"};
  }
}
