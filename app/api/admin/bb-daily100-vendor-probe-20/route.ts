import "server-only";
import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { probeDaily100Vendor } from "@/app/lib/research/bollingerDaily100VendorProbe";
import { BB_FORWARD_FROZEN_CODES } from "@/app/lib/research/bollingerForwardUniverse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
const headers = { "Cache-Control": "private, no-store" };
const codes = BB_FORWARD_FROZEN_CODES.slice(0, 20);

/** Owner-only, preview-only manual GET. 4 sequential batches of 5.
 * No DB, Cron, LINE, trading, or persistence.
 */
export async function GET() {
  if (!(await getLearningOwnerSession()).isOwner) {
    return NextResponse.json({ success: false, error: "OWNER_ONLY" }, { status: 403, headers });
  }
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.BB_DAILY100_DEV_DIAGNOSTIC !== "true") {
    return NextResponse.json({ success: false, error: "PREVIEW_ONLY_DISABLED" }, { status: 404, headers });
  }

  const started = Date.now();
  const checks: { code: string; ok: boolean; elapsedMs: number; error?: string }[] = [];
  const batches: { batch: number; requested: number; succeeded: number; failed: number; elapsedMs: number }[] = [];

  for (let offset = 0; offset < codes.length; offset += 5) {
    const result = await probeDaily100Vendor(codes.slice(offset, offset + 5), async code => {
      const url = "https://query1.finance.yahoo.com/v8/finance/chart/" +
        encodeURIComponent(code + ".T") + "?range=2y&interval=1d&events=splits";
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw Error("PRICE_PROVIDER_STATUS_" + response.status);
      const payload = await response.json();
      const chart = payload?.chart?.result?.[0];
      if (!chart || !Array.isArray(chart.timestamp) ||
          chart.timestamp.length < 110 ||
          !Array.isArray(chart.indicators?.quote?.[0]?.close)) {
        throw Error("INSUFFICIENT_PRICE_HISTORY");
      }
      return true;
    });
    checks.push(...result.checks);
    batches.push({
      batch: offset / 5 + 1, requested: result.requested,
      succeeded: result.succeeded, failed: result.failed, elapsedMs: result.elapsedMs,
    });
  }

  return NextResponse.json({
    success: true,
    mode: "OWNER_PREVIEW_READ_ONLY_MANUAL_TWENTY_CODE_PROBE",
    requested: checks.length,
    succeeded: checks.filter(c => c.ok).length,
    failed: checks.filter(c => !c.ok).length,
    elapsedMs: Date.now() - started,
    batches,
    checks,
  }, { headers });
}
