import pool from "@/app/lib/postgres";
import type { PushSubscriptionInput, StoredPushSubscription } from "./types";

type SubscriptionRow = StoredPushSubscription;

export class PushSubscriptionOwnerConflictError extends Error {
  constructor() {
    super("Push subscription belongs to another account");
    this.name = "PushSubscriptionOwnerConflictError";
  }
}

export function normalizePushUserEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function upsertPushSubscription(userEmail: string, input: PushSubscriptionInput) {
  const result = await pool.query<SubscriptionRow>(
    `
      INSERT INTO public.push_subscriptions (
        user_email, endpoint, p256dh, auth, enabled, revoked_at
      )
      VALUES ($1, $2, $3, $4, TRUE, NULL)
      ON CONFLICT (endpoint)
      DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        enabled = TRUE,
        revoked_at = NULL,
        failure_count = 0,
        updated_at = NOW()
      WHERE push_subscriptions.user_email = EXCLUDED.user_email
      RETURNING id, endpoint, p256dh, auth
    `,
    [userEmail, input.endpoint, input.keys.p256dh, input.keys.auth],
  );

  if (!result.rows[0]) throw new PushSubscriptionOwnerConflictError();
  return result.rows[0];
}

export async function revokePushSubscriptionForUser(userEmail: string, endpoint: string) {
  const result = await pool.query(
    `
      UPDATE public.push_subscriptions
      SET enabled = FALSE, revoked_at = NOW(), updated_at = NOW()
      WHERE user_email = $1 AND endpoint = $2
      RETURNING id
    `,
    [userEmail, endpoint],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getActivePushSubscriptions(userEmail: string, limit = 10) {
  const result = await pool.query<SubscriptionRow>(
    `
      SELECT id, endpoint, p256dh, auth
      FROM public.push_subscriptions
      WHERE user_email = $1 AND enabled = TRUE AND revoked_at IS NULL
      ORDER BY updated_at DESC
      LIMIT $2
    `,
    [userEmail, limit],
  );
  return result.rows;
}

export async function markPushSuccess(id: string) {
  await pool.query(
    `UPDATE public.push_subscriptions
     SET last_success_at = NOW(), failure_count = 0, updated_at = NOW()
     WHERE id = $1`,
    [id],
  );
}

export async function markPushFailure(id: string) {
  await pool.query(
    `UPDATE public.push_subscriptions
     SET last_failure_at = NOW(), failure_count = failure_count + 1, updated_at = NOW()
     WHERE id = $1`,
    [id],
  );
}

export async function revokeExpiredPushSubscription(id: string) {
  await pool.query(
    `UPDATE public.push_subscriptions
     SET enabled = FALSE, revoked_at = NOW(), last_failure_at = NOW(),
         failure_count = failure_count + 1, updated_at = NOW()
     WHERE id = $1`,
    [id],
  );
}

export async function consumePushTestRateLimit(userEmail: string) {
  const result = await pool.query(
    `
      INSERT INTO public.push_test_rate_limits (
        user_email, window_started_at, request_count, last_request_at
      )
      VALUES ($1, NOW(), 1, NOW())
      ON CONFLICT (user_email)
      DO UPDATE SET
        window_started_at = CASE
          WHEN push_test_rate_limits.window_started_at <= NOW() - INTERVAL '1 hour' THEN NOW()
          ELSE push_test_rate_limits.window_started_at
        END,
        request_count = CASE
          WHEN push_test_rate_limits.window_started_at <= NOW() - INTERVAL '1 hour' THEN 1
          ELSE push_test_rate_limits.request_count + 1
        END,
        last_request_at = NOW()
      WHERE push_test_rate_limits.last_request_at <= NOW() - INTERVAL '60 seconds'
        AND (
          push_test_rate_limits.window_started_at <= NOW() - INTERVAL '1 hour'
          OR push_test_rate_limits.request_count < 10
        )
      RETURNING user_email
    `,
    [userEmail],
  );
  return Boolean(result.rows[0]);
}
