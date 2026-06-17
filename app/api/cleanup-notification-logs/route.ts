import { NextResponse } from "next/server";

import {
  getNotificationLogs,
  overwriteNotificationLogs,
} from "@/app/lib/notificationLog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logs = await getNotificationLogs();

    const latestByCode = new Map<string, any>();

    for (const log of logs) {
      const existing = latestByCode.get(log.code);

      if (!existing) {
        latestByCode.set(log.code, log);
        continue;
      }

      const existingTime = new Date(existing.notifiedAt).getTime();
      const currentTime = new Date(log.notifiedAt).getTime();

      if (currentTime > existingTime) {
        latestByCode.set(log.code, log);
      }
    }

    const cleanedLogs = Array.from(latestByCode.values()).sort(
      (a, b) =>
        new Date(b.notifiedAt).getTime() -
        new Date(a.notifiedAt).getTime()
    );

    await overwriteNotificationLogs(cleanedLogs);

    return NextResponse.json({
      success: true,
      before: logs.length,
      after: cleanedLogs.length,
      removed: logs.length - cleanedLogs.length,
      logs: cleanedLogs,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "cleanup notification logs failed",
        message: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}