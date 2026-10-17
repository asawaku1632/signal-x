import "server-only";
import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { STOCKS } from "@/app/lib/stockList";
import { BB_VENDOR_PROBE_300_CODES } from "@/app/lib/research/bollingerVendorProbe300Universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
const headers = { "Cache-Control": "private, no-store" };
const FAILED_CODES = ["9613", "2412", "4384", "3141", "1809", "2651", "1949", "6028", "6201", "9719"] as const;

/** Preview-only, manual, owner-only diagnosis of the ten previously observed 404s.
 * Never changes the frozen universe, stock list, DB, trading, or notifications.
 * No automatic retries: exactly one provider call per code per invocation.
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
  const checks = [];
  for (const code of FAILED_CODES) {
    const listed = STOCKS.find(stock => stock.code === code);
    const item: {
      code: string; stockName: string | null; localStatus: string;
      inFrozen300: boolean; providerHttpStatus: number | null;
      historyBars: number | null; closeCount: number | null;
      outcome: string; elapsedMs: number;
    } = {
      code, stockName: listed?.name ?? null, localStatus: listed?.status ?? "UNSPECIFIED",
      inFrozen300: BB_VENDOR_PROBE_300_CODES.includes(code as typeof BB_VENDOR_PROBE_300_CODES[number]),
      providerHttpStatus: null, historyBars: null, closeCount: null,
      outcome: "NOT_RUN", elapsedMs: 0,
    };
    const t = Date.now();
    try {
      const response = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/" +
        encodeURIComponent(code + ".T") + "?range=2y&interval=1d&events=splits",
        { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(12000) }
      );
      item.providerHttpStatus = response.status;
      if (!response.ok) {
        item.outcome = "PROVIDER_HTTP_" + response.status;
      } else {
        const payload = await response.json();
        const chart = payload?.chart?.result?.[0];
        item.historyBars = Array.isArray(chart?.timestamp) ? chart.timestamp.length : 0;
        const closes = chart?.indicators?.quote?.[0]?.close;
        item.closeCount = Array.isArray(closes) ? closes.filter((v: unknown) => typeof v === "number").length : 0;
        item.outcome = (item.historyBars ?? 0) >= 110 && Array.isArray(closes)
          ? "PROVIDER_HISTORY_AVAILABLE" : "PROVIDER_HISTORY_INSUFFICIENT";
      }
    } catch (error) {
      item.outcome = error instanceof Error && error.name === "TimeoutError"
        ? "PROVIDER_TIMEOUT" : "PROVIDER_FETCH_OR_PARSE_ERROR";
    }
    item.elapsedMs = Date.now() - t;
    checks.push(item);
  }
  return NextResponse.json({
    success: true, mode: "OWNER_PREVIEW_READ_ONLY_TEN_404_DIAGNOSTIC",
    note: "Provider HTTP status and local stock metadata are evidence; delisting/merger is NOT determined here.",
    requested: FAILED_CODES.length, elapsedMs: Date.now() - started, checks,
  }, { headers });
}
