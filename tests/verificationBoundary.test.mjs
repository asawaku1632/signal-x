import assert from "node:assert/strict";
import test from "node:test";
import { verifyBillingNotification } from "../app/lib/billing/verificationBoundary.ts";
const notice={provider:"stripe",eventId:"evt_1",subscriptionId:"sub_1",occurredAt:"2026-10-18T00:00:00Z",verification:"stripe_signature"};
const input={provider:"stripe",rawBody:"raw",signatureOrToken:"signature"};
test("accepts a properly formed result only from verifier callback",async()=>{
 const result=await verifyBillingNotification(input,{stripe:async()=>notice,google_play:async()=>null});
 assert.equal(result.ok,true);assert.equal(result.dedupeKey,JSON.stringify(["stripe","evt_1"]));
});
test("rejected signature cannot grant access",async()=>{
 const result=await verifyBillingNotification(input,{stripe:async()=>null,google_play:async()=>null});
 assert.deepEqual(result,{ok:false,reason:"unverified"});
});
test("verifier outage denies access",async()=>{
 const result=await verifyBillingNotification(input,{stripe:async()=>{throw Error("outage")},google_play:async()=>null});
 assert.deepEqual(result,{ok:false,reason:"unverified"});
});
test("provider mismatch denies access",async()=>{
 const result=await verifyBillingNotification(input,{stripe:async()=>({...notice,provider:"google_play"}),google_play:async()=>null});
 assert.equal(result.ok,false);
});
test("wrong verification method denies access",async()=>{
 const result=await verifyBillingNotification(input,{stripe:async()=>({...notice,verification:"google_play_developer_api"}),google_play:async()=>null});
 assert.equal(result.ok,false);
});
test("empty signature is rejected before verifier is called",async()=>{
 let calls=0;
 const result=await verifyBillingNotification({...input,signatureOrToken:" "},{stripe:async()=>{calls++;return notice},google_play:async()=>null});
 assert.equal(result.ok,false);assert.equal(calls,0);
});
test("never returns premium entitlement directly",async()=>{
 const result=await verifyBillingNotification(input,{stripe:async()=>notice,google_play:async()=>null});
 assert.equal("hasPremiumAccess" in result,false);
});
