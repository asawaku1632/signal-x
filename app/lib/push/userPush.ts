import {
  getActivePushSubscriptions,
  markPushFailure,
  markPushSuccess,
  revokeExpiredPushSubscription,
} from "@/app/lib/push/subscriptionRepository";
import { sendWebPush } from "@/app/lib/push/sendWebPush";
import type { PushPayload } from "@/app/lib/push/types";

export async function pushWebToUser(userEmail: string, payload: PushPayload) {
  const subscriptions = await getActivePushSubscriptions(userEmail.trim().toLowerCase());
  if (subscriptions.length === 0) return { ok: false, sent: 0, failed: 0, reason: "NO_SUBSCRIPTION" };

  const outcomes = await Promise.all(subscriptions.map(async (subscription) => {
    const result = await sendWebPush(subscription, payload);
    try {
      if (result.ok) await markPushSuccess(subscription.id);
      else if (result.statusCode === 404 || result.statusCode === 410) await revokeExpiredPushSubscription(subscription.id);
      else await markPushFailure(subscription.id);
    } catch {
      console.error("Push delivery status update failed");
    }
    return result;
  }));

  const sent = outcomes.filter((result) => result.ok).length;
  return { ok: sent > 0, sent, failed: outcomes.length - sent };
}
