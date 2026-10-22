import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Owner-only research status. No provider polling or production DB reads/writes.
 * ChatGPT Tasks do not persist their execution results to SIGNALX.
 */
export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: "管理者権限が必要です" }, { status: 403 });
  return NextResponse.json({
    success: true,
    asOf: new Date().toISOString(),
    mode: "RESEARCH_SHADOW_ONLY",
    source: "yahoo-unofficial-chart:^N225:1m",
    providerRightsVerified: false,
    scheduledCaptureConfigured: false,
    databasePersistenceConfigured: false,
    lastObservation: null,
    history: [],
    note: "ChatGPTの定時タスク実行履歴はSIGNALXには同期されません。市場データ取得・保存の仕組みは未接続です。",
  }, { headers: { "Cache-Control": "no-store" } });
}
