import { NextRequest, NextResponse } from "next/server";
import { getRecentCronLearningLogs } from "@/app/lib/learning/cronLearningLogRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBUG_VERSION = "V22_2_CRON_LEARNING_LOGS_API_0707";

function toSafeLimit(value: string | null): number {
  const num = Number(value ?? 20);
  if (!Number.isFinite(num)) return 20;
  if (num < 1) return 20;
  if (num > 100) return 100;
  return Math.floor(num);
}

export async function GET(request: NextRequest) {
  try {
    const limit = toSafeLimit(request.nextUrl.searchParams.get("limit"));
    const logs = await getRecentCronLearningLogs(limit);

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      checkedAt: new Date().toISOString(),
      count: logs.length,
      logs,
      latest: logs[0] ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        debugVersion: DEBUG_VERSION,
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "failed to read cron learning logs",
      },
      { status: 500 }
    );
  }
}
