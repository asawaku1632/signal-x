import assert from "node:assert/strict";
import test from "node:test";
import {planVerifiedPlaySubscriptionAcknowledgement as decide} from "../app/lib/billing/playAcknowledgementPolicy.ts";

const now=new Date("2026-10-18T00:00:00Z");
const digest="a".repeat(64), accountId="b".repeat(64);
const purchase={
  subscriptionState:"SUBSCRIPTION_STATE_ACTIVE",
  acknowledgementState:"ACKNOWLEDGEMENT_STATE_PENDING",
  lineItems:[{productId:"premium_month",expiryTime:"2026-11-18T00:00:00Z"}],
  externalAccountIdentifiers:{obfuscatedExternalAccountId:accountId}
};
const owner={userId:"user-1",packageName:"com.signalx.app",productId:"premium_month",tokenFingerprint:digest};
const entitlement={
  userId:"user-1",provider:"google_play",externalSubscriptionId:digest,
  status:"active",validUntil:"2026-11-18T00:00:00Z",revokedAt:null
};
const input={
  verifiedProviderPurchase:purchase,
  expectedPackageName:"com.signalx.app",
  expectedProductId:"premium_month",
  expectedObfuscatedAccountId:accountId,
  expectedUserId:"user-1",expectedTokenFingerprint:digest,
  persistedOwner:owner,persistedEntitlement:entitlement
};
test("valid pending Play acknowledgement is required after committed entitlement",()=>{
  assert.deepEqual(decide(input,now),{kind:"acknowledge_required"});
});
test("already acknowledged purchase causes no duplicate request",()=>{
  assert.deepEqual(decide({...input,verifiedProviderPurchase:{...purchase,acknowledgementState:"ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"}},now),{kind:"already_acknowledged"});
});
test("no verified account binding or wrong account is blocked",()=>{
  for(const externalAccountIdentifiers of [undefined,{}, {obfuscatedExternalAccountId:"c".repeat(64)}]){
    assert.deepEqual(decide({...input,verifiedProviderPurchase:{...purchase,externalAccountIdentifiers}},now),{kind:"blocked",reason:"unverified_account"});
  }
});
test("uncertain acknowledgement state fails closed",()=>{
  for(const acknowledgementState of [undefined,"ACKNOWLEDGEMENT_STATE_UNSPECIFIED","UNKNOWN"]){
    assert.deepEqual(decide({...input,verifiedProviderPurchase:{...purchase,acknowledgementState}},now),{kind:"blocked",reason:"unknown_acknowledgement_state"});
  }
});
test("pending, on hold, paused and expired subscriptions are never acknowledged",()=>{
  for(const subscriptionState of ["SUBSCRIPTION_STATE_PENDING","SUBSCRIPTION_STATE_ON_HOLD","SUBSCRIPTION_STATE_PAUSED","SUBSCRIPTION_STATE_EXPIRED"]){
    assert.deepEqual(decide({...input,verifiedProviderPurchase:{...purchase,subscriptionState}},now),{kind:"blocked",reason:"provider_inactive"});
  }
});
test("replaced/linked purchase must use distinct migration path",()=>{
  assert.deepEqual(decide({...input,verifiedProviderPurchase:{...purchase,linkedPurchaseToken:"previous"}},now),{kind:"blocked",reason:"linked_token"});
});
test("missing or wrong persisted user/owner cannot acknowledge",()=>{
  assert.deepEqual(decide({...input,persistedOwner:null},now),{kind:"blocked",reason:"wrong_owner"});
  assert.deepEqual(decide({...input,persistedOwner:{...owner,userId:"other"}},now),{kind:"blocked",reason:"wrong_owner"});
  assert.deepEqual(decide({...input,persistedOwner:{...owner,packageName:"other.app"}},now),{kind:"blocked",reason:"wrong_owner"});
});
test("revoked, missing, expired or wrong-user entitlement cannot acknowledge",()=>{
  const invalid=[
    null,
    {...entitlement,revokedAt:"2026-10-17T00:00:00Z"},
    {...entitlement,userId:"other"},
    {...entitlement,validUntil:"2026-10-17T00:00:00Z"},
    {...entitlement,status:"past_due"}
  ];
  for(const persistedEntitlement of invalid){
    assert.deepEqual(decide({...input,persistedEntitlement},now),{kind:"blocked",reason:"not_entitled"});
  }
});
test("wrong product and invalid identities are blocked",()=>{
  assert.deepEqual(decide({...input,expectedProductId:"unknown"},now),{kind:"blocked",reason:"wrong_product"});
  assert.deepEqual(decide({...input,expectedObfuscatedAccountId:"bad"},now),{kind:"blocked",reason:"invalid_input"});
});
