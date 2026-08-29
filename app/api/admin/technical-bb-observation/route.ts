import { NextResponse } from "next/server";

import { getAdminSession } from "@/app/lib/admin";
import { handleBollingerManualRequest } from "@/app/lib/technicalObservation/bollingerObservationManualEndpoint";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

const noStoreHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function POST(request: Request) {
  const { session, isAdmin } = await getAdminSession();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" },
      { status: 400, headers: noStoreHeaders });
  }
  const response = await handleBollingerManualRequest(body,
    { authenticated: Boolean(session), isAdmin });
  if (response.status === 500) console.error("BB observation manual execution failed",
    { reason: "MANUAL_EXECUTION_FAILED" });
  return NextResponse.json(response.body, { status: response.status, headers: noStoreHeaders });
}
