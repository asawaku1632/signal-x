import { NextResponse } from "next/server";

import { getNotificationLogs } from "@/app/lib/notificationLog";

export async function GET() {
  try {
    const logs = await getNotificationLogs();

    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "notification logs failed",
      },
      {
        status: 500,
      }
    );
  }
}
