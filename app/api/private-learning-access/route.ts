import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Only a boolean is exposed. Never return the configured owner email.
// This powers visibility of the bottom navigation item; the destination
// separately enforces authorization on the server.
export async function GET() {
  const { isOwner } = await getLearningOwnerSession();
  return NextResponse.json(
    { isOwner },
    { headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } },
  );
}
