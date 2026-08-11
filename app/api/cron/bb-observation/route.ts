import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import {
  runBbObservation,
  type BbObservationStock,
} from "@/app/lib/learning/bbObservation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

function getJstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (secret && authorization === `Bearer ${secret}`) return true;
  return (await getAdminSession()).isAdmin;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const scanUrl = new URL("/api/scan?limit=1000", request.url);
    const cookie = request.headers.get("cookie");
    const response = await fetch(scanUrl, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
      signal: AbortSignal.timeout(125_000),
    });
    if (!response.ok) throw new Error(`scan api failed: ${response.status}`);
    const payload = await response.json() as { stocks?: BbObservationStock[] };
    const stocks = Array.isArray(payload.stocks) ? payload.stocks : [];
    if (stocks.length === 0) throw new Error("scan api returned no stocks");

    const observation = await runBbObservation(getJstDateString(), stocks);
    return NextResponse.json({ success: true, stockCount: stocks.length, observation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "BB observation failed";
    console.error("bb observation cron error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
