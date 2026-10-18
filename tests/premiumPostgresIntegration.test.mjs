import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { persistVerifiedBillingUpdate } from "../app/lib/billing/persistVerifiedBillingUpdate.ts";
import { registerFirstPlayPurchase } from "../app/lib/billing/registerFirstPlayPurchase.ts";
import { refreshRestoredPlayEntitlement } from "../app/lib/billing/refreshRestoredPlayEntitlement.ts";
import { obfuscatedSignalxPlayAccountId } from "../app/lib/billing/playInitialPurchaseApproval.ts";
import { fingerprintPlayPurchaseToken } from "../app/lib/billing/playTokenFingerprint.ts";
import { issuePlayCheckoutTicketResearch, redeemPlayCheckoutTicketResearch } from "../app/lib/billing/playCheckoutTicketResearch.ts";
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
    await pool.query(await load("scripts/migrations/20261018_create_play_checkout_tickets_isolated.sql"));
    const user = await pool.query("INSERT INTO public.signalx_users DEFAULT VALUES RETURNING id");
    const id = user.rows[0].id;
    // One-use Android checkout ticket: only a trusted decoded Play Integrity
    // response can consume the persisted digest; concurrent redemption is atomic.
    const ticketClock=new Date("2026-10-18T02:00:00Z");
    const ticketConfig={
      packageName:"com.signalx.app",allowedProductId:"premium_month",
      ticketDigestKey:"ci-only-checkout-ticket-key-12345678901234567",
      accountBindingKey:"ci-only-checkout-account-key-123456789012345",
      allowedPlaySigningCertificateDigests:["ci-only-play-signing-certificate"]
    };
    const decoderFor=(hash, timestamp=ticketClock)=>async()=>({
      requestDetails:{
        requestPackageName:"com.signalx.app",requestHash:hash,
        timestampMillis:String(timestamp.getTime())
      },
      appIntegrity:{
        appRecognitionVerdict:"PLAY_RECOGNIZED",
        packageName:"com.signalx.app",
        certificateSha256Digest:["ci-only-play-signing-certificate"]
      }
    });
    const issuedTicket=await issuePlayCheckoutTicketResearch(id,ticketConfig,pool,ticketClock);
    assert.equal(issuedTicket.kind,"issued");
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM public.signalx_play_checkout_tickets")).rows[0].n,1);
    const rawTokenLeak=await pool.query("SELECT count(*)::int AS n FROM public.signalx_play_checkout_tickets WHERE ticket_digest=$1",[issuedTicket.ticket]);
    assert.equal(rawTokenLeak.rows[0].n,0);
    const checkoutRequest={ticket:issuedTicket.ticket,opaqueIntegrityToken:"ci-attestation-token"};
    const legitimateDecoder=decoderFor(issuedTicket.integrityRequestHash);
    const attempts=await Promise.all([
      redeemPlayCheckoutTicketResearch(checkoutRequest,ticketConfig,pool,legitimateDecoder,ticketClock),
      redeemPlayCheckoutTicketResearch(checkoutRequest,ticketConfig,pool,legitimateDecoder,ticketClock)
    ]);
    assert.deepEqual(attempts.map(x=>x.kind).sort(),["not_available","redeemed"]);
    const expectedAccount=obfuscatedSignalxPlayAccountId(id,ticketConfig.accountBindingKey);
    assert.equal(attempts.find(x=>x.kind==="redeemed").obfuscatedAccountId,expectedAccount);
    const consumed=await pool.query("SELECT count(*)::int AS n FROM public.signalx_play_checkout_tickets WHERE consumed_at IS NOT NULL");
    assert.equal(consumed.rows[0].n,1);
    const replay=await redeemPlayCheckoutTicketResearch(checkoutRequest,ticketConfig,pool,legitimateDecoder,ticketClock);
    assert.equal(replay.kind,"not_available");
    const ticketExpired=await issuePlayCheckoutTicketResearch(id,ticketConfig,pool,ticketClock);
    const afterDeadline=new Date(ticketClock.getTime()+120000);
    assert.equal((await redeemPlayCheckoutTicketResearch(
      {ticket:ticketExpired.ticket,opaqueIntegrityToken:"ci-attestation-token"},
      ticketConfig,pool,decoderFor(ticketExpired.integrityRequestHash,afterDeadline),afterDeadline
    )).kind,"not_available");
    const ticketNoProof=await issuePlayCheckoutTicketResearch(id,ticketConfig,pool,ticketClock);
    assert.equal((await redeemPlayCheckoutTicketResearch(
      {ticket:ticketNoProof.ticket,opaqueIntegrityToken:"ci-attestation-token"},
      ticketConfig,pool,async()=>null,ticketClock
    )).kind,"untrusted_android");
    const stillOpen=await pool.query(
      "SELECT count(*)::int AS n FROM public.signalx_play_checkout_tickets WHERE consumed_at IS NULL AND expires_at>$1",
      [ticketClock.toISOString()]
    );
    assert.equal(stillOpen.rows[0].n,2);
    const disabledForCheckout=await pool.query("INSERT INTO public.signalx_users DEFAULT VALUES RETURNING id");
    const disabledCheckoutUser=disabledForCheckout.rows[0].id;
    const issuedBeforeDisable=await issuePlayCheckoutTicketResearch(
      disabledCheckoutUser,ticketConfig,pool,ticketClock
    );
    assert.equal(issuedBeforeDisable.kind,"issued");
    await pool.query("UPDATE public.signalx_users SET disabled_at=NOW() WHERE id=$1",[disabledCheckoutUser]);
    assert.equal((await redeemPlayCheckoutTicketResearch(
      {ticket:issuedBeforeDisable.ticket,opaqueIntegrityToken:"ci-attestation-token"},
      ticketConfig,pool,decoderFor(issuedBeforeDisable.integrityRequestHash),ticketClock
    )).kind,"not_available");
    const disabledTicketClaim=await pool.query(
      "SELECT count(*)::int AS n FROM public.signalx_play_checkout_tickets WHERE user_id=$1 AND consumed_at IS NOT NULL",
      [disabledCheckoutUser]
    );
    assert.equal(disabledTicketClaim.rows[0].n,0);
    const otherUser=await pool.query("INSERT INTO public.signalx_users DEFAULT VALUES RETURNING id");
    const fingerprint="a".repeat(64);
    await pool.query(
      "INSERT INTO public.signalx_play_purchase_bindings (user_id,purchase_token_fingerprint,package_name,product_id) VALUES ($1,$2,$3,$4)",
      [id,fingerprint,"com.signalx.app","premium_month"]
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO public.signalx_play_purchase_bindings (user_id,purchase_token_fingerprint,package_name,product_id) VALUES ($1,$2,$3,$4)",
        [otherUser.rows[0].id,fingerprint,"com.signalx.app","premium_month"]
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
      packageName:"com.signalx.app",productId:"premium_month",
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

    // Existing-owner restoration must refresh rights, never create a new owner.
    const restoreCfg={
      packageName:playConfig.packageName,
      productId:playConfig.productId,
      oauthAccessToken:playConfig.oauthAccessToken,
      fingerprintSecret:playConfig.purchaseFingerprintKey,
    };
    const graceHttp=async()=>({
      ok:true,status:200,json:async()=>({
        ...playResponse,subscriptionState:"SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
      }),
    });
    const restored=await refreshRestoredPlayEntitlement(
      request,restoreCfg,pool,graceHttp,new Date("2026-10-19T02:00:00Z")
    );
    assert.equal(restored.kind,"refreshed");
    const grace=await pool.query(
      "SELECT status FROM public.signalx_premium_entitlements WHERE provider='google_play' AND external_subscription_id=$1",
      [playFingerprint]
    );
    assert.equal(grace.rows[0].status,"grace_period");
    const wrongOwner=await refreshRestoredPlayEntitlement(
      otherAccountReq,restoreCfg,pool,graceHttp,new Date("2026-10-20T02:00:00Z")
    );
    assert.equal(wrongOwner.kind,"owner_mismatch");
    const afterWrongOwner=await pool.query(
      "SELECT user_id FROM public.signalx_premium_entitlements WHERE provider='google_play' AND external_subscription_id=$1",
      [playFingerprint]
    );
    assert.equal(afterWrongOwner.rows[0].user_id,id);
    // A binding record alone cannot manufacture an entitlement.
    const orphanToken="ci-orphan-play-token";
    const orphanFingerprint=fingerprintPlayPurchaseToken(orphanToken,playConfig.purchaseFingerprintKey);
    await pool.query(
      `INSERT INTO public.signalx_play_purchase_bindings
       (user_id,purchase_token_fingerprint,package_name,product_id)
       VALUES ($1,$2,$3,$4)`,
      [id,orphanFingerprint,playConfig.packageName,playConfig.productId]
    );
    const notGranted=await refreshRestoredPlayEntitlement(
      {...request,purchaseToken:orphanToken},restoreCfg,pool,googleMock,new Date("2026-10-20T02:00:00Z")
    );
    assert.equal(notGranted.kind,"missing_entitlement");
    assert.equal((await pool.query(
      "SELECT id FROM public.signalx_premium_entitlements WHERE provider='google_play' AND external_subscription_id=$1",
      [orphanFingerprint]
    )).rowCount,0);
    await pool.query(
      "UPDATE public.signalx_premium_entitlements SET revoked_at=NOW() WHERE provider='google_play' AND external_subscription_id=$1",
      [playFingerprint]
    );
    assert.equal((await refreshRestoredPlayEntitlement(
      request,restoreCfg,pool,googleMock,new Date("2026-10-21T02:00:00Z")
    )).kind,"revoked_requires_review");
  } finally { await pool.end(); }
});
