/**
 * Transactional persistence of a PRE-VERIFIED provider event.
 * Not a public endpoint. Only a trusted server adapter may call this.
 * Requires the two proposed migrations; deliberately does not create owners.
 */
import type { Pool, PoolClient } from "pg";
import type { VerifiedBillingNotice } from "./billingIngestionContract.ts";
import type { VerifiedBillingEvent } from "./verifiedBillingEventCore.ts";
import { validateVerifiedBillingNotice } from "./billingIngestionContract.ts";
import { projectVerifiedBillingEvent } from "./verifiedBillingEventCore.ts";

type DB = Pick<Pool, "connect">;
export type VerifiedUpdate = { notice: VerifiedBillingNotice; event: VerifiedBillingEvent };
export type PersistenceResult = "applied" | "duplicate" | "stale" | "unknown_owner" | "rejected";

export async function persistVerifiedBillingUpdate(database: DB, input: VerifiedUpdate): Promise<PersistenceResult> {
  const checked = validateVerifiedBillingNotice(input.notice);
  if (!checked.accepted ||
      input.notice.provider !== input.event.provider ||
      input.notice.subscriptionId !== input.event.externalSubscriptionId ||
      input.notice.eventId !== input.event.eventId ||
      input.notice.occurredAt !== input.event.eventAt) return "rejected";

  // Never derive a SIGNALX user id from untrusted notice fields.
  const client: PoolClient = await database.connect();
  try {
    await client.query("BEGIN");
    const insert = await client.query(
      `INSERT INTO public.signalx_billing_event_inbox
       (provider,provider_event_id,external_subscription_id,provider_event_at,verification_method)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (provider,provider_event_id) DO NOTHING RETURNING id`,
      [input.notice.provider,input.notice.eventId,input.notice.subscriptionId,
       input.notice.occurredAt,input.notice.verification]);
    if (insert.rowCount !== 1) {
      await client.query("COMMIT");
      return "duplicate";
    }
    const found = await client.query(
      `SELECT user_id,provider,external_subscription_id,status,valid_until,revoked_at,provider_event_at
       FROM public.signalx_premium_entitlements
       WHERE provider=$1 AND external_subscription_id=$2 FOR UPDATE`,
      [input.notice.provider,input.notice.subscriptionId]);
    if (found.rowCount !== 1 || !found.rows[0]?.user_id) {
      // Do not consume an event for an owner that has not been safely established.
      await client.query("ROLLBACK");
      return "unknown_owner";
    }
    const current = found.rows[0];
    const previous = current.provider_event_at ? {
      provider: current.provider,externalSubscriptionId: current.external_subscription_id,
      lastEventId: "_previous_", lastEventAt: new Date(current.provider_event_at).toISOString(),
      status: current.status,validUntil: current.valid_until,
    } : null;
    const projected = projectVerifiedBillingEvent(previous,input.event);
    if (projected.kind === "reject_invalid" || projected.kind === "reject_identity_mismatch") {
      await client.query("ROLLBACK");
      return "rejected";
    }
    if (projected.kind !== "apply") {
      await client.query(
        `UPDATE public.signalx_billing_event_inbox SET processing_status='ignored_stale',processed_at=NOW()
         WHERE provider=$1 AND provider_event_id=$2`,
        [input.notice.provider,input.notice.eventId]);
      await client.query("COMMIT");
      return "stale";
    }
    await client.query(
      `UPDATE public.signalx_premium_entitlements
       SET status=$3,valid_until=$4,provider_event_at=$5,updated_at=NOW()
       WHERE provider=$1 AND external_subscription_id=$2`,
      [input.notice.provider,input.notice.subscriptionId,input.event.status,
       input.event.validUntil,input.event.eventAt]);
    await client.query(
      `UPDATE public.signalx_billing_event_inbox SET processing_status='applied',processed_at=NOW()
       WHERE provider=$1 AND provider_event_id=$2`,
      [input.notice.provider,input.notice.eventId]);
    await client.query("COMMIT");
    return "applied";
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve original error */ }
    throw error;
  } finally { client.release(); }
}
