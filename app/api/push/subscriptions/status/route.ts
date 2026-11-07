import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { getActivePushSubscriptions, normalizePushUserEmail } from "@/app/lib/push/subscriptionRepository";
import { readLimitedJson, requireSecurePushRequest } from "@/app/lib/push/requestSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireSecurePushRequest(request);
  if (denied) return denied;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const data = await readLimitedJson(request);
    const endpoint = data && typeof data === "object" && "endpoint" in data ? data.endpoint : null;
    if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 4096) {
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
    }
    const subscriptions = await getActivePushSubscriptions(normalizePushUserEmail(email));
    return NextResponse.json({
      registered: subscriptions.some((subscription) => subscription.endpoint === endpoint),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to check subscription" }, { status: 500 });
  }
}
