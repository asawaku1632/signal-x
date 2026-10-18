import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { persistVerifiedBillingUpdate } from "../app/lib/billing/persistVerifiedBillingUpdate.ts";
import { registerFirstPlayPurchase } from "../app/lib/billing/registerFirstPlayPurchase.ts";
import { obfuscatedSignalxPlayAccountId } from "../app/lib/billing/playInitialPurchaseApproval.ts";
import { fingerprintPlayPurchaseToken } from "../app/lib/billing/playTokenFingerprint.ts";
const { Pool } = pg;
const url = process.env.BILLING_TEST_DATABASE_URL;
test("real isolated PostgreSQL enforces atomic updates and replay safety", { skip: !url }, async () => {
  const pool = new Pool({connectionString:url, max:5});
  const load = async (p) => readFile(new URL("../"+p,import.meta.url),"utf8");
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    for (const role of ["anon", "authenticated", "service_role"]) {
      await pool.query("CREATE ROLE " + role + " NOLOGIN");
    }
    await pool.query(`CREATE TABLE public.signalx_users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), disabled_at TIMESTAMPTZ)`);
    await pool.query(await load("scripts/migrations/20261018_create_premium_entitlements_isolated.sql"));
    await pool.query(await load("scripts/migrations/20261018_create_billing_event_inbox_isolated.sql"));
    await pool.query(await load("scripts/migrations/20261018_create_play_purchase_bindings_isolated.sql"));
    const user = await pool.query("INSERT INTO public.signalx_users DEFAULT VALUES RETURNING id");
    const id = user.rows[0].id;
    const otherUser=await pool.query("INSERT INTO public.signalx_users DEFAULT VALUES RETURNING id");
    const fingerprint="a".repeat(64);
    await pool.query(
      "INSERT INTO public.signalx_play_purchase_bindings (user_id,purchase_token_fingerprint,package_name,product_id) VALUES ($1,$2,$3,$4)",
      [id,fingerprint,"jp.signalx.app","premium_month"]
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO public.signalx_play_purchase_bindings (user_id,purchase_token_fingerprint,package_name,product_id) VALUES ($1,$2,$3,$4)",
        [otherUser.rows[0].id,fingerprint,"jp.signalx.app","premium_month"]
      ),{code:"23505"}
    );
    const bound=await pool.query("SELECT user_id FROM public.signalx_play_purchase_bindings WHERE purchase_token_fingerprint=$1",[fingerprint]);
    assert.equal(bound.rows.length,1);
    assert.equal(bound.rows[0].user_id,id);
    await assert.rejects(
      pool.query(
        "UPDATE public.signalx_play_purchase_bindings SET user_id=$1 WHERE purchase_token_fingerprint=$2",
        [otherUser.rows[0].id,fingerprint]
      ),{code:"23514"}
    );
    const unchanged=await pool.query(
      "SELECT user_id FROM public.signalx_play_purchase_bindings WHERE purchase_token_fingerprint=$1",
      [fingerprint]
    );
    assert.equal(unchanged.rows[0].user_id,id);
    await pool.query(`INSERT INTO public.signalx_premium_entitlements
       (user_id,provider,external_subscription_id,status,valid_until)
       VALUES ($1,'stripe','sub_test','active','2026-11-18T00:00:00Z')`,[id]);
    const mk = (eventId,eventAt,status) => ({
      notice:{provider:"stripe",eventId,subscriptionId:"sub_test",occurredAt:eventAt,verification:"stripe_signature"},
      event:{provider:"stripe",eventId,externalSubscriptionId:"sub_test",eventAt,status,validUntil:"2026-11-18T00:00:00Z"}
    });
    const first=mk("evt1","2026-10-18T00:00:00Z","active");
    assert.equal(await persistVerifiedBillingUpdate(pool,first),"applied");
    assert.equal(await persistVerifiedBillingUpdate(pool,first),"duplicate");
    const future=mk("evt2","2026-10-19T00:00:00Z","canceled");
    assert.equal(await persistVerifiedBillingUpdate(pool,future),"applied");
    assert.equal(await persistVerifiedBillingUpdate(pool,mk("evt_old","2026-10-18T12:00:00Z","active")),"stale");
    const state=await pool.query("SELECT status FROM public.signalx_premium_entitlements WHERE external_subscription_id='sub_test'");
    assert.equal(state.rows[0].status,"canceled");
    const pair=mk("evt3","2026-10-20T00:00:00Z","active");
    const concurrent=await Promise.all([persistVerifiedBillingUpdate(pool,pair),persistVerifiedBillingUpdate(pool,pair)]);
    assert.deepEqual(concurrent.sort(),["applied","duplicate"]);
    const inbox=await pool.query("SELECT count(*)::int AS n FROM public.signalx_billing_event_inbox WHERE provider_event_id='evt3'");
    assert.equal(inbox.rows[0].n,1);
    const unknown=mk("evt_unknown","2026-10-21T00:00:00Z","active");
    unknown.notice.subscriptionId="not_bound";
    unknown.event.externalSubscriptionId="not_bound";
    assert.equal(await persistVerifiedBillingUpdate(pool,unknown),"unknown_owner");
    const absent=await pool.query("SELECT count(*)::int AS n FROM public.signalx_billing_event_inbox WHERE provider_event_id='evt_unknown'");
    assert.equal(absent.rows[0].n,0);

    // First Play purchase: only a fresh provider response bound to this exact
    // authenticated SIGNALX user can create ownership + entitlement atomically.
    const playNow=new Date("2026-10-18T02:00:00Z");
    const playConfig={
      packageName:"jp.signalx.app",productId:"premium_month",
      oauthAccessToken:"fake-ci-oauth-token",
      accountBindingKey:"play-account-ci-isolation-key-12345678901234",
      purchaseFingerprintKey:"play-purchase-ci-isolation-key-1234567890123"
    };
    const request={authenticatedSignalxUserId:id,purchaseToken:"ci-new-play-token"};
    const playResponse={
      subscriptionState:"SUBSCRIPTION_STATE_ACTIVE",
      lineItems:[{productId:"premium_month",expiryTime:"2026-11-18T00:00:00Z"}],
      externalAccountIdentifiers:{
        obfuscatedExternalAccountId:obfuscatedSignalxPlayAccountId(id,playConfig.accountBindingKey)
      }
    };
    const googleMock=async (_url,init)=>{
      assert.equal(init.headers.Authorization,"Bearer fake-ci-oauth-token");
      return {ok:true,status:200,json:async()=>playResponse};
    };
    const registration=await registerFirstPlayPurchase(request,playConfig,pool,googleMock,playNow);
    assert.equal(registration.kind,"registered");
    const playFingerprint=fingerprintPlayPurchaseToken(request.purchaseToken,playConfig.purchaseFingerprintKey);
    const playOwner=await pool.query("SELECT user_id FROM public.signalx_play_purchase_bindings WHERE purchase_token_fingerprint=$1",[playFingerprint]);
    assert.equal(playOwner.rows[0].user_id,id);
    const playEntitlement=await pool.query(
      "SELECT user_id,status,valid_until FROM public.signalx_premium_entitlements WHERE provider='google_play' AND external_subscription_id=$1",
      [playFingerprint]
    );
    assert.equal(playEntitlement.rowCount,1);
    assert.equal(playEntitlement.rows[0].user_id,id);
    assert.equal(playEntitlement.rows[0].status,"active");
    assert.equal((await registerFirstPlayPurchase(request,playConfig,pool,googleMock,playNow)).kind,"refreshed");
    const otherAccountReq={...request,authenticatedSignalxUserId:otherUser.rows[0].id};
    assert.equal((await registerFirstPlayPurchase(otherAccountReq,playConfig,pool,googleMock,playNow)).kind,"account_mismatch");
    const boundCount=await pool.query("SELECT count(*)::int AS n FROM public.signalx_play_purchase_bindings WHERE purchase_token_fingerprint=$1",[playFingerprint]);
    assert.equal(boundCount.rows[0].n,1);
    // Disabled accounts must be denied even when the provider's account hash matches.
    await pool.query("UPDATE public.signalx_users SET disabled_at=NOW() WHERE id=$1",[otherUser.rows[0].id]);
    const secondToken="ci-disabled-account-token";
    const disabledResponse={
      ...playResponse,
      externalAccountIdentifiers:{
        obfuscatedExternalAccountId:obfuscatedSignalxPlayAccountId(otherUser.rows[0].id,playConfig.accountBindingKey)
      }
    };
    const disabledHttp=async()=>({ok:true,status:200,json:async()=>disabledResponse});
    assert.equal((await registerFirstPlayPurchase(
      {authenticatedSignalxUserId:otherUser.rows[0].id,purchaseToken:secondToken},
      playConfig,pool,disabledHttp,playNow)).kind,"disabled_user");
    const disabledFingerprint=fingerprintPlayPurchaseToken(secondToken,playConfig.purchaseFingerprintKey);
    assert.equal((await pool.query("SELECT id FROM public.signalx_play_purchase_bindings WHERE purchase_token_fingerprint=$1",[disabledFingerprint])).rowCount,0);
  } finally { await pool.end(); }
});
