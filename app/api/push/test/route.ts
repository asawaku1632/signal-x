import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { readLimitedJson, requireSecurePushRequest } from "@/app/lib/push/requestSecurity";
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
  url: "/mypage",
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
    // A successful push to another device must never appear as success on this device.
    const body = await readLimitedJson(request);
    const endpoint = body && typeof body === "object" && "endpoint" in body ? body.endpoint : null;
    if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 4096) {
      return NextResponse.json({ success: false, error: "Invalid device endpoint" }, { status: 400 });
    }
    const subscriptions = await getActivePushSubscriptions(userEmail);
    const subscription = subscriptions.find((item) => item.endpoint === endpoint);
    if (!subscription) {
      return NextResponse.json({ success: false, sent: 0, error: "DEVICE_SUBSCRIPTION_NOT_ACTIVE" }, { status: 404 });
    }
    if (!(await consumePushTestRateLimit(userEmail))) {
      return NextResponse.json({ success: false, error: "Please wait before sending another test" }, { status: 429, headers: { "Retry-After": "60" } });
    }

    const result = await sendWebPush(subscription, TEST_PAYLOAD);
    try {
      if (result.ok) await markPushSuccess(subscription.id);
      else if (result.statusCode === 404 || result.statusCode === 410) await revokeExpiredPushSubscription(subscription.id);
      else await markPushFailure(subscription.id);
    } catch {
      console.error("Push delivery status update failed");
    }
    return NextResponse.json({
      success: result.ok,
      sent: result.ok ? 1 : 0,
      failed: result.ok ? 0 : 1,
      acceptedByPushService: result.ok,
      error: result.ok ? undefined : "PUSH_PROVIDER_REJECTED",
    }, { status: result.ok ? 200 : (result.statusCode === 404 || result.statusCode === 410 ? 410 : 502) });
  } catch {
    console.error("Push test request failed");
    return NextResponse.json({ success: false, error: "Push test request failed" }, { status: 500 });
  }
}
