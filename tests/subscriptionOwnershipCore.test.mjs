import assert from "node:assert/strict";
import test from "node:test";
import {resolveVerifiedSubscriptionOwner} from "../app/lib/billing/subscriptionOwnershipCore.ts";
const stripe = {provider:"stripe",externalSubscriptionId:"sub_1",signalxUserId:"user_1"};
test("verified subscription maps to exact server-side identity",()=>{
 assert.deepEqual(resolveVerifiedSubscriptionOwner("stripe","sub_1",[stripe]),{kind:"matched",signalxUserId:"user_1"});
});
test("unknown subscription never creates ownership",()=>{
 assert.equal(resolveVerifiedSubscriptionOwner("stripe","sub_2",[stripe]).kind,"unknown_subscription");
});
test("different provider with same ID cannot hijack ownership",()=>{
 assert.equal(resolveVerifiedSubscriptionOwner("google_play","sub_1",[stripe]).kind,"unknown_subscription");
});
test("duplicate bindings fail closed even if user IDs agree",()=>{
 assert.equal(resolveVerifiedSubscriptionOwner("stripe","sub_1",[stripe,stripe]).kind,"ambiguous_binding");
});
test("blank owner ID fails closed",()=>{
 assert.equal(resolveVerifiedSubscriptionOwner("stripe","sub_1",[{...stripe,signalxUserId:""}]).kind,"ambiguous_binding");
});
test("invalid identifiers are rejected",()=>{
 assert.equal(resolveVerifiedSubscriptionOwner("other","sub_1",[stripe]).kind,"invalid_input");
 assert.equal(resolveVerifiedSubscriptionOwner("stripe"," sub_1",[stripe]).kind,"invalid_input");
});
