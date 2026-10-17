import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { probeDaily100Vendor } from "@/app/lib/research/bollingerDaily100VendorProbe";
import { BB_VENDOR_PROBE_500_CODES, BB_VENDOR_PROBE_500_VERSION } from "@/app/lib/research/bollingerVendorProbe500Universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
const headers = { "Cache-Control": "private, no-store" };

/** Manual owner-only preview acquisition test. 25 batches of 20,
 * each internally limited to sequential groups of 5.
 * No DB, Cron, LINE, trading, or persistence.
 */
export async function GET(request: NextRequest) {
  if (!(await getLearningOwnerSession()).isOwner) {
    return NextResponse.json({ success: false, error: "OWNER_ONLY" }, { status: 403, headers });
  }
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.BB_DAILY100_DEV_DIAGNOSTIC !== "true") {
    return NextResponse.json({ success: false, error: "PREVIEW_ONLY_DISABLED" }, { status: 404, headers });
  }
  const raw = request.nextUrl.searchParams.get("batch");
  if (raw === null || !/^(?:[0-9]|1[0-9]|2[0-4])$/.test(raw)) {
    return NextResponse.json({ success: false, error: "BATCH_MUST_BE_0_TO_24" }, { status: 400, headers });
  }
  const batch = Number(raw);
  if (BB_VENDOR_PROBE_500_CODES.length !== 500 ||
      new Set(BB_VENDOR_PROBE_500_CODES).size !== 500) {
    return NextResponse.json({ success: false, error: "UNIVERSE_INVALID" }, { status: 500, headers });
  }
  const codes = BB_VENDOR_PROBE_500_CODES.slice(batch * 20, (batch + 1) * 20);
  const started = Date.now();
  const checks: { code: string; ok: boolean; elapsedMs: number; error?: string }[] = [];
  const groups: { group: number; succeeded: number; failed: number; elapsedMs: number }[] = [];
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
    groups.push({ group: offset / 5 + 1, succeeded: result.succeeded, failed: result.failed, elapsedMs: result.elapsedMs });
  }
  return NextResponse.json({
    success: true, mode: "OWNER_PREVIEW_READ_ONLY_MANUAL_500_BATCH_OF_20",
    universeVersion: BB_VENDOR_PROBE_500_VERSION, batch,
    requested: checks.length,
    succeeded: checks.filter(c => c.ok).length,
    failed: checks.filter(c => !c.ok).length,
    elapsedMs: Date.now() - started,
    groups, checks,
  }, { headers });
}
