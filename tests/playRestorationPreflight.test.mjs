import assert from "node:assert/strict";
import test from "node:test";
import {fingerprintPlayPurchaseToken} from "../app/lib/billing/playTokenFingerprint.ts";
import {preflightExistingPlayRestoration} from "../app/lib/billing/playRestorationPreflight.ts";
const secret="isolation-test-secret-not-for-production-123456";
const now=new Date("2026-10-18T00:00:00Z");
const req={authenticatedSignalxUserId:"user-1",purchaseToken:"opaque-token"};
const cfg={packageName:"jp.signalx.app",productId:"premium_month",oauthAccessToken:"server-oauth",fingerprintSecret:secret};
const verified={subscriptionState:"SUBSCRIPTION_STATE_ACTIVE",lineItems:[{productId:"premium_month",expiryTime:"2026-11-18T00:00:00Z"}]};
function fixture({owner="user-1", rows, response=verified, networkError=false, dbError=false}={}){
 const seen={http:0,db:0};
 const fp=fingerprintPlayPurchaseToken(req.purchaseToken,secret);
 const db={async query(sql,params){seen.db++;assert.match(sql,/signalx_play_purchase_bindings/);assert.deepEqual(params,[fp]);if(dbError)throw Error("DB unavailable");return {rows:rows??[{user_id:owner,package_name:cfg.packageName,product_id:cfg.productId}]}}};
 const http=async(url,init)=>{seen.http++;assert.match(url,/androidpublisher.googleapis.com/);assert.equal(init.headers.Authorization,"Bearer server-oauth");if(networkError)throw Error("offline");return {ok:true,status:200,json:async()=>response}};
 return {seen,db,http};
}
test("same-account device restoration verifies Play before selecting binding",async()=>{
 const f=fixture();const r=await preflightExistingPlayRestoration(req,cfg,f.db,f.http,now);
 assert.deepEqual(r,{kind:"verified_existing",signalxUserId:"user-1",validUntil:"2026-11-18T00:00:00Z",status:"active"});
 assert.equal(f.seen.http,1);assert.equal(f.seen.db,1);
});
test("different SIGNALX account cannot claim purchase",async()=>{
 const f=fixture({owner:"user-2"});const r=await preflightExistingPlayRestoration(req,cfg,f.db,f.http,now);
 assert.equal(r.kind,"owner_mismatch");
});
test("unbound purchase does not create enrollment or grant",async()=>{
 const f=fixture({rows:[]});const r=await preflightExistingPlayRestoration(req,cfg,f.db,f.http,now);
 assert.equal(r.kind,"unbound");assert.equal("premium" in r,false);
});
test("expired Google Play purchase cannot reach DB",async()=>{
 const f=fixture({response:{subscriptionState:"SUBSCRIPTION_STATE_EXPIRED",lineItems:verified.lineItems}});
 assert.equal((await preflightExistingPlayRestoration(req,cfg,f.db,f.http,now)).kind,"inactive");
 assert.equal(f.seen.db,0);
});
test("hold or pause denies restore",async()=>{
 for(const state of ["SUBSCRIPTION_STATE_ON_HOLD","SUBSCRIPTION_STATE_PAUSED"]){
  const f=fixture({response:{subscriptionState:state,lineItems:verified.lineItems}});
  assert.equal((await preflightExistingPlayRestoration(req,cfg,f.db,f.http,now)).kind,"inactive");
 }
});
test("network and provider error fail closed without DB read",async()=>{
 const f=fixture({networkError:true});
 assert.equal((await preflightExistingPlayRestoration(req,cfg,f.db,f.http,now)).kind,"provider_rejected");
 assert.equal(f.seen.db,0);
});
test("DB outage fails closed",async()=>{
 const f=fixture({dbError:true});assert.equal((await preflightExistingPlayRestoration(req,cfg,f.db,f.http,now)).kind,"unavailable");
});
test("different product is rejected despite valid purchase",async()=>{
 const f=fixture({rows:[{user_id:"user-1",package_name:cfg.packageName,product_id:"other"}]});
 assert.equal((await preflightExistingPlayRestoration(req,cfg,f.db,f.http,now)).kind,"product_mismatch");
});
test("invalid user ID never calls external systems",async()=>{
 const f=fixture();const r=await preflightExistingPlayRestoration({...req,authenticatedSignalxUserId:""},cfg,f.db,f.http,now);
 assert.equal(r.kind,"invalid_input");assert.equal(f.seen.http,0);assert.equal(f.seen.db,0);
});
