import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import pool from "@/app/lib/postgres";
import { normalizePushUserEmail } from "@/app/lib/push/subscriptionRepository";
import { readLimitedJson, requireSecurePushRequest } from "@/app/lib/push/requestSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_TARGETS_PER_USER = 20;

async function authenticatedEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email ? normalizePushUserEmail(session.user.email) : null;
}

export async function GET() {
  const email = await authenticatedEmail();
  if (!email) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  try {
    const result = await pool.query(
      `SELECT id, code, direction, threshold::float8 AS threshold, notified_at
       FROM public.push_price_targets WHERE user_email = $1 ORDER BY created_at DESC LIMIT 30`, [email],
    );
    return NextResponse.json({ success: true, targets: result.rows, maxTargets: MAX_TARGETS_PER_USER }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("Failed to fetch user price targets");
    return NextResponse.json({ success: false, error: "Price targets unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = requireSecurePushRequest(request);
  if (denied) return denied;
  const email = await authenticatedEmail();
  if (!email) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  try {
    const body = await readLimitedJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid target" }, { status: 400 });
    }
    const obj = body as Record<string, unknown>;
    const code = typeof obj.code === "string" ? obj.code.trim().toUpperCase() : "";
    const direction = obj.direction;
    const threshold = obj.threshold;
    if (!/^[0-9A-Z]{4}$/.test(code) ||
        (direction !== "ABOVE" && direction !== "BELOW") ||
        typeof threshold !== "number" || !Number.isFinite(threshold) ||
        threshold < 0.01 || threshold > 1_000_000_000 ||
        Math.abs(Math.round(threshold * 100) - threshold * 100) > 0.0000001) {
      return NextResponse.json({ success: false, error: "Invalid code, direction or price" }, { status: 400 });
    }
    const result = await pool.query(
      `INSERT INTO public.push_price_targets (user_email, code, direction, threshold)
       SELECT $1, $2, $3, $4
       WHERE (SELECT count(*) FROM public.push_price_targets WHERE user_email = $1) < $5
       ON CONFLICT (user_email, code, direction, threshold) DO NOTHING
       RETURNING id`,
      [email, code, direction, threshold, MAX_TARGETS_PER_USER],
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: "Duplicate target or limit reached" }, { status: 409 });
    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") return NextResponse.json({ success: false, error: "Request too large" }, { status: 413 });
    console.error("Failed to create user price target");
    return NextResponse.json({ success: false, error: "Could not add price target" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const denied = requireSecurePushRequest(request);
  if (denied) return denied;
  const email = await authenticatedEmail();
  if (!email) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  try {
    const body = await readLimitedJson(request);
    const id = body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).id : null;
    if (!Number.isSafeInteger(id) || Number(id) < 1) {
      return NextResponse.json({ success: false, error: "Invalid target id" }, { status: 400 });
    }
    const result = await pool.query(
      "DELETE FROM public.push_price_targets WHERE user_email = $1 AND id = $2 RETURNING id",
      [email, id],
    );
    return NextResponse.json({ success: true, deleted: Boolean(result.rows[0]) });
  } catch {
    console.error("Failed to delete price target");
    return NextResponse.json({ success: false, error: "Could not remove price target" }, { status: 503 });
  }
}
