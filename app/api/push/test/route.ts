import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { requireSecurePushRequest } from "@/app/lib/push/requestSecurity";
import {
  consumePushTestRateLimit,
  getActivePushSubscriptions,
  markPushFailure,
  markPushSuccess,
  normalizePushUserEmail,
  revokeExpiredPushSubscription,
} from "@/app/lib/push/subscriptionRepository";
import { sendWebPush } from "@/app/lib/push/sendWebPush";
import type { PushPayload } from "@/app/lib/push/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TEST_PAYLOAD: PushPayload = {
  title: "SIGNALX",
  body: "プッシュ通知のテストに成功しました",
  url: "/",
  tag: "signalx-push-test",
};

export async function POST(request: Request) {
  const denied = requireSecurePushRequest(request);
  if (denied) return denied;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  const userEmail = normalizePushUserEmail(email);

  try {
    if (!(await consumePushTestRateLimit(userEmail))) {
      return NextResponse.json({ success: false, error: "Please wait before sending another test" }, { status: 429, headers: { "Retry-After": "60" } });
    }

    const subscriptions = await getActivePushSubscriptions(userEmail);
    if (subscriptions.length === 0) {
      return NextResponse.json({ success: false, error: "No active push subscription" }, { status: 404 });
    }

    const outcomes = await Promise.all(subscriptions.map(async (subscription) => {
      const result = await sendWebPush(subscription, TEST_PAYLOAD);
      try {
        if (result.ok) await markPushSuccess(subscription.id);
        else if (result.statusCode === 404 || result.statusCode === 410) await revokeExpiredPushSubscription(subscription.id);
        else await markPushFailure(subscription.id);
      } catch {
        console.error("Push delivery status update failed");
      }
      return result;
    }));

    const sent = outcomes.filter((outcome) => outcome.ok).length;
    const failed = outcomes.length - sent;
    return NextResponse.json({ success: sent > 0, sent, failed }, { status: sent > 0 ? 200 : 502 });
  } catch {
    console.error("Push test request failed");
    return NextResponse.json({ success: false, error: "Push test request failed" }, { status: 500 });
  }
}
