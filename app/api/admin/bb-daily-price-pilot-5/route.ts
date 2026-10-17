import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { inspectDailyPriceChart } from "@/app/lib/research/bollingerDailyPriceInspection";
import { BB_VENDOR_PROBE_950_CODES } from "@/app/lib/research/bollingerVendorProbe950Universe";
import { BB_VENDOR_950_BATCH_EVIDENCE, verifyBbVendor950Evidence } from "@/app/lib/research/bollingerVendor950AvailabilityEvidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
const headers = { "Cache-Control": "private, no-store" };

/** Manual five-stock quality check, Preview and owner only. No persistence. */
export async function GET(_request: NextRequest) {
  if (!(await getLearningOwnerSession()).isOwner) {
    return NextResponse.json({ success: false, error: "OWNER_ONLY" }, { status: 403, headers });
  }
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.BB_DAILY100_DEV_DIAGNOSTIC !== "true") {
    return NextResponse.json({ success: false, error: "PREVIEW_ONLY_DISABLED" }, { status: 404, headers });
  }
  if (!verifyBbVendor950Evidence() || BB_VENDOR_PROBE_950_CODES.length !== 950) {
    return NextResponse.json({ success: false, error: "RESEARCH_EVIDENCE_INVALID" }, { status: 500, headers });
  }
  const excluded: Set<string> = new Set(Object.values(BB_VENDOR_950_BATCH_EVIDENCE)
    .flatMap(item => [...item.http404, ...item.insufficientHistory]));
  const codes = BB_VENDOR_PROBE_950_CODES.filter(code => !excluded.has(code)).slice(0, 5);
  if (codes.length !== 5 || new Set(codes).size !== 5) {
    return NextResponse.json({ success: false, error: "PILOT_COHORT_INVALID" }, { status: 500, headers });
  }
  const todayJst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const results: Array<{ code: string; ok: boolean; inspection?: ReturnType<typeof inspectDailyPriceChart>; error?: string }> = [];
  for (const code of codes) {
    try {
      const url = "https://query1.finance.yahoo.com/v8/finance/chart/" +
        encodeURIComponent(code + ".T") + "?range=2y&interval=1d&events=splits";
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw Error("PRICE_PROVIDER_STATUS_" + response.status);
      const payload = await response.json();
      const inspection = inspectDailyPriceChart(code, payload?.chart?.result?.[0], todayJst);
      const ok = inspection.observations >= 110 &&
        inspection.duplicateDates === 0 && inspection.nonAscendingDates === 0 &&
        inspection.missingClose === 0 && inspection.invalidClose === 0 &&
        inspection.latestDateIsTodayOrEarlier;
      results.push({ code, ok, inspection });
    } catch (error) {
      results.push({ code, ok: false, error: error instanceof Error ? error.message.slice(0, 100) : "UNKNOWN" });
    }
  }
  return NextResponse.json({
    success: true,
    mode: "OWNER_PREVIEW_READ_ONLY_MANUAL_DAILY_PRICE_PILOT_5",
    requested: codes.length,
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    todayJst, persisted: false, cronEnabled: false,
    adjustedCloseUsed: false,
    corporateActionValidationComplete: false,
    results,
  }, { headers });
}
