import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { probeDaily100Vendor } from "@/app/lib/research/bollingerDaily100VendorProbe";
import { BB_VENDOR_950_BATCH_EVIDENCE, BB_VENDOR_950_SUMMARY, verifyBbVendor950Evidence } from "@/app/lib/research/bollingerVendor950AvailabilityEvidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store" };

/** Owner-only, manual, Preview-only re-probe of previously failed codes.
 * Five sequential requests per batch at most; no DB, cron, persistence, LINE or trading.
 * Historical evidence is immutable; retry results are returned to the owner only.
 */
export async function GET(request: NextRequest) {
  if (!(await getLearningOwnerSession()).isOwner) {
    return NextResponse.json({ success: false, error: "OWNER_ONLY" }, { status: 403, headers });
  }
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.BB_DAILY100_DEV_DIAGNOSTIC !== "true") {
    return NextResponse.json({ success: false, error: "PREVIEW_ONLY_DISABLED" }, { status: 404, headers });
  }
  if (!verifyBbVendor950Evidence()) {
    return NextResponse.json({ success: false, error: "EVIDENCE_INVALID" }, { status: 500, headers });
  }
  const raw = request.nextUrl.searchParams.get("batch");
  if (raw === null || !/^(?:[0-9])$/.test(raw)) {
    return NextResponse.json({ success: false, error: "BATCH_MUST_BE_0_TO_9" }, { status: 400, headers });
  }
  const batch = Number(raw);
  const failures = Object.values(BB_VENDOR_950_BATCH_EVIDENCE).flatMap(item => [
    ...item.http404.map(code => ({ code, previousError: "PRICE_PROVIDER_STATUS_404" })),
    ...item.insufficientHistory.map(code => ({ code, previousError: "INSUFFICIENT_PRICE_HISTORY" })),
  ]);
  if (failures.length !== BB_VENDOR_950_SUMMARY.failed) {
    return NextResponse.json({ success: false, error: "FAILURE_COUNT_MISMATCH" }, { status: 500, headers });
  }
  const targets = failures.slice(batch * 5, (batch + 1) * 5);
  if (!targets.length) {
    return NextResponse.json({ success: false, error: "EMPTY_BATCH" }, { status: 400, headers });
  }
  const started = Date.now();
  const checks: { code: string; ok: boolean; elapsedMs: number; error?: string }[] = [];
  // Sequential single-stock calls prevent bursts to the price provider.
  for (const target of targets) {
    const result = await probeDaily100Vendor([target.code], async code => {
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
  }
  return NextResponse.json({
    success: true,
    mode: "OWNER_PREVIEW_READ_ONLY_MANUAL_950_FAILURE_RETRY",
    universeVersion: BB_VENDOR_950_SUMMARY.universeVersion,
    batch, requested: targets.length,
    succeeded: checks.filter(c => c.ok).length,
    failed: checks.filter(c => !c.ok).length,
    elapsedMs: Date.now() - started,
    checks: checks.map((check, index) => ({
      ...check,
      previousError: targets[index].previousError,
      changedFromFailureToSuccess: check.ok,
    })),
    historicalEvidenceUnchanged: true,
  }, { headers });
}
