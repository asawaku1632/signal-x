/**
 * Pure purchase-restoration ownership policy.
 * Inputs must come from trusted server-side authenticated session,
 * persisted server-side bindings, and fresh provider lookup.
 * No network calls, account transfers, inserts, or authorization grants.
 */
export type ExistingPurchaseBinding = {
  provider: "google_play";
  purchaseTokenFingerprint: string;
  signalxUserId: string;
  productId: string;
};
export type RestoreDecision =
  | {kind:"restore_existing"; signalxUserId:string}
  | {kind:"owner_mismatch"|"unknown_purchase"|"invalid_input"|"ambiguous_binding"|"product_mismatch"};

const clean = (s:unknown): s is string => typeof s==="string" && s.length>0 && s===s.trim();

export function decidePlayPurchaseRestoration(
  authenticatedSignalxUserId:string,
  purchaseTokenFingerprint:string,
  expectedProductId:string,
  storedBindings:readonly ExistingPurchaseBinding[],
):RestoreDecision {
  if(!clean(authenticatedSignalxUserId)||!clean(purchaseTokenFingerprint)||!clean(expectedProductId))
    return {kind:"invalid_input"};
  const matched=storedBindings.filter(x=>x.provider==="google_play" && x.purchaseTokenFingerprint===purchaseTokenFingerprint);
  if(matched.length===0) return {kind:"unknown_purchase"};
  if(matched.length!==1 || !clean(matched[0].signalxUserId)) return {kind:"ambiguous_binding"};
  const owner=matched[0];
  if(owner.signalxUserId!==authenticatedSignalxUserId) return {kind:"owner_mismatch"};
  if(owner.productId!==expectedProductId) return {kind:"product_mismatch"};
  return {kind:"restore_existing",signalxUserId:owner.signalxUserId};
}
