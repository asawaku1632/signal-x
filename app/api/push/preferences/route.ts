import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from "@/app/lib/push/notificationPreferences";
import {
  NOTIFICATION_CATEGORIES,
  parseNotificationPreferences,
} from "@/app/lib/push/notificationTypes";
import { normalizePushUserEmail } from "@/app/lib/push/subscriptionRepository";
import { readLimitedJson, requireSecurePushRequest } from "@/app/lib/push/requestSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticatedEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email ? normalizePushUserEmail(session.user.email) : null;
}

export async function GET() {
  const email = await authenticatedEmail();
  if (!email) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  try {
    const preferences = await getNotificationPreferences(email);
    return NextResponse.json({ success: true, preferences, categories: NOTIFICATION_CATEGORIES }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("Push notification preferences read failed");
    return NextResponse.json({ success: false, error: "Preferences unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const denied = requireSecurePushRequest(request);
  if (denied) return denied;
  const email = await authenticatedEmail();
  if (!email) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  try {
    const body = await readLimitedJson(request);
    const input = body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).preferences : null;
    const preferences = parseNotificationPreferences(input);
    if (!preferences) return NextResponse.json({ success: false, error: "Invalid notification preferences" }, { status: 400 });
    await saveNotificationPreferences(email, preferences);
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") return NextResponse.json({ success: false, error: "Request too large" }, { status: 413 });
    console.error("Push notification preferences save failed");
    return NextResponse.json({ success: false, error: "Preferences save failed" }, { status: 503 });
  }
}
