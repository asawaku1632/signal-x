import { NextResponse } from "next/server";

import { requireCronAuth } from "@/app/lib/cronAuth";
import { saveCronRunLog } from "@/app/lib/cronRunLog";
import { getJstDateString } from "@/app/lib/learning/learningSaveStatus";
import {
  auditDateIsTradingDay,
  collectWinRateReliabilityAudit,
  WIN_RATE_DAILY_AUDIT_KIND,
  WIN_RATE_DAILY_AUDIT_ROUTE,
} from "@/app/lib/learning/winRateReliabilityAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// 18:15 JST on market days, after the 17:30 daily-check recovery.
// Strictly observational. The only write is a separate cron_run_logs audit record.
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const tradeDate = getJstDateString(now);
  try {
    if (!auditDateIsTradingDay(now)) {
      return NextResponse.json({
        success: true, skipped: true, reason: "TSE_MARKET_CLOSED", tradeDate,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const audit = await collectWinRateReliabilityAudit(now);
    const saved = await saveCronRunLog({
      route: WIN_RATE_DAILY_AUDIT_ROUTE,
      status: "COMPLETED",
      message: audit.health === "OK" ? "Daily reliability audit: OK" : "Daily reliability audit: needs review",
      details: audit,
    });
    if (saved && "logSaveFailed" in saved) {
      throw new Error("AUDIT_RECORD_NOT_SAVED");
    }
    return NextResponse.json({ success: true, audit, auditLogId: saved.id }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[win-rate-reliability-audit] failed", error);
    await saveCronRunLog({
      route: WIN_RATE_DAILY_AUDIT_ROUTE,
      status: "ERROR",
      message: "Daily reliability audit failed",
      details: { kind: WIN_RATE_DAILY_AUDIT_KIND, tradeDate, error: "AUDIT_EXECUTION_FAILED" },
    });
    return NextResponse.json(
      { success: false, error: "監査実行または保存に失敗しました" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
