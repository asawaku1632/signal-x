import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import {
  normalizePushUserEmail,
  PushSubscriptionOwnerConflictError,
  revokePushSubscriptionForUser,
  upsertPushSubscription,
} from "@/app/lib/push/subscriptionRepository";
import { readLimitedJson, requireSecurePushRequest } from "@/app/lib/push/requestSecurity";
import type { PushSubscriptionInput } from "@/app/lib/push/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT_MAX_LENGTH = 4096;
const KEY_MAX_LENGTH = 512;

async function authenticatedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  return email ? normalizePushUserEmail(email) : null;
}

function isValidEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > ENDPOINT_MAX_LENGTH) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isValidKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= KEY_MAX_LENGTH
    && /^[A-Za-z0-9_-]+$/.test(value);
}

function parseSubscription(value: unknown): PushSubscriptionInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const keys = input.keys as Record<string, unknown> | null;
  const expirationTime = input.expirationTime;
  if (!isValidEndpoint(input.endpoint) || !keys || typeof keys !== "object") return null;
  if (!isValidKey(keys.p256dh) || !isValidKey(keys.auth)) return null;
  if (expirationTime !== null && typeof expirationTime !== "number") return null;
  return { endpoint: input.endpoint, expirationTime: expirationTime as number | null, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export async function POST(request: Request) {
  const denied = requireSecurePushRequest(request);
  if (denied) return denied;
  const userEmail = await authenticatedEmail();
  if (!userEmail) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });

  try {
    const subscription = parseSubscription(await readLimitedJson(request));
    if (!subscription) return NextResponse.json({ success: false, error: "Invalid push subscription" }, { status: 400 });
    const saved = await upsertPushSubscription(userEmail, subscription);
    return NextResponse.json({ success: true, subscriptionId: saved.id, enabled: true });
  } catch (error) {
    if (error instanceof PushSubscriptionOwnerConflictError) {
      return NextResponse.json({ success: false, error: "Subscription is registered to another account" }, { status: 409 });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") return NextResponse.json({ success: false, error: "Request body is too large" }, { status: 413 });
    console.error("Push subscription registration failed");
    return NextResponse.json({ success: false, error: "Push subscription registration failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = requireSecurePushRequest(request);
  if (denied) return denied;
  const userEmail = await authenticatedEmail();
  if (!userEmail) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });

  try {
    const value = await readLimitedJson(request);
    const endpoint = value && typeof value === "object" ? (value as Record<string, unknown>).endpoint : null;
    if (!isValidEndpoint(endpoint)) return NextResponse.json({ success: false, error: "Invalid push endpoint" }, { status: 400 });
    const revoked = await revokePushSubscriptionForUser(userEmail, endpoint);
    return NextResponse.json({ success: true, revoked });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") return NextResponse.json({ success: false, error: "Request body is too large" }, { status: 413 });
    console.error("Push subscription removal failed");
    return NextResponse.json({ success: false, error: "Push subscription removal failed" }, { status: 500 });
  }
}
