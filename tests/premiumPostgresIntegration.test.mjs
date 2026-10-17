import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { persistVerifiedBillingUpdate } from "../app/lib/billing/persistVerifiedBillingUpdate.ts";
const { Pool } = pg;
const url = process.env.BILLING_TEST_DATABASE_URL;
test("real isolated PostgreSQL enforces atomic updates and replay safety", { skip: !url }, async () => {
  const pool = new Pool({connectionString:url, max:5});
  const load = async (p) => readFile(new URL("../"+p,import.meta.url),"utf8");
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await pool.query(`CREATE TABLE public.signalx_users (id UUID PRIMARY KEY DEFAULT gen_random_uuid())`);
    await pool.query(await load("scripts/migrations/20261018_create_premium_entitlements_isolated.sql"));
    await pool.query(await load("scripts/migrations/20261018_create_billing_event_inbox_isolated.sql"));
    const user = await pool.query("INSERT INTO public.signalx_users DEFAULT VALUES RETURNING id");
    const id = user.rows[0].id;
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
  } finally { await pool.end(); }
});
