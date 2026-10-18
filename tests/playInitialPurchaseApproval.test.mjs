import assert from "node:assert/strict";
import test from "node:test";
import {
  assessVerifiedFirstPlayPurchase as assess,
  obfuscatedSignalxPlayAccountId,
} from "../app/lib/billing/playInitialPurchaseApproval.ts";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const otherUser = "123e4567-e89b-42d3-a456-426614174001";
const now = new Date("2026-10-18T00:00:00Z");
const config = {
  packageName: "jp.signalx.app",
  productId: "premium_month",
  oauthAccessToken: "only-injected-server-test",
  purchaseFingerprintKey: "purchase-only-test-key-12345678901234567890",
  accountBindingKey: "account-only-test-key-12345678901234567890",
};
const request = {authenticatedSignalxUserId: userId, purchaseToken:"token_abc"};
function purchase(fields = {}) {
  return {
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    lineItems: [{productId: "premium_month", expiryTime:"2026-11-18T00:00:00Z"}],
    externalAccountIdentifiers: {
      obfuscatedExternalAccountId: obfuscatedSignalxPlayAccountId(userId, config.accountBindingKey),
    },
    ...fields,
  };
}
function mocked(response) {
  let calls = 0;
  return {
    get calls(){return calls;},
    get: async () => {
      calls++;
      return {ok:true,status:200,json:async()=>response};
    }
  };
}
test("matching server-verified Play account produces candidate but does not write or grant",async()=>{
  const http=mocked(purchase());
  const r=await assess(request,config,http.get,now);
  assert.equal(r.kind,"eligible_verified");
  assert.equal(r.candidate.userId,userId);
  assert.equal(r.candidate.status,"active");
  assert.match(r.candidate.purchaseTokenFingerprint,/^[a-f0-9]{64}$/);
  assert.equal(r.candidate.validUntil,"2026-11-18T00:00:00Z");
  assert.equal("hasPremiumAccess" in r,false);
  assert.equal(http.calls,1);
});
test("different SIGNALX user cannot claim same purchase",async()=>{
  const r=await assess({...request,authenticatedSignalxUserId:otherUser},config,mocked(purchase()).get,now);
  assert.equal(r.kind,"account_mismatch");
});
test("missing provider account binding prevents first assignment",async()=>{
  assert.equal((await assess(request,config,mocked(purchase({externalAccountIdentifiers:{}})).get,now)).kind,"account_mismatch");
});
test("linked previous purchase token must be migrated, not double granted",async()=>{
  const r=await assess(request,config,mocked(purchase({linkedPurchaseToken:"old-token"})).get,now);
  assert.equal(r.kind,"linked_purchase_requires_migration");
});
test("expired, pending, hold purchases cannot qualify",async()=>{
  for(const subscriptionState of ["SUBSCRIPTION_STATE_PENDING","SUBSCRIPTION_STATE_ON_HOLD","SUBSCRIPTION_STATE_EXPIRED"]){
    assert.equal((await assess(request,config,mocked(purchase({subscriptionState})).get,now)).kind,"inactive");
  }
});
test("invalid or missing server keys rejected before Google request",async()=>{
  const http=mocked(purchase());
  assert.equal((await assess(request,{...config,accountBindingKey:"short"},http.get,now)).kind,"invalid_input");
  assert.equal((await assess(request,{...config,purchaseFingerprintKey:config.accountBindingKey},http.get,now)).kind,"invalid_input");
  assert.equal(http.calls,0);
});
test("provider error fails closed",async()=>{
  const r=await assess(request,config,async()=>({ok:false,status:401,json:async()=>({})}),now);
  assert.equal(r.kind,"provider_unverified");
});
test("derived opaque ID is stable and bound to user and key",()=>{
  const id=obfuscatedSignalxPlayAccountId(userId,config.accountBindingKey);
  assert.match(id,/^[a-f0-9]{64}$/);
  assert.notEqual(id,obfuscatedSignalxPlayAccountId(otherUser,config.accountBindingKey));
  assert.notEqual(id,obfuscatedSignalxPlayAccountId(userId,config.accountBindingKey+"different"));
});
