import { NextResponse } from "next/server";

import { getNotificationLogs } from "@/app/lib/notificationLog";

function getJapanDateKey(dateString: string) {
  return new Date(dateString).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export async function GET() {
  const start = Date.now();

  try {
    const logs = await getNotificationLogs();

    const todayKey = getJapanDateKey(new Date().toISOString());

    const todayLogs = logs.filter(
      (log) => getJapanDateKey(log.notifiedAt) === todayKey
    );

    const codeCount: Record<string, number> = {};

    for (const log of todayLogs) {
      codeCount[log.code] = (codeCount[log.code] ?? 0) + 1;
    }

    const duplicates = Object.entries(codeCount)
      .filter(([, count]) => count > 1)
      .map(([code, count]) => ({ code, count }));

    const latestNotification = logs[0] ?? null;

    const sentCount = todayLogs.length;
const successCount = todayLogs.length;
const failedCount = 0;
const duplicateCount = duplicates.length;

const status =
  sentCount === 0
    ? "NO_DATA"
    : failedCount === 0 && duplicateCount === 0
    ? "PASS"
    : "FAIL";

    return NextResponse.json({
      success: true,
      status,
      targetCount: sentCount,
      sentCount,
      successCount,
      failedCount,
      duplicateCount,
      todayLogs,
      duplicates,
      latestNotification,
      totalLogs: logs.length,
      apiTimeMs: Date.now() - start,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        status: "FAIL",
        error: "LINE_VERIFICATION_FAILED",
        message: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}