import assert from "node:assert/strict";
import test from "node:test";
import {persistVerifiedBillingUpdate} from "../app/lib/billing/persistVerifiedBillingUpdate.ts";
const notice={provider:"stripe",eventId:"evt1",subscriptionId:"sub1",occurredAt:"2026-10-18T00:00:00Z",verification:"stripe_signature"};
const event={provider:"stripe",eventId:"evt1",externalSubscriptionId:"sub1",eventAt:notice.occurredAt,status:"active",validUntil:"2026-11-18T00:00:00Z"};
function fake({duplicate=false,missingOwner=false,oldTime=null}={}){
 const calls=[];let releases=0;
 const client={release(){releases++},async query(sql,args=[]){
  calls.push(sql);
  if(sql.includes("INSERT INTO public.signalx_billing_event_inbox")) return {rowCount:duplicate?0:1};
  if(sql.includes("FROM public.signalx_premium_entitlements")) return missingOwner?{rowCount:0,rows:[]}:{rowCount:1,rows:[{user_id:"user1",provider:"stripe",external_subscription_id:"sub1",status:"active",valid_until:event.validUntil,revoked_at:null,provider_event_at:oldTime}]};
  return {rowCount:1,rows:[]};
 }};
 return {db:{async connect(){return client}},calls,get releases(){return releases}};
}
test("valid notification atomically applies and commits",async()=>{
 const f=fake();assert.equal(await persistVerifiedBillingUpdate(f.db,{notice,event}),"applied");
 assert.equal(f.calls.at(-1),"COMMIT");assert.equal(f.releases,1);
});
test("duplicate event does not update subscription",async()=>{
 const f=fake({duplicate:true});
 assert.equal(await persistVerifiedBillingUpdate(f.db,{notice,event}),"duplicate");
 assert.equal(f.calls.some(s=>s.includes("SET status=$3")),false);
});
test("unknown ownership rolls back, granting nothing",async()=>{
 const f=fake({missingOwner:true});
 assert.equal(await persistVerifiedBillingUpdate(f.db,{notice,event}),"unknown_owner");
 assert.equal(f.calls.at(-1),"ROLLBACK");
});
test("older event cannot overwrite subscription",async()=>{
 const f=fake({oldTime:"2026-10-19T00:00:00Z"});
 assert.equal(await persistVerifiedBillingUpdate(f.db,{notice,event}),"stale");
 assert.equal(f.calls.some(s=>s.includes("SET status=$3")),false);
});
test("notice-event mismatch rejects before DB connection",async()=>{
 let connected=false;
 assert.equal(await persistVerifiedBillingUpdate({async connect(){connected=true;throw Error("unexpected")}},{notice,event:{...event,eventId:"other"}}),"rejected");
 assert.equal(connected,false);
});
