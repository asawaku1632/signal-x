import test from "node:test";
import assert from "node:assert/strict";
import {lookupVerifiedPlaySubscription as lookup} from "../app/lib/billing/playSubscriptionLookup.ts";
const args={packageName:"jp.signalx.app",expectedPackageName:"jp.signalx.app",purchaseToken:"token123",productId:"premium_month",oauthAccessToken:"secret",now:new Date("2026-10-18T00:00:00Z")};
const purchase={subscriptionState:"SUBSCRIPTION_STATE_ACTIVE",lineItems:[{productId:"premium_month",expiryTime:"2026-11-18T00:00:00Z"}]};
test("fetches v2 endpoint with server token and exact package",async()=>{
 let called=0;const result=await lookup(args,async(url,init)=>{called++;assert.match(url,/subscriptionsv2\/tokens\/token123$/);assert.equal(init.headers.Authorization,"Bearer secret");return {ok:true,status:200,json:async()=>purchase}});
 assert.equal(called,1);assert.equal(result.ok,true);assert.equal(result.state.status,"active");
});
test("wrong package rejected without HTTP call",async()=>{
 let called=false;const result=await lookup({...args,packageName:"com.attacker.app"},async()=>{called=true;throw Error("should not call")});assert.equal(result.ok,false);assert.equal(called,false);
});
test("failed provider lookup rejects",async()=>assert.equal((await lookup(args,async()=>({ok:false,status:403,json:async()=>({})}))).ok,false));
test("provider outage rejects",async()=>assert.equal((await lookup(args,async()=>{throw Error("network") })).ok,false));
test("unknown product rejected",async()=>assert.equal((await lookup(args,async()=>({ok:true,status:200,json:async()=>({...purchase,lineItems:[{productId:"other"}]})}))).ok,false));
test("active state with expired item never grants premium",async()=>{
 const result=await lookup(args,async()=>({ok:true,status:200,json:async()=>({...purchase,lineItems:[{productId:"premium_month",expiryTime:"2026-10-17T00:00:00Z"}]})}));
 assert.equal(result.ok,true);assert.equal(result.state.status,"expired");
});
test("does not issue a grant or write database state",async()=>{
 const r=await lookup(args,async()=>({ok:true,status:200,json:async()=>purchase}));
 assert.equal("signalxUserId" in r,false);assert.equal("hasPremiumAccess" in r,false);
});
