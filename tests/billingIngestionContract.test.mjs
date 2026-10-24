import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {validateVerifiedBillingNotice} from "../app/lib/billing/billingIngestionContract.ts";
const base={provider:"stripe",eventId:"evt_abc",subscriptionId:"sub_abc",occurredAt:"2026-10-18T00:00:00Z",verification:"stripe_signature"};
test("verified Stripe notice yields stable idempotency key",()=>{
 const a=validateVerifiedBillingNotice(base);assert.equal(a.accepted,true);
 assert.equal(a.dedupeKey,JSON.stringify(["stripe","evt_abc"]));
});
test("provider-specific proof required",()=>assert.equal(validateVerifiedBillingNotice({...base,verification:"google_play_developer_api"}).accepted,false));
test("unrecognized, blank and malformed notices fail closed",()=>{
 for(const patch of [{eventId:""},{subscriptionId:" "},{occurredAt:"wrong"},{provider:"other"}])
  assert.equal(validateVerifiedBillingNotice({...base,...patch}).accepted,false);
});
test("Google Play verified notice accepted but no authorization automatically granted",()=>{
 const result=validateVerifiedBillingNotice({...base,provider:"google_play",verification:"google_play_developer_api"});
 assert.equal(result.accepted,true);assert.equal("premium" in result,false);
});
test("database inbox requires unique provider-event ID, RLS and no delete",async()=>{
 const sql=await readFile(new URL("../scripts/migrations/20261018_create_billing_event_inbox_isolated.sql",import.meta.url),"utf8");
 assert.match(sql,/UNIQUE\(provider,provider_event_id\)/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL PRIVILEGES/);
 assert.doesNotMatch(sql,/^\s*(DROP|TRUNCATE|DELETE)\b/im);
});
