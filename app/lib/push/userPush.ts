import pool from "@/app/lib/postgres";
import {
  getActivePushSubscriptions,
  markPushFailure,
  markPushSuccess,
  revokeExpiredPushSubscription,
} from "@/app/lib/push/subscriptionRepository";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  AVAILABLE_NOTIFICATION_TYPES,
  type NotificationType,
} from "@/app/lib/push/notificationTypes";
import { isNotificationEnabled } from "@/app/lib/push/notificationPreferences";
import { sendWebPush } from "@/app/lib/push/sendWebPush";
import type { PushPayload, StoredPushSubscription } from "@/app/lib/push/types";

type DeliveryResult = {
  ok: boolean;
  sent: number;
  failed: number;
  reason?: "NO_SUBSCRIPTION" | "PREFERENCE_DISABLED" | "NOT_VALIDATED";
};

async function deliver(subscriptions: StoredPushSubscription[], payload: PushPayload): Promise<DeliveryResult> {
  if (subscriptions.length === 0) {
    return { ok: false, sent: 0, failed: 0, reason: "NO_SUBSCRIPTION" };
  }
  const outcomes = await Promise.all(subscriptions.map(async (subscription) => {
    const result = await sendWebPush(subscription, payload);
    try {
      if (result.ok) await markPushSuccess(subscription.id);
      else if (result.statusCode === 404 || result.statusCode === 410) {
        await revokeExpiredPushSubscription(subscription.id);
      } else {
        await markPushFailure(subscription.id);
      }
    } catch {
      console.error("Push delivery status update failed");
    }
    return result;
  }));
  const sent = outcomes.filter((result) => result.ok).length;
  return { ok: sent > 0, sent, failed: outcomes.length - sent };
}

export async function pushWebToUser(
  userEmail: string,
  payload: PushPayload,
  type?: NotificationType,
): Promise<DeliveryResult> {
  if (type && !AVAILABLE_NOTIFICATION_TYPES.has(type)) {
    return { ok: false, sent: 0, failed: 0, reason: "NOT_VALIDATED" };
  }
  const email = userEmail.trim().toLowerCase();
  if (type && !(await isNotificationEnabled(email, type))) {
    return { ok: false, sent: 0, failed: 0, reason: "PREFERENCE_DISABLED" };
  }
  const subscriptions = await getActivePushSubscriptions(email);
  return deliver(subscriptions, payload);
}

export async function pushWebToAll(payload: PushPayload, type?: NotificationType): Promise<DeliveryResult> {
  if (type && !AVAILABLE_NOTIFICATION_TYPES.has(type)) {
    return { ok: false, sent: 0, failed: 0, reason: "NOT_VALIDATED" };
  }
  const result = type
    ? await pool.query<StoredPushSubscription>(
        `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
         FROM public.push_subscriptions ps
         LEFT JOIN public.push_notification_preferences pref ON pref.user_email = ps.user_email
         WHERE ps.enabled = TRUE AND ps.revoked_at IS NULL
           AND COALESCE((pref.preferences ->> $1)::boolean, $2) = TRUE
         ORDER BY ps.updated_at DESC`,
        [type, DEFAULT_NOTIFICATION_PREFERENCES[type]],
      )
    : await pool.query<StoredPushSubscription>(
        `SELECT id, endpoint, p256dh, auth
         FROM public.push_subscriptions
         WHERE enabled = TRUE AND revoked_at IS NULL
         ORDER BY updated_at DESC`,
      );
  return deliver(result.rows, payload);
}
