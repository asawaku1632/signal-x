import "server-only";
import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { probeDaily100Vendor } from "@/app/lib/research/bollingerDaily100VendorProbe";
import { BB_FORWARD_FROZEN_CODES } from "@/app/lib/research/bollingerForwardUniverse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
const headers = { "Cache-Control": "private, no-store" };
const codes = BB_FORWARD_FROZEN_CODES.slice(0, 5);

/** Owner-only, preview-only manual GET. No DB, Cron, LINE, trading or persistence. */
export async function GET() {
  if (!(await getLearningOwnerSession()).isOwner) {
    return NextResponse.json({ success: false, error: "OWNER_ONLY" }, { status: 403, headers });
  }
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.BB_DAILY100_DEV_DIAGNOSTIC !== "true") {
    return NextResponse.json({ success: false, error: "PREVIEW_ONLY_DISABLED" }, { status: 404, headers });
  }
  const result = await probeDaily100Vendor(codes, async code => {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(code + ".T") + "?range=2y&interval=1d&events=splits";
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw Error("PRICE_PROVIDER_STATUS_" + response.status);
    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    if (!result || !Array.isArray(result.timestamp) ||
        result.timestamp.length < 110 ||
        !Array.isArray(result.indicators?.quote?.[0]?.close)) {
      throw Error("INSUFFICIENT_PRICE_HISTORY");
    }
    return true;
  });
  return NextResponse.json({
    success: true,
    mode: "OWNER_PREVIEW_READ_ONLY_MANUAL_FIVE_CODE_PROBE",
    ...result,
  }, { headers });
}
